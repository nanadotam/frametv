import Foundation
import SwiftUI
import AVFoundation
import Photos
import PhotosUI
import CoreTransferable
import UniformTypeIdentifiers

/// A video picked with PhotosPicker, copied to a temp file.
struct PickedMovie: Transferable {
    let url: URL
    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(contentType: .movie) { SentTransferredFile($0.url) } importing: { received in
            let dest = FileManager.default.temporaryDirectory.appending(path: "\(UUID().uuidString).\(received.file.pathExtension)")
            try FileManager.default.copyItem(at: received.file, to: dest)
            return PickedMovie(url: dest)
        }
    }
}

/// Something to put in an album: a photo (data) or a video (file).
enum Pick {
    case photo(Data, Date?)
    case video(URL, Date?)
}

/// Reads PhotosPicker items as photos or videos.
func loadMixedPicks(_ items: [PhotosPickerItem]) async -> [Pick] {
    var out: [Pick] = []
    for it in items {
        if it.supportedContentTypes.contains(where: { $0.conforms(to: .movie) }) {
            if let m = try? await it.loadTransferable(type: PickedMovie.self) { out.append(.video(m.url, nil)) }
        } else if let d = try? await it.loadTransferable(type: Data.self) {
            out.append(.photo(d, exifDate(d)))
        }
    }
    return out
}

/// Prepares media for the archive the way the web uploader does: photos ≤2048 px JPEG, videos ≤1080p H.264 MP4 + poster.
enum MediaPrep {
    /// ≤1080p MP4 (H.264, fast start) from any video file.
    static func mp4(from url: URL) async throws -> URL {
        let asset = AVURLAsset(url: url)
        return try await export(asset)
    }

    static func mp4(fromAsset id: String) async throws -> URL {
        guard let ph = PHAsset.fetchAssets(withLocalIdentifiers: [id], options: nil).firstObject else { throw URLError(.fileDoesNotExist) }
        let opts = PHVideoRequestOptions()
        opts.isNetworkAccessAllowed = true
        opts.deliveryMode = .highQualityFormat
        let av: AVAsset? = await withCheckedContinuation { c in
            PHImageManager.default().requestAVAsset(forVideo: ph, options: opts) { a, _, _ in c.resume(returning: a) }
        }
        guard let av else { throw URLError(.cannotOpenFile) }
        return try await export(av)
    }

    private static func export(_ asset: AVAsset) async throws -> URL {
        let out = FileManager.default.temporaryDirectory.appending(path: "\(UUID().uuidString).mp4")
        guard let s = AVAssetExportSession(asset: asset, presetName: AVAssetExportPreset1920x1080) else { throw URLError(.cannotCreateFile) }
        s.shouldOptimizeForNetworkUse = true
        try await s.export(to: out, as: .mp4)
        return out
    }

    /// Poster frame (JPEG), size and duration of a video file.
    static func poster(_ url: URL) async -> (jpeg: Data, width: Int, height: Int, durationMs: Int)? {
        let asset = AVURLAsset(url: url)
        let gen = AVAssetImageGenerator(asset: asset)
        gen.appliesPreferredTrackTransform = true
        gen.maximumSize = CGSize(width: 1280, height: 1280)
        guard let (cg, _) = try? await gen.image(at: CMTime(seconds: 0.5, preferredTimescale: 600)),
              let jpeg = UIImage(cgImage: cg).jpegData(compressionQuality: 0.82) else { return nil }
        let dur = (try? await asset.load(.duration)).map { Int(CMTimeGetSeconds($0) * 1000) } ?? 0
        var w = cg.width, h = cg.height
        if let track = try? await asset.loadTracks(withMediaType: .video).first,
           let size = try? await track.load(.naturalSize), let t = try? await track.load(.preferredTransform) {
            let r = CGRect(origin: .zero, size: size).applying(t)
            w = Int(abs(r.width)); h = Int(abs(r.height))
        }
        return (jpeg, w, h, dur)
    }
}

extension Library {
    /// Mantel albums you can upload to.
    var uploadAlbums: [AlbumItem] { albums.filter(\.acceptsUploads) }

    /// Adds picked photos and videos to an album. Mantel upload albums: everything goes up to the archive.
    /// Device albums: photos are kept on this iPhone (videos need a Mantel or linked album).
    func addMixed(_ picks: [Pick], to album: AlbumItem, progress: @escaping (Int) -> Void) async {
        var photosOnly: [(data: Data, date: Date?)] = []
        var videoFiles: [(URL, Date?)] = []
        for p in picks {
            switch p { case .photo(let d, let date): photosOnly.append((d, date)); case .video(let u, let date): videoFiles.append((u, date)) }
        }
        if !photosOnly.isEmpty { await add(photosOnly, to: album) { progress($0) } }
        guard !videoFiles.isEmpty else { return }
        guard album.kind == .cloud else {
            toast = "Videos go in a Mantel album or a linked iPhone album"
            return
        }
        var done = 0, failed = 0
        for (i, (url, date)) in videoFiles.enumerated() {
            progress(photosOnly.count + i)
            toast = "Preparing video \(i + 1) of \(videoFiles.count)…"
            do {
                let mp4 = try await MediaPrep.mp4(from: url)
                try await uploadVideoFile(mp4, date: date, to: album)
                try? FileManager.default.removeItem(at: url)
                done += 1
            } catch { failed += 1; toast = (error as? LocalizedError)?.errorDescription ?? "A video couldn't be uploaded" }
        }
        progress(picks.count)
        if failed == 0 { toast = done == 1 ? "Video uploaded" : "\(done) videos uploaded" }
    }

