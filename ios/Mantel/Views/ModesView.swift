import SwiftUI

/// Every display mode, like the web Modes page: play it here, or put it on your TV.
struct ModesView: View {
    @Environment(Library.self) private var library
    @Environment(Player.self) private var player
    @Environment(Prefs.self) private var prefs
    @Environment(ModeContent.self) private var content

    var body: some View {
        GeometryReader { geo in
            let cols = geo.size.width > 900 ? 4 : geo.size.width > 560 ? 3 : 2
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    VStack(alignment: .leading, spacing: 8) {
                        Kicker("\(FrameMode.allCases.count) modes", icon: "square.grid.2x2.fill")
                        Display("Pick a *mode*", size: 34)
                        Text(library.signedIn ? "Tap to play on this \(device). Hold for \"Show on TV\"." : "Tap to play on this \(device).")
                            .font(.figtree(15, .medium)).foregroundStyle(Clean.label)
                    }
                    ForEach(FrameMode.Category.allCases, id: \.self) { cat in
                        VStack(alignment: .leading, spacing: 12) {
                            VStack(alignment: .leading, spacing: 2) {
                                Kicker(cat.title)
                                Text(cat.blurb).font(.figtree(13, .medium)).foregroundStyle(Clean.label)
                            }
                            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: cols), spacing: 12) {
                                ForEach(FrameMode.allCases.filter { $0.category == cat }) { m in ModeCard(mode: m) }
                            }
                        }
                    }
                }
                .padding(.horizontal, 20).padding(.top, 6).padding(.bottom, 30)
            }
            .scrollIndicators(.hidden)
        }
        .background(Clean.appBg.ignoresSafeArea())
        .task { if library.signedIn { await content.loadRemote() } }
    }

    private var device: String { UIDevice.current.userInterfaceIdiom == .pad ? "iPad" : "iPhone" }
}

struct ModeCard: View {
    let mode: FrameMode
    @Environment(Library.self) private var library
    @Environment(Player.self) private var player
    @Environment(Prefs.self) private var prefs
    @Environment(ModeContent.self) private var content

    private var onTV: Bool { mode.webId != nil && content.display?.active_mode_id == mode.webId }

    var body: some View {
        Button { player.play(mode: mode) } label: {
            VStack(alignment: .leading, spacing: 0) {
                ModePreview(mode: mode)
                    .frame(height: 104)
                    .clipShape(UnevenRoundedRectangle(topLeadingRadius: 18, topTrailingRadius: 18, style: .continuous))
                    .overlay(alignment: .topTrailing) {
                        if onTV {
                            Label("On TV", systemImage: "tv").font(.figtree(11, .extrabold)).foregroundStyle(.white)
                                .padding(.horizontal, 8).padding(.vertical, 4).background(Capsule().fill(Clean.cherry)).padding(8)
                        }
                    }
                VStack(alignment: .leading, spacing: 3) {
                    Text(mode.title).font(.figtree(16, .bold)).foregroundStyle(Clean.ink)
                    Text(mode.blurb).font(.figtree(12.5, .medium)).foregroundStyle(Clean.label).lineLimit(2, reservesSpace: true)
                }
                .padding(12)
            }
            .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Clean.paper))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(prefs.mode == mode ? Clean.cherry : Clean.line, lineWidth: prefs.mode == mode ? 2 : 1))
            .shadow(color: .black.opacity(0.05), radius: 10, y: 6)
        }
        .buttonStyle(PressScale())
        .contextMenu {
            Button { player.play(mode: mode) } label: { Label("Play on this \(UIDevice.current.userInterfaceIdiom == .pad ? "iPad" : "iPhone")", systemImage: "play.fill") }
            if library.signedIn, let id = mode.webId {
                Button {
                    Task { await content.setRemote(["active_mode_id": id]); library.toast = "\(mode.title) is on your TV" }
                } label: { Label("Show on TV", systemImage: "tv") }
            }
            Button { prefs.mode = mode; library.toast = "\(mode.title) is your default" } label: { Label("Make default", systemImage: "star") }
        }
    }
}

/// A small live-ish preview for each mode card.
struct ModePreview: View {
    let mode: FrameMode
    @Environment(Library.self) private var library
    var body: some View {
        let photos = Array(library.playlist.prefix(6))
        ZStack {
            LinearGradient(colors: [mode.tint, mode.tint.opacity(0.7)], startPoint: .topLeading, endPoint: .bottomTrailing)
            switch mode {
            case .slideshow, .nightstand:
                if let p = photos.first { ModeImage(photo: p, size: .thumb) }
            case .grid:
                if photos.count >= 4 {
                    Grid(horizontalSpacing: 2, verticalSpacing: 2) {
                        GridRow { ModeImage(photo: photos[0], size: .thumb); ModeImage(photo: photos[1], size: .thumb); ModeImage(photo: photos[2], size: .thumb) }
                        GridRow { ModeImage(photo: photos[3], size: .thumb); ModeImage(photo: photos[safe: 4] ?? photos[0], size: .thumb); ModeImage(photo: photos[safe: 5] ?? photos[1], size: .thumb) }
                    }
                }
            case .pinterest:
                if photos.count >= 3 {
                    HStack(alignment: .top, spacing: 4) {
                        VStack(spacing: 4) { ModeImage(photo: photos[0], size: .thumb).frame(height: 70).clipShape(RoundedRectangle(cornerRadius: 6)); ModeImage(photo: photos[1], size: .thumb).frame(height: 50).clipShape(RoundedRectangle(cornerRadius: 6)) }
                        VStack(spacing: 4) { ModeImage(photo: photos[2], size: .thumb).frame(height: 44).clipShape(RoundedRectangle(cornerRadius: 6)); ModeImage(photo: photos[safe: 3] ?? photos[0], size: .thumb).frame(height: 76).clipShape(RoundedRectangle(cornerRadius: 6)) }
                    }
                    .padding(6).offset(y: 14)
                }
            case .scrapbook:
                ZStack {
                    Color(hex: 0xe9dfcc)
                    ForEach(Array(photos.prefix(3).enumerated()), id: \.offset) { i, p in
                        ModeImage(photo: p, size: .thumb).frame(width: 52, height: 54).padding(4).padding(.bottom, 10).background(.white)
                            .rotationEffect(.degrees([-10, 6, -3][i])).offset(x: CGFloat(i - 1) * 34, y: CGFloat(i % 2) * 6)
                            .shadow(color: .black.opacity(0.2), radius: 3, y: 2)
                    }
                }
            case .coverflow:
                ZStack {
                    Color.black
                    ForEach(Array(photos.prefix(3).enumerated()), id: \.offset) { i, p in
                        ModeImage(photo: p, size: .thumb).frame(width: 62, height: 62)
                            .rotation3DEffect(.degrees(i == 1 ? 0 : (i == 0 ? 50 : -50)), axis: (0, 1, 0), perspective: 0.6)
                            .offset(x: CGFloat(i - 1) * 48).zIndex(i == 1 ? 1 : 0)
                    }
                }
            default:
                Image(systemName: mode.icon).font(.system(size: 34, weight: .semibold)).foregroundStyle(.white.opacity(0.95))
            }
        }
        .clipped()
    }
}
