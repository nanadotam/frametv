import Foundation
import UIKit
import ImageIO
import UniformTypeIdentifiers
import Photos

/// Photos saved on the device so the frame, the widgets and StandBy keep going without internet.
///
///   Caches/Mantel/full/<album>/<photo>.jpg   ≤ 2048 px, what the frame shows
///   Caches/Mantel/thumb/<album>/<photo>.jpg  ≤ 480 px, grids and covers
///   Application Support/Mantel/device/<file> photos you picked from your library (never cleared by "Clear downloads")
actor ImageCache {
    static let shared = ImageCache()

    enum Size: String, CaseIterable { case full, medium, thumb
        var maxPixel: CGFloat { switch self { case .full: 2048; case .medium: 1000; case .thumb: 480 } }
    }

    nonisolated(unsafe) let memory: NSCache<NSString, UIImage> = {   // NSCache is thread-safe
        let c = NSCache<NSString, UIImage>(); c.totalCostLimit = 140 * 1024 * 1024; return c
    }()
    private var inflight: [String: Task<UIImage?, Never>] = [:]

    nonisolated static var deviceDir: URL { AppGroup.dir(AppGroup.support.appending(path: "device")) }

    nonisolated func fileURL(_ p: PhotoItem, _ s: Size) -> URL {
        AppGroup.cache.appending(path: "\(s.rawValue)/\(p.albumId)/\(p.id).jpg")
    }
    nonisolated func isSaved(_ p: PhotoItem) -> Bool {
        p.localFile != nil || p.assetId != nil || FileManager.default.fileExists(atPath: fileURL(p, .full).path)
    }

    /// Instant, memory only (for first frames without a flash).
    nonisolated func cached(_ p: PhotoItem, _ s: Size) -> UIImage? {
        memory.object(forKey: "\(s.rawValue)/\(p.id)" as NSString)
            ?? (s == .thumb ? memory.object(forKey: "full/\(p.id)" as NSString) : nil)
    }

    func image(_ p: PhotoItem, _ s: Size, network: Bool = true) async -> UIImage? {
        let key = "\(s.rawValue)/\(p.id)"
        if let m = memory.object(forKey: key as NSString) { return m }
        if let t = inflight[key] { return await t.value }
        let task = Task<UIImage?, Never> { [weak self] in
            guard let self else { return nil }
            return await self.load(p, s, network: network)
        }
        inflight[key] = task
        let img = await task.value
        inflight[key] = nil
        if let img { memory.setObject(img, forKey: key as NSString, cost: Int(img.size.width * img.size.height * img.scale * img.scale * 4)) }
        return img
    }

    private func load(_ p: PhotoItem, _ s: Size, network: Bool) async -> UIImage? {
        // 0. Linked iPhone album: straight from the Photos library (iCloud photos download on demand).
        if let id = p.assetId { return await Self.libraryImage(id, max: s.maxPixel) }
        // 1. Picked from this device's library.
        if let f = p.localFile {
            let url = Self.deviceDir.appending(path: f)
            return Self.downsample(url: url, max: s.maxPixel)
        }
        let file = fileURL(p, s)
        // 2. Already downloaded.
        if FileManager.default.fileExists(atPath: file.path) {
            touch(file)
            return Self.decode(file)
        }
        // Thumbnails and medium copies can be cut from a saved full photo without the network.
        if s != .full, FileManager.default.fileExists(atPath: fileURL(p, .full).path),
           let img = Self.downsample(url: fileURL(p, .full), max: s.maxPixel) {
            write(img, to: file, quality: 0.8)
            return img
        }
        guard network, let remote = (s == .thumb ? (p.thumbURL ?? p.fullURL) : p.fullURL) else { return nil }
        // 3. Download, shrink, save.
        do {
            let (data, resp) = try await MantelAPI.shared.fetch(URLRequest(url: remote))
            guard (resp as? HTTPURLResponse).map({ (200..<300).contains($0.statusCode) }) ?? true,
                  let img = Self.downsample(data: data, max: s.maxPixel) else { return nil }
            write(img, to: file, quality: s == .full ? 0.88 : 0.8)
            // Got the full photo while asking for a smaller one? Keep it, so offline has it too.
            if s == .medium, let full = Self.downsample(data: data, max: Size.full.maxPixel) { write(full, to: fileURL(p, .full), quality: 0.88) }
            return img
        } catch { return nil }
    }

    /// Download the full-size copy (and thumbnail) if it isn't saved yet. Returns true when it's on the device.
    func save(_ p: PhotoItem) async -> Bool {
        if p.localFile != nil || p.assetId != nil { return true }
        if FileManager.default.fileExists(atPath: fileURL(p, .full).path) { return true }
        let full = await image(p, .full)
        if full != nil { _ = await image(p, .thumb) }
        return full != nil
    }

    // MARK: Housekeeping

    func remove(_ p: PhotoItem) {
        for s in Size.allCases {
            try? FileManager.default.removeItem(at: fileURL(p, s))
            memory.removeObject(forKey: "\(s.rawValue)/\(p.id)" as NSString)
        }
    }

    func removeAlbum(_ id: String) {
        for s in Size.allCases { try? FileManager.default.removeItem(at: AppGroup.cache.appending(path: "\(s.rawValue)/\(id)")) }
        memory.removeAllObjects()
    }

    func removeAll() {
        for s in Size.allCases { try? FileManager.default.removeItem(at: AppGroup.cache.appending(path: s.rawValue)) }
        memory.removeAllObjects()
    }

    /// Bytes saved per album (downloads only).
    func usage() -> [String: Int64] {
        var out: [String: Int64] = [:]
        for s in Size.allCases {
            let root = AppGroup.cache.appending(path: s.rawValue)
            for album in (try? FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil)) ?? [] {
                out[album.lastPathComponent, default: 0] += Self.folderSize(album)
            }
        }
        return out
    }

    nonisolated static func deviceUsage() -> Int64 { folderSize(deviceDir) }

    /// Oldest-viewed photos go first when downloads pass the limit.
    func trim(to limit: Int64, keep: Set<String>) {
        let fm = FileManager.default
        var files: [(URL, Date, Int64)] = []
        var total: Int64 = 0
        let keys: [URLResourceKey] = [.contentModificationDateKey, .fileSizeKey]
        for s in Size.allCases {
            let root = AppGroup.cache.appending(path: s.rawValue)
            guard let e = fm.enumerator(at: root, includingPropertiesForKeys: keys) else { continue }
            for case let u as URL in e {
                guard let v = try? u.resourceValues(forKeys: Set(keys)), let size = v.fileSize else { continue }
                total += Int64(size)
                files.append((u, v.contentModificationDate ?? .distantPast, Int64(size)))
            }
        }
        guard total > limit else { return }
        for (u, _, size) in files.sorted(by: { $0.1 < $1.1 }) where total > limit {
            if keep.contains(u.deletingPathExtension().lastPathComponent) { continue }
            try? fm.removeItem(at: u); total -= size
        }
    }

    // MARK: Helpers

    private func touch(_ url: URL) {
        try? FileManager.default.setAttributes([.modificationDate: Date()], ofItemAtPath: url.path)
    }

    private func write(_ img: UIImage, to url: URL, quality: CGFloat) {
        AppGroup.dir(url.deletingLastPathComponent())
        if let d = img.jpegData(compressionQuality: quality) { try? d.write(to: url, options: .atomic) }
    }

    /// A Photos-library image at up to `max` pixels on the long side.
    nonisolated static func libraryImage(_ id: String, max: CGFloat) async -> UIImage? {
        guard let asset = PHAsset.fetchAssets(withLocalIdentifiers: [id], options: nil).firstObject else { return nil }
        let opts = PHImageRequestOptions()
        opts.deliveryMode = .highQualityFormat
        opts.resizeMode = .fast
        opts.isNetworkAccessAllowed = true
        opts.version = .current
        let scale = max / CGFloat(Swift.max(asset.pixelWidth, asset.pixelHeight, 1))
        let size = CGSize(width: CGFloat(asset.pixelWidth) * Swift.min(scale, 1), height: CGFloat(asset.pixelHeight) * Swift.min(scale, 1))
        return await withCheckedContinuation { cont in
            var done = false
            PHImageManager.default().requestImage(for: asset, targetSize: size, contentMode: .aspectFit, options: opts) { img, info in
                guard !done else { return }
                if (info?[PHImageResultIsDegradedKey] as? Bool) == true { return }
                done = true
                cont.resume(returning: img)
            }
        }
    }

    nonisolated static func folderSize(_ url: URL) -> Int64 {
        guard let e = FileManager.default.enumerator(at: url, includingPropertiesForKeys: [.totalFileAllocatedSizeKey, .fileSizeKey]) else { return 0 }
        var n: Int64 = 0
        for case let u as URL in e {
            let v = try? u.resourceValues(forKeys: [.totalFileAllocatedSizeKey, .fileSizeKey])
            n += Int64(v?.totalFileAllocatedSize ?? v?.fileSize ?? 0)
        }
        return n
    }

    nonisolated static func decode(_ url: URL) -> UIImage? {
        guard let src = CGImageSourceCreateWithURL(url as CFURL, nil),
              let cg = CGImageSourceCreateImageAtIndex(src, 0, [kCGImageSourceShouldCacheImmediately: true] as CFDictionary) else { return nil }
        return UIImage(cgImage: cg)
    }

    nonisolated static func downsample(url: URL, max: CGFloat) -> UIImage? {
        guard let src = CGImageSourceCreateWithURL(url as CFURL, [kCGImageSourceShouldCache: false] as CFDictionary) else { return nil }
        return downsample(src, max: max)
    }
    nonisolated static func downsample(data: Data, max: CGFloat) -> UIImage? {
        guard let src = CGImageSourceCreateWithData(data as CFData, [kCGImageSourceShouldCache: false] as CFDictionary) else { return nil }
        return downsample(src, max: max)
    }
    nonisolated static func downsample(_ src: CGImageSource, max: CGFloat) -> UIImage? {
        let opts: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,   // respects EXIF rotation
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceThumbnailMaxPixelSize: max,
        ]
        guard let cg = CGImageSourceCreateThumbnailAtIndex(src, 0, opts as CFDictionary) else { return nil }
        return UIImage(cgImage: cg)
    }
}

extension Int64 {
    var bytesText: String { ByteCountFormatter.string(fromByteCount: self, countStyle: .file) }
}