    private func uploadVideoFile(_ mp4: URL, date: Date?, to album: AlbumItem) async throws {
        defer { try? FileManager.default.removeItem(at: mp4) }
        guard let poster = await MediaPrep.poster(mp4) else { throw URLError(.cannotDecodeContentData) }
        let item = try await MantelAPI.shared.uploadVideo(mp4: mp4, poster: poster.jpeg, width: poster.width, height: poster.height,
                                                         durationMs: poster.durationMs, takenAt: date, album: album.id, name: nil)
        appendVideo(item)
    }

    /// "Update the archive": copies photos/videos from a linked or on-device album up to a Mantel album.
    /// The originals stay where they are.
    func archive(_ items: [PhotoItem], to album: AlbumItem, progress: @escaping (Int, Int) -> Void) async {
        var ok = 0, failed = 0
        for (i, p) in items.enumerated() {
            progress(i, items.count)
            do {
                if p.video {
                    guard let id = p.assetId else { failed += 1; continue }
                    let mp4 = try await MediaPrep.mp4(fromAsset: id)
                    try await uploadVideoFile(mp4, date: p.takenAt, to: album)
                } else {
                    guard let img = await ImageCache.shared.image(p, .full, network: false),
                          let jpeg = img.jpegData(compressionQuality: 0.88) else { failed += 1; continue }
                    await add([(jpeg, p.takenAt)], to: album) { _ in }
                }
                ok += 1
            } catch { failed += 1 }
        }
        progress(items.count, items.count)
        await refresh(quiet: true)
        toast = failed == 0 ? "Uploaded \(ok) to \(album.name)" : "Uploaded \(ok), \(failed) didn't go through"
    }
}

/// Choose (or create) the Mantel album to upload into.
struct UploadTargetSheet: View {
    let items: [PhotoItem]
    var onDone: () -> Void = {}
    @Environment(Library.self) private var library
    @Environment(\.dismiss) private var dismiss
    @State private var newName = ""
    @State private var busy: (Int, Int)?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Kicker("Update the archive", icon: "icloud.and.arrow.up")
                Display("Upload \(items.count) to *Mantel*", size: 28)
                Text("Copies go to your Mantel account so your TV, Mac and the web show them too. The originals stay on this iPhone. Videos are converted to 1080p first.")
                    .font(.figtree(15, .medium)).foregroundStyle(Clean.label)
                if !library.signedIn {
                    SignInNudge()
                } else if let b = busy {
                    HStack(spacing: 12) {
                        Ring(value: Double(b.0) / Double(max(b.1, 1))).frame(width: 26, height: 26)
                        Text("Uploading \(min(b.0 + 1, b.1)) of \(b.1)…").font(.figtree(16, .bold)).foregroundStyle(Clean.ink)
                    }
                    .card(padding: 16)
                } else {
                    VStack(spacing: 0) {
                        ForEach(library.uploadAlbums) { a in
                            Button { Task { await go(a) } } label: {
                                Row(icon: "photo.stack", title: a.name, subtitle: "\(library.count(a.id)) photos · \(library.videoCount(a.id)) videos") {
                                    Image(systemName: "arrow.up.circle.fill").font(.system(size: 22)).foregroundStyle(Clean.cherry)
                                }
                                .padding(.horizontal, 6).padding(.vertical, 6)
                            }
                            .buttonStyle(.plain)
                            Divider().overlay(Clean.line)
                        }
                        HStack(spacing: 10) {
                            TextField("New album name", text: $newName).font(.figtree(16, .medium))
                                .padding(.horizontal, 12).frame(height: 44)
                                .background(RoundedRectangle(cornerRadius: Clean.fieldRadius).fill(Clean.field))
                            Button("Create") {
                                Task { if let a = await library.newCloudAlbum(newName) { await go(a) } }
                            }
                            .buttonStyle(CleanButton(kind: .primary, size: 44, block: false))
                            .disabled(newName.trimmingCharacters(in: .whitespaces).isEmpty)
                        }
                        .padding(.top, 12)
                    }
                    .card(padding: 14)
                }
            }
            .padding(24)
        }
        .background(Clean.appBg.ignoresSafeArea())
        .presentationDetents([.medium, .large])
        .presentationCornerRadius(28)
        .interactiveDismissDisabled(busy != nil)
    }

    private func go(_ a: AlbumItem) async {
        busy = (0, items.count)
        await library.archive(items, to: a) { busy = ($0, $1) }
        busy = nil
        onDone()
        dismiss()
    }
}
