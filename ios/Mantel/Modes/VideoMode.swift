import SwiftUI
import AVFoundation
import Photos

/// Mantel videos saved for offline (Caches/Mantel/video). iPhone videos play straight from Photos.
/// Capped at 30% of the download limit; least recently played go first.
enum VideoCache {
    static var dir: URL { AppGroup.dir(AppGroup.cache.appending(path: "video")) }
    static func file(_ p: PhotoItem) -> URL { dir.appending(path: "\(p.id).mp4") }
    static func isSaved(_ p: PhotoItem) -> Bool { FileManager.default.fileExists(atPath: file(p).path) }

    /// Something AVPlayer can play: Photos asset, saved file, or the stream.
    static func item(for p: PhotoItem) async -> AVPlayerItem? {
        if let id = p.assetId {
            guard let asset = PHAsset.fetchAssets(withLocalIdentifiers: [id], options: nil).firstObject else { return nil }
            let opts = PHVideoRequestOptions()
            opts.isNetworkAccessAllowed = true
            opts.deliveryMode = .mediumQualityFormat
            return await withCheckedContinuation { cont in
                PHImageManager.default().requestPlayerItem(forVideo: asset, options: opts) { item, _ in cont.resume(returning: item) }
            }
        }
        if isSaved(p) {
            try? FileManager.default.setAttributes([.modificationDate: Date()], ofItemAtPath: file(p).path)   // LRU
            return AVPlayerItem(url: file(p))
        }
        return p.videoURL.map { AVPlayerItem(url: $0) }
    }

    static func prefetch(_ list: [PhotoItem]) async {
        let limit = await MainActor.run { Int64(Prefs.shared.cacheLimitMB) * 1024 * 1024 * 3 / 10 }
        await VideoStore.shared.prefetch(list, limit: limit)
    }

    static func usage() -> Int64 { ImageCache.folderSize(dir) }
    static func removeAll() { try? FileManager.default.removeItem(at: dir) }
    static func remove(_ list: [PhotoItem]) { for p in list { try? FileManager.default.removeItem(at: file(p)) } }
}

/// Downloads one clip at a time; never the same clip twice at once.
actor VideoStore {
    static let shared = VideoStore()
    private var inflight = Set<String>()

    func prefetch(_ list: [PhotoItem], limit: Int64) async {
        for p in list where p.assetId == nil && !VideoCache.isSaved(p) && !inflight.contains(p.id) {
            guard let u = p.videoURL, VideoCache.usage() < limit else { break }
            inflight.insert(p.id)
            defer { inflight.remove(p.id) }
            guard let (tmp, resp) = try? await URLSession.shared.download(from: u),
                  (resp as? HTTPURLResponse)?.statusCode == 200 else { continue }
            let size = (try? FileManager.default.attributesOfItem(atPath: tmp.path)[.size] as? Int64) ?? 0
            if size > 120 << 20 { try? FileManager.default.removeItem(at: tmp); continue }
            try? FileManager.default.moveItem(at: tmp, to: VideoCache.file(p))
        }
        trim(limit)
    }

    /// Oldest-played clips go first when over the limit.
    private func trim(_ limit: Int64) {
        let keys: [URLResourceKey] = [.contentModificationDateKey, .fileSizeKey]
        guard let files = try? FileManager.default.contentsOfDirectory(at: VideoCache.dir, includingPropertiesForKeys: keys) else { return }
        var list = files.compactMap { u -> (URL, Date, Int64)? in
            guard let v = try? u.resourceValues(forKeys: Set(keys)) else { return nil }
            return (u, v.contentModificationDate ?? .distantPast, Int64(v.fileSize ?? 0))
        }
        var total = list.reduce(0) { $0 + $1.2 }
        list.sort { $0.1 < $1.1 }
        for (u, _, size) in list where total > limit { try? FileManager.default.removeItem(at: u); total -= size }
    }
}

/// Silent looping clips from your albums, like the web Video mode.
struct VideoMode: View {
    let landscape: Bool
    @Environment(Library.self) private var library
    @Environment(Prefs.self) private var prefs
    @Environment(Player.self) private var player
    @State private var index = 0

    enum Look: String, CaseIterable, Identifiable { case normal, grid, film, oldtv
        var id: String { rawValue }
        var title: String { switch self { case .normal: "Normal"; case .grid: "Grid"; case .film: "Film"; case .oldtv: "Old TV" } }
    }

