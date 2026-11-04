import SwiftUI

/// A photo loaded from the device (or the network if online), fading in.
struct ModeImage: View {
    let photo: PhotoItem
    var size: ImageCache.Size = .medium
    var fill = true
    @State private var image: UIImage?
    var body: some View {
        Color.clear
            .overlay {
                if let image {
                    Image(uiImage: image).resizable().aspectRatio(contentMode: fill ? .fill : .fit).transition(.opacity)
                }
            }
            .clipped()
            .task(id: photo.id) {
                if let m = ImageCache.shared.cached(photo, size) { image = m; return }
                let img = await ImageCache.shared.image(photo, size, network: Library.shared.online)
                withAnimation(.easeInOut(duration: 0.6)) { image = img }
            }
    }
}

/// The photos the photo modes draw from: the player's current order (your showing albums).
@MainActor private func source() -> [PhotoItem] {
    let p = Player.shared.photos
    return p.isEmpty ? Library.shared.playlist.shuffled() : p
}

// MARK: - Grid

/// A mosaic that reshapes itself: 4 photos, then 3 (one big), then 6, 2, 5, 9…, depending on how many photos you have.
/// Between layout changes, single tiles swap to new photos.
struct GridMode: View {
    let landscape: Bool
    @Environment(Prefs.self) private var prefs
    @Environment(Player.self) private var player
    @State private var tiles: [PhotoItem] = []
    @State private var layout = 0
    @State private var cursor = 0

    /// Tile rectangles in unit space, drawn for a tall (portrait) screen; landscape swaps x/y.
    static let layouts: [[CGRect]] = [
        grid(2, 2),                                                                         // 4
        [CGRect(x: 0, y: 0, width: 1, height: 0.6)] + row(y: 0.6, h: 0.4, n: 2),           // 3: one big + two
        grid(2, 3),                                                                         // 6
        [CGRect(x: 0, y: 0, width: 1, height: 0.5), CGRect(x: 0, y: 0.5, width: 1, height: 0.5)],   // 2
        [CGRect(x: 0, y: 0, width: 1, height: 0.5)] + grid(2, 2).map { CGRect(x: $0.minX, y: 0.5 + $0.minY / 2, width: $0.width, height: $0.height / 2) }, // 5
        [CGRect(x: 0, y: 0, width: 0.62, height: 0.5), CGRect(x: 0.62, y: 0, width: 0.38, height: 0.25),
         CGRect(x: 0.62, y: 0.25, width: 0.38, height: 0.25)] + row(y: 0.5, h: 0.5, n: 2), // 5b: editorial
        grid(3, 3),                                                                         // 9
        grid(3, 4),                                                                         // 12
    ]
    static func grid(_ c: Int, _ r: Int) -> [CGRect] {
        (0..<r).flatMap { y in (0..<c).map { x in CGRect(x: CGFloat(x) / CGFloat(c), y: CGFloat(y) / CGFloat(r), width: 1 / CGFloat(c), height: 1 / CGFloat(r)) } }
    }
    static func row(y: CGFloat, h: CGFloat, n: Int) -> [CGRect] {
        (0..<n).map { CGRect(x: CGFloat($0) / CGFloat(n), y: y, width: 1 / CGFloat(n), height: h) }
    }

    private var available: [Int] {
        let n = source().count
        let ok = Self.layouts.indices.filter { Self.layouts[$0].count <= max(n, 1) }
        return ok.isEmpty ? [3] : ok
    }

