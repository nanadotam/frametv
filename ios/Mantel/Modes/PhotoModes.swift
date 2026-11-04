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

/// Mosaic of photos; one tile swaps at a time, like the web Grid mode.
struct GridMode: View {
    let landscape: Bool
    @Environment(Prefs.self) private var prefs
    @Environment(Player.self) private var player
    @State private var tiles: [PhotoItem] = []
    @State private var cursor = 0

    var body: some View {
        GeometryReader { g in
            let pad = UIDevice.current.userInterfaceIdiom == .pad
            let cols = landscape ? (pad ? 5 : 4) : (pad ? 4 : 3)
            let rows = max(2, Int((g.size.height / (g.size.width / CGFloat(cols))).rounded()))
            let count = cols * rows
            let w = (g.size.width - CGFloat(cols - 1) * 3) / CGFloat(cols)
            let h = (g.size.height - CGFloat(rows - 1) * 3) / CGFloat(rows)
            VStack(spacing: 3) {
                ForEach(0..<rows, id: \.self) { r in
                    HStack(spacing: 3) {
                        ForEach(0..<cols, id: \.self) { c in
                            let i = r * cols + c
                            Group {
                                if i < tiles.count { ModeImage(photo: tiles[i], size: .thumb).id(tiles[i].id).transition(.opacity) }
                                else { Color.white.opacity(0.04) }
                            }
                            .frame(width: w, height: h).clipped()
                        }
                    }
                }
            }
            .onAppear { fill(count) }
            .onChange(of: count) { _, n in fill(n) }
        }
        .background(Color.black)
        .task(id: player.paused) {
            guard !player.paused else { return }
            while !Task.isCancelled {
                do { try await Task.sleep(for: .seconds(max(2.5, prefs.interval / 3))) } catch { break }
                swapOne()
            }
        }
    }

    private func fill(_ n: Int) {
        let all = source()
        guard !all.isEmpty else { return }
        tiles = (0..<n).map { all[$0 % all.count] }
        cursor = n
    }

    private func swapOne() {
        let all = source()
        guard !tiles.isEmpty, all.count > 1 else { return }
        let i = Int.random(in: 0..<tiles.count)
        var next = all[cursor % all.count]; cursor += 1
        if tiles.contains(next), all.count > tiles.count { next = all[cursor % all.count]; cursor += 1 }
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

// MARK: - Cover Flow

/// The 3D carousel: covers tilted either side of the one in front, with a reflection.
struct CoverFlowMode: View {
    @Environment(Prefs.self) private var prefs
    @Environment(Player.self) private var player
    @State private var items: [PhotoItem] = []
    @State private var index: Double = 0
    @State private var dragStart: Double?

    var body: some View {
        GeometryReader { g in
            let side = min(g.size.width * 0.62, g.size.height * 0.5)
            ZStack {
                LinearGradient(colors: [Color(hex: 0x1a1a1f), .black], startPoint: .top, endPoint: .bottom)
                ForEach(Array(items.enumerated()), id: \.offset) { i, p in
                    let d = Double(i) - index
                    if abs(d) < 5 {
                        cover(p, side: side)
                            .rotation3DEffect(.degrees(max(-60, min(60, -d * 60))), axis: (0, 1, 0), perspective: 0.6)
                            .scaleEffect(abs(d) < 0.5 ? 1 : 0.82)
                            .offset(x: CGFloat(d.sign == .minus ? -1 : 1) * (abs(d) < 1 ? abs(d) * side * 0.75 : side * 0.75 + (abs(d) - 1) * side * 0.28))
                            .zIndex(10 - abs(d))   // above the backdrop, nearest cover on top
                            .opacity(abs(d) > 4 ? 0 : 1)
                    }
                }
                .offset(y: -side * 0.15)
            }
            .contentShape(Rectangle())
            .gesture(DragGesture()
                .onChanged { v in
                    if dragStart == nil { dragStart = index }
                    index = max(0, min(Double(items.count - 1), dragStart! - v.translation.width / (side * 0.5)))
                }
                .onEnded { _ in dragStart = nil; withAnimation(.spring(response: 0.5, dampingFraction: 0.85)) { index = index.rounded() } })
        }
        .onAppear { items = Array(source().prefix(80)) }
        .task(id: player.paused) {
            guard !player.paused else { return }
            while !Task.isCancelled {
                do { try await Task.sleep(for: .seconds(max(3, prefs.interval / 2))) } catch { break }
                guard dragStart == nil, items.count > 1 else { continue }
                withAnimation(.spring(response: 0.7, dampingFraction: 0.85)) {
                    index = index + 1 >= Double(items.count) ? 0 : index.rounded() + 1
                }
            }
        }
    }

    private func cover(_ p: PhotoItem, side: CGFloat) -> some View {
        VStack(spacing: 2) {
            ModeImage(photo: p, size: .medium).frame(width: side, height: side)
            ModeImage(photo: p, size: .medium).frame(width: side, height: side)
                .scaleEffect(x: 1, y: -1)
                .frame(width: side, height: side * 0.35, alignment: .top).clipped()
                .mask(LinearGradient(colors: [.white.opacity(0.35), .clear], startPoint: .top, endPoint: .bottom))
        }
    }
}
