import SwiftUI
import MediaPlayer
import CoreImage
import Observation

/// What's playing: Spotify (through your Mantel account, same as the web Cover Flow), or Apple Music on this iPhone.
@Observable @MainActor
final class NowPlaying {
    static let shared = NowPlaying()

    struct Track: Identifiable, Equatable {
        var id: String
        var name: String
        var artists: String
        var art: URL?
        var image: UIImage?
        var durationMs: Int
        static func == (a: Track, b: Track) -> Bool { a.id == b.id }
    }

    private(set) var history: [Track] = []
    private(set) var current: Track?
    private(set) var queue: [Track] = []
    private(set) var isPlaying = false
    private(set) var progressMs = 0
    private(set) var fetchedAt = Date()
    private(set) var source = ""
    private(set) var tint: Color = Color(hex: 0x1db954)

    /// Poll only while the mode is on screen, timed to the end of the song (Vercel Hobby budget).
    func run() async {
        while !Task.isCancelled {
            await load()
            let left = current.map { max(0, $0.durationMs - progressMs) } ?? 0
            let wait = current == nil ? 60.0 : (isPlaying ? min(max(Double(left) / 1000 + 2, 8), 45) : 30)
            do { try await Task.sleep(for: .seconds(wait)) } catch { break }
        }
    }

    func load() async {
        if Library.shared.signedIn, await loadSpotify() { return }
        loadAppleMusic()
    }

    private func loadSpotify() async -> Bool {
        struct T: Decodable { let id: String; let name: String; let artists: [String]; let albumArtUrl: String?; let durationMs: Int }
        struct R: Decodable { let current: T?; let queue: [T]?; let isPlaying: Bool?; let progressMs: Int? }
        guard let r: R = try? await MantelAPI.shared.get("api/spotify/now-playing"), let c = r.current else { return false }
        let map = { (t: T) in Track(id: t.id, name: t.name, artists: t.artists.joined(separator: ", "), art: t.albumArtUrl.flatMap(URL.init(string:)), durationMs: t.durationMs) }
        set(current: map(c), queue: (r.queue ?? []).prefix(8).map(map), playing: r.isPlaying ?? false, progress: r.progressMs ?? 0, source: "Spotify")
        return true
    }

    private func loadAppleMusic() {
        guard MPMediaLibrary.authorizationStatus() == .authorized else {
            if MPMediaLibrary.authorizationStatus() == .notDetermined { MPMediaLibrary.requestAuthorization { _ in } }
            if source != "Spotify" { current = nil }
            return
        }
        let mp = MPMusicPlayerController.systemMusicPlayer
        guard let item = mp.nowPlayingItem else { if source != "Spotify" { current = nil }; return }
        let t = Track(id: "am-\(item.persistentID)", name: item.title ?? "Unknown", artists: item.artist ?? "",
                      image: item.artwork?.image(at: CGSize(width: 600, height: 600)), durationMs: Int(item.playbackDuration * 1000))
        set(current: t, queue: [], playing: mp.playbackState == .playing, progress: Int(mp.currentPlaybackTime * 1000), source: "Apple Music")
    }

    private func set(current c: Track, queue q: [Track], playing: Bool, progress: Int, source s: String) {
        if let old = current, old.id != c.id {
            history.removeAll { $0.id == old.id || $0.id == c.id }
            history.append(old)
            history = Array(history.suffix(8))
        }
        withAnimation(.spring(response: 0.7, dampingFraction: 0.85)) {
            current = c; queue = q.filter { $0.id != c.id }
        }
        isPlaying = playing; progressMs = progress; fetchedAt = Date(); source = s
        Task { await updateTint(c) }
    }

    /// The album art's average colour, for the background (like the web's dominant colour).
    private func updateTint(_ t: Track) async {
        var img = t.image
        if img == nil, let u = t.art, let (d, _) = try? await MantelAPI.shared.fetch(URLRequest(url: u)) { img = UIImage(data: d) }
        guard let cg = img?.cgImage else { return }
        let ci = CIImage(cgImage: cg)
        guard let f = CIFilter(name: "CIAreaAverage", parameters: [kCIInputImageKey: ci, kCIInputExtentKey: CIVector(cgRect: ci.extent)]),
              let out = f.outputImage else { return }
        var px = [UInt8](repeating: 0, count: 4)
        CIContext().render(out, toBitmap: &px, rowBytes: 4, bounds: CGRect(x: 0, y: 0, width: 1, height: 1), format: .RGBA8, colorSpace: CGColorSpaceCreateDeviceRGB())
        withAnimation(.easeInOut(duration: 1.2)) { tint = Color(red: Double(px[0]) / 255, green: Double(px[1]) / 255, blue: Double(px[2]) / 255) }
    }
}