    var body: some View {
        GeometryReader { g in
            let rects = Self.layouts[layout]
            ZStack(alignment: .topLeading) {
                ForEach(0..<rects.count, id: \.self) { i in
                    let r = landscape ? CGRect(x: rects[i].minY, y: rects[i].minX, width: rects[i].height, height: rects[i].width) : rects[i]
                    let frame = CGRect(x: r.minX * g.size.width, y: r.minY * g.size.height, width: r.width * g.size.width, height: r.height * g.size.height).insetBy(dx: 1.5, dy: 1.5)
                    Group {
                        if i < tiles.count { ModeImage(photo: tiles[i], size: r.width * r.height > 0.2 ? .medium : .thumb).id(tiles[i].id).transition(.opacity) }
                        else { Color.white.opacity(0.04) }
                    }
                    .frame(width: frame.width, height: frame.height)
                    .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))
                    .offset(x: frame.minX, y: frame.minY)
                    .transition(.scale(scale: 0.85).combined(with: .opacity))
                }
            }
        }
        .background(Color.black)
        .onAppear { if tiles.isEmpty { layout = available.first ?? 0; fill() } }
        .task(id: player.paused) {
            guard !player.paused else { return }
            var step = 0
            while !Task.isCancelled {
                do { try await Task.sleep(for: .seconds(max(2.5, prefs.interval / 3))) } catch { break }
                step += 1
                if step % 4 == 0 { reshape() } else { swapOne() }
            }
        }
    }

    private func fill() {
        let all = source()
        guard !all.isEmpty else { return }
        tiles = (0..<12).map { all[(cursor + $0) % all.count] }
        cursor += 12
    }

    /// Next layout (never the same twice), with fresh photos.
    private func reshape() {
        let options = available.filter { $0 != layout }
        guard let next = options.randomElement() else { swapOne(); return }
        let all = source()
        withAnimation(.spring(response: 0.8, dampingFraction: 0.85)) {
            layout = next
            if !all.isEmpty { tiles = (0..<12).map { all[(cursor + $0) % all.count] }; cursor += Self.layouts[next].count }
        }
    }

    private func swapOne() {
        let all = source()
        let n = Self.layouts[layout].count
        guard n > 0, all.count > n else { return }
        let i = Int.random(in: 0..<n)
        let next = all[cursor % all.count]; cursor += 1
        withAnimation(.easeInOut(duration: 1.2)) { tiles[i] = next }
    }
}

// MARK: - Pinterest

/// Masonry columns drifting slowly, each at its own speed.
struct PinterestMode: View {
    let landscape: Bool
    @Environment(Player.self) private var player
    @State private var columns: [[PhotoItem]] = []
    @State private var start = Date()
    @State private var pausedAt: Date?

    var body: some View {
        GeometryReader { g in
            let pad = UIDevice.current.userInterfaceIdiom == .pad
            let n = landscape ? (pad ? 5 : 4) : (pad ? 3 : 2)
            let gap: CGFloat = 8
            let w = (g.size.width - gap * CGFloat(n + 1)) / CGFloat(n)
            TimelineView(.animation(minimumInterval: 1 / 30, paused: player.paused)) { ctx in
                let t = (pausedAt ?? ctx.date).timeIntervalSince(start)
                HStack(alignment: .top, spacing: gap) {
                    ForEach(Array(columns.enumerated()), id: \.offset) { ci, col in
                        let height = columnHeight(col, w: w, gap: gap)
                        let speed = 14.0 + Double(ci % 3) * 6          // points per second
                        let offset = height > 0 ? CGFloat((t * speed).truncatingRemainder(dividingBy: Double(height))) : 0
                        VStack(spacing: gap) {
                            ForEach(0..<2, id: \.self) { copy in        // drawn twice for a seamless loop
                                VStack(spacing: gap) {
                                    ForEach(col) { p in
                                        ModeImage(photo: p, size: n <= 2 ? .medium : .thumb)
                                            .frame(width: w, height: w / clampAspect(p.aspect))
                                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                                    }
                                }
                                .id(copy)
                            }
                        }
                        .offset(y: -offset)
                        .frame(width: w, height: g.size.height, alignment: .top)
                        .clipped()
                    }
                }
                .padding(.horizontal, gap)
            }
            .onAppear { layout(n) }
            .onChange(of: n) { _, k in layout(k) }
        }
        .background(Color(hex: 0x111111))
        .onChange(of: player.paused) { _, p in
            if p { pausedAt = Date() } else if let pa = pausedAt { start = start.addingTimeInterval(Date().timeIntervalSince(pa)); pausedAt = nil }
        }
    }

    private func clampAspect(_ a: CGFloat) -> CGFloat { min(max(a, 0.6), 1.6) }

    private func columnHeight(_ col: [PhotoItem], w: CGFloat, gap: CGFloat) -> CGFloat {
        col.reduce(0) { $0 + w / clampAspect($1.aspect) + gap }
    }