    var body: some View {
        let clips = library.videoPlaylist
        let look = Look(rawValue: prefs.videoLook) ?? .normal
        ZStack {
            Color.black
            if clips.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "film.stack").font(.system(size: 40, weight: .semibold))
                    Text("No videos yet").font(.figtree(22, .extrabold))
                    Text("Add videos to an album on mantelapp.vercel.app, or link an iPhone album that has videos (Albums → +).")
                        .font(.figtree(15, .medium)).multilineTextAlignment(.center).opacity(0.7).frame(maxWidth: 320)
                }
                .foregroundStyle(.white)
            } else if look == .grid {
                // 2–3 clips: stacked to fill the screen; 4+: a grid.
                let n = min(clips.count, landscape ? 6 : 4)
                let cols = n >= 4 ? (landscape ? 3 : 2) : (landscape ? n : 1)
                let rows = Int(ceil(Double(n) / Double(cols)))
                GeometryReader { g in
                    let w = (g.size.width - CGFloat(cols - 1) * 3) / CGFloat(cols)
                    let h = (g.size.height - CGFloat(rows - 1) * 3) / CGFloat(rows)
                    VStack(spacing: 3) {
                        ForEach(0..<rows, id: \.self) { r in
                            HStack(spacing: 3) {
                                ForEach(0..<cols, id: \.self) { c in
                                    let i = r * cols + c
                                    if i < n {
                                        ClipView(clip: clips[(index + i) % clips.count], loop: true, paused: player.paused) { }
                                            .frame(width: w, height: h).clipped()
                                    }
                                }
                            }
                        }
                    }
                }
            } else {
                ClipView(clip: clips[index % clips.count], loop: clips.count == 1, paused: player.paused) {
                    withAnimation(.easeInOut(duration: 0.8)) { index += 1 }
                }
                .id(clips[index % clips.count].id)
                .transition(.opacity)
                .overlay { if look == .film { FilmLook() } else if look == .oldtv { OldTVLook() } }
            }
        }
        .ignoresSafeArea()
        .task(id: look == .grid) {
            guard look == .grid else { return }
            while !Task.isCancelled {   // rotate the grid's clips now and then
                do { try await Task.sleep(for: .seconds(max(20, prefs.interval * 3))) } catch { break }
                withAnimation(.easeInOut(duration: 1)) { index += 1 }
            }
        }
    }
}

/// One muted clip, aspect-filled.
struct ClipView: View {
    let clip: PhotoItem
    var loop: Bool
    var paused: Bool
    var onEnd: () -> Void
    @State private var avPlayer = AVPlayer()
    @State private var ready = false
    @State private var endObserver: NSObjectProtocol?

    var body: some View {
        ZStack {
            ModeImage(photo: clip, size: .medium)   // poster while loading
            PlayerLayerView(player: avPlayer).opacity(ready ? 1 : 0)
        }
        .task(id: clip.id) {
            guard let item = await VideoCache.item(for: clip) else { onEnd(); return }
            avPlayer.isMuted = true
            avPlayer.replaceCurrentItem(with: item)
            avPlayer.actionAtItemEnd = loop ? .none : .pause
            if let o = endObserver { NotificationCenter.default.removeObserver(o) }
            endObserver = NotificationCenter.default.addObserver(forName: AVPlayerItem.didPlayToEndTimeNotification, object: item, queue: .main) { _ in
                Task { @MainActor in
                    if loop { avPlayer.seek(to: .zero); avPlayer.play() } else { onEnd() }
                }
            }
            if !paused { avPlayer.play() }
            withAnimation(.easeIn(duration: 0.4)) { ready = true }
        }
        .onChange(of: paused) { _, p in p ? avPlayer.pause() : avPlayer.play() }
        .onDisappear {
            avPlayer.pause()
            if let o = endObserver { NotificationCenter.default.removeObserver(o) }
        }
    }
}

struct PlayerLayerView: UIViewRepresentable {
    let player: AVPlayer
    func makeUIView(context: Context) -> PlayerUIView { let v = PlayerUIView(); v.playerLayer.player = player; return v }
    func updateUIView(_ v: PlayerUIView, context: Context) { v.playerLayer.player = player }
    final class PlayerUIView: UIView {
        override class var layerClass: AnyClass { AVPlayerLayer.self }
        var playerLayer: AVPlayerLayer { layer as! AVPlayerLayer }
        override init(frame: CGRect) { super.init(frame: frame); playerLayer.videoGravity = .resizeAspectFill; backgroundColor = .clear }
        required init?(coder: NSCoder) { fatalError() }
    }
}

/// Warm film: sepia wash, grain that flickers, soft vignette.
struct FilmLook: View {
    var body: some View {
        TimelineView(.periodic(from: .now, by: 1 / 12)) { ctx in
            Canvas { g, size in
                var rng = SeededRNG(seed: UInt64(ctx.date.timeIntervalSince1970 * 12))
                for _ in 0..<900 {
                    let r = CGRect(x: .random(in: 0...size.width, using: &rng), y: .random(in: 0...size.height, using: &rng), width: 1.4, height: 1.4)
                    g.fill(Path(ellipseIn: r), with: .color(Color.white.opacity(Double.random(in: 0.05...0.18, using: &rng))))
                }
            }
        }
        .background(Rectangle().fill(Color(hex: 0x704214, alpha: 0.22)).blendMode(.overlay))
        .overlay(RadialGradient(colors: [.clear, .black.opacity(0.55)], center: .center, startRadius: 200, endRadius: 700))
        .allowsHitTesting(false)
    }
}

/// Old TV: scanlines, rounded glass, vignette.
struct OldTVLook: View {
    var body: some View {
        ZStack {
            Canvas { g, size in
                var y: CGFloat = 0
                while y < size.height { g.fill(Path(CGRect(x: 0, y: y, width: size.width, height: 1.2)), with: .color(.black.opacity(0.28))); y += 3.5 }
            }
            RadialGradient(colors: [.clear, .black.opacity(0.75)], center: .center, startRadius: 150, endRadius: 650)
            RoundedRectangle(cornerRadius: 60, style: .continuous).strokeBorder(.black, lineWidth: 40).blur(radius: 12)
        }
        .allowsHitTesting(false)
    }
}

struct SeededRNG: RandomNumberGenerator {
    var state: UInt64
    init(seed: UInt64) { state = seed &+ 0x9E3779B97F4A7C15 }
    mutating func next() -> UInt64 { state &+= 0x9E3779B97F4A7C15; var z = state; z = (z ^ (z >> 30)) &* 0xBF58476D1CE4E5B9; z = (z ^ (z >> 27)) &* 0x94D049BB133111EB; return z ^ (z >> 31) }
}