/// Cover Flow: your music's album art in a 3D carousel — history on the left, now playing in front, up next on the right.
struct CoverFlowMode: View {
    let landscape: Bool
    @State private var np = NowPlaying.shared

    var body: some View {
        let tracks = np.history + (np.current.map { [$0] } ?? []) + np.queue
        let center = np.history.count
        GeometryReader { g in
            let side = min(g.size.width * (landscape ? 0.34 : 0.62), g.size.height * (landscape ? 0.62 : 0.42))
            ZStack {
                Color.black
                LinearGradient(colors: [np.tint.opacity(0.85), np.tint.opacity(0.35), .black], startPoint: .top, endPoint: .bottom)
                if np.current == nil {
                    VStack(spacing: 12) {
                        Image(systemName: "music.note").font(.system(size: 44, weight: .semibold))
                        Text("Nothing playing").font(.figtree(24, .extrabold))
                        Text("Play something on Spotify (connect it on mantelapp.vercel.app) or in Apple Music on this iPhone.")
                            .font(.figtree(15, .medium)).multilineTextAlignment(.center).opacity(0.7).frame(maxWidth: 320)
                    }
                    .foregroundStyle(.white)
                } else {
                    VStack(spacing: landscape ? 18 : 30) {
                        ZStack {
                            ForEach(Array(tracks.enumerated()), id: \.element.id) { i, t in
                                let d = Double(i - center)
                                if abs(d) < 5 {
                                    cover(t, side: side)
                                        .rotation3DEffect(.degrees(max(-60, min(60, -d * 60))), axis: (0, 1, 0), perspective: 0.6)
                                        .scaleEffect(d == 0 ? 1 : 0.8)
                                        .offset(x: CGFloat(d.sign == .minus ? -1 : 1) * (abs(d) < 1 ? 0 : side * 0.7 + (abs(d) - 1) * side * 0.26))
                                        .zIndex(10 - abs(d))
                                }
                            }
                        }
                        .frame(height: side * 1.25)
                        info
                    }
                }
            }
            .frame(width: g.size.width, height: g.size.height)
        }
        .task { await np.run() }
    }

    private func cover(_ t: NowPlaying.Track, side: CGFloat) -> some View {
        let art = Group {
            if let img = t.image { Image(uiImage: img).resizable().scaledToFill() } else { RemoteImage(url: t.art) }
        }
        return VStack(spacing: 2) {
            art.frame(width: side, height: side).clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                .shadow(color: .black.opacity(0.4), radius: 20, y: 12)
            art.frame(width: side, height: side).clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                .scaleEffect(x: 1, y: -1)
                .frame(width: side, height: side * 0.25, alignment: .top).clipped()
                .mask(LinearGradient(colors: [.white.opacity(0.3), .clear], startPoint: .top, endPoint: .bottom))
        }
    }

    private var info: some View {
        VStack(spacing: 6) {
            Text(np.current?.name ?? "").font(.figtree(24, .extrabold)).lineLimit(1)
            Text(np.current?.artists ?? "").font(.figtree(16, .semibold)).opacity(0.75).lineLimit(1)
            TimelineView(.periodic(from: .now, by: 1)) { ctx in
                let elapsed = np.isPlaying ? Int(ctx.date.timeIntervalSince(np.fetchedAt) * 1000) : 0
                let p = Double(min(np.progressMs + elapsed, np.current?.durationMs ?? 1)) / Double(max(np.current?.durationMs ?? 1, 1))
                Capsule().fill(.white.opacity(0.2)).frame(width: 220, height: 4)
                    .overlay(alignment: .leading) { Capsule().fill(.white).frame(width: 220 * p, height: 4) }
                    .padding(.top, 8)
            }
            Label(np.source + (np.isPlaying ? "" : " · paused"), systemImage: np.source == "Spotify" ? "dot.radiowaves.left.and.right" : "music.note")
                .font(.figtree(12, .bold)).opacity(0.6).padding(.top, 4)
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 30)
        .shadow(color: .black.opacity(0.3), radius: 8)
    }
}