    /// Shortest-column-first, like CSS masonry. Capped so memory stays small.
    private func layout(_ n: Int) {
        let all = Array(source().prefix(n * 9))
        var cols = Array(repeating: [PhotoItem](), count: n), heights = Array(repeating: CGFloat(0), count: n)
        for p in all {
            let i = heights.indices.min { heights[$0] < heights[$1] }!
            cols[i].append(p); heights[i] += 1 / clampAspect(p.aspect)
        }
        columns = cols
        start = Date()
    }
}

// MARK: - Scrapbook

/// Polaroids dropped and taped onto a paper backdrop, the newest on top.
struct ScrapbookMode: View {
    @Environment(Prefs.self) private var prefs
    @Environment(Player.self) private var player
    struct Pin: Identifiable, Equatable { let id = UUID(); let photo: PhotoItem; let x: CGFloat; let y: CGFloat; let angle: Double; let tape: Double }
    @State private var pins: [Pin] = []
    @State private var cursor = 0

    var body: some View {
        GeometryReader { g in
            let short = min(g.size.width, g.size.height)
            let card = short * (UIDevice.current.userInterfaceIdiom == .pad ? 0.36 : 0.52)
            ZStack {
                paper
                ForEach(pins) { pin in
                    polaroid(pin, width: card)
                        .position(x: pin.x * g.size.width, y: pin.y * g.size.height)
                        .transition(.asymmetric(insertion: .scale(scale: 1.6).combined(with: .opacity), removal: .opacity))
                }
            }
        }
        .task(id: player.paused) {
            if pins.isEmpty { for _ in 0..<4 { drop(animated: false) } }
            guard !player.paused else { return }
            while !Task.isCancelled {
                do { try await Task.sleep(for: .seconds(max(3, prefs.interval * 0.7))) } catch { break }
                drop(animated: true)
            }
        }
    }

    private var paper: some View {
        ZStack {
            Color(hex: 0xe9dfcc)
            RadialGradient(colors: [.white.opacity(0.35), .clear], center: .center, startRadius: 0, endRadius: 600)
            Canvas { ctx, size in   // light speckle, like card stock
                var rng = SystemRandomNumberGenerator()
                for _ in 0..<500 {
                    let r = CGRect(x: .random(in: 0...size.width, using: &rng), y: .random(in: 0...size.height, using: &rng), width: 1.5, height: 1.5)
                    ctx.fill(Path(ellipseIn: r), with: .color(.brown.opacity(0.12)))
                }
            }
        }
        .ignoresSafeArea()
    }

    private func polaroid(_ pin: Pin, width: CGFloat) -> some View {
        VStack(spacing: 0) {
            ModeImage(photo: pin.photo, size: .medium)
                .frame(width: width - 20, height: (width - 20) * 1.05)
            Text(pin.photo.takenAt.map { $0.formatted(.dateTime.day().month(.abbreviated).year()) } ?? "")
                .font(.figtree(width * 0.07, .semibold)).foregroundStyle(Color(hex: 0x3a3632))
                .frame(height: width * 0.2)
        }
        .padding(.top, 10).padding(.horizontal, 10)
        .background(Color(hex: 0xfdfcf8))
        .shadow(color: .black.opacity(0.28), radius: 10, x: 2, y: 8)
        .overlay(alignment: .top) {
            Rectangle().fill(Color(hex: 0xf3e4b5).opacity(0.78))
                .frame(width: width * 0.36, height: 26)
                .rotationEffect(.degrees(pin.tape))
                .offset(y: -12)
                .shadow(color: .black.opacity(0.08), radius: 1, y: 1)
        }
        .rotationEffect(.degrees(pin.angle))
    }

    private func drop(animated: Bool) {
        let all = source()
        guard !all.isEmpty else { return }
        let p = all[cursor % all.count]; cursor += 1
        let pin = Pin(photo: p, x: .random(in: 0.28...0.72), y: .random(in: 0.25...0.72), angle: .random(in: -14...14), tape: .random(in: -8...8))
        if animated {
            withAnimation(.spring(response: 0.55, dampingFraction: 0.7)) { pins.append(pin); if pins.count > 7 { pins.removeFirst() } }
        } else { pins.append(pin) }
    }
}
