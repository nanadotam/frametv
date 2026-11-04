import SwiftUI

/// Control the TV / web display from the phone: mode, skip, pause, brightness and which albums it shows.
/// Changes go to /api/display-state; the display picks them up live over Mantel's realtime channel.
struct RemoteView: View {
    @Environment(Library.self) private var library
    @Environment(ModeContent.self) private var content
    @State private var brightness: Double = 100
    @State private var busy = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                VStack(alignment: .leading, spacing: 8) {
                    Kicker("Remote", icon: "tv.fill")
                    Display("Your *TV*", size: 34)
                    Text("Changes show on every screen signed in to Mantel — TV, Mac screensaver and browser.")
                        .font(.figtree(15, .medium)).foregroundStyle(Clean.label)
                }
                if !library.signedIn {
                    SignInNudge()
                } else {
                    nowPlaying
                    transport
                    modes
                    albums
                    if let e = content.remoteError {
                        Label(e, systemImage: "exclamationmark.triangle.fill").font(.figtree(14, .semibold)).foregroundStyle(Clean.cherry)
                    }
                }
            }
            .padding(.horizontal, 20).padding(.top, 6).padding(.bottom, 30)
        }
        .scrollIndicators(.hidden)
        .background(Clean.appBg.ignoresSafeArea())
        .refreshable { await content.loadRemote() }
        .task {
            await content.loadRemote()
            brightness = content.display?.brightness ?? 100
        }
    }

    private var current: (title: String, icon: String) {
        let id = content.display?.active_mode_id
        if let m = FrameMode.forWeb(id) { return (m.title, m.icon) }
        if let w = FrameMode.webOnly.first(where: { $0.id == id }) { return (w.title, w.icon) }
        return (content.remoteModes.first { $0.id == id }?.name ?? "Slideshow", "tv")
    }

    private var nowPlaying: some View {
        HStack(spacing: 14) {
            Image(systemName: current.icon).font(.system(size: 22, weight: .semibold)).foregroundStyle(.white)
                .frame(width: 54, height: 54).background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Clean.cherry))
            VStack(alignment: .leading, spacing: 2) {
                Text("Now on TV").font(.figtree(13, .semibold)).foregroundStyle(Clean.label)
                Text(current.title).font(.figtree(20, .extrabold)).foregroundStyle(Clean.ink)
                Text(content.display?.is_paused == true ? "Paused" : "Playing").font(.figtree(13, .bold))
                    .foregroundStyle(content.display?.is_paused == true ? Color.orange : Clean.green)
            }
            Spacer()
        }
        .card(padding: 16)
    }

    private var transport: some View {
        VStack(spacing: 16) {
            HStack(spacing: 10) {
                remoteButton("backward.fill", "Back") { await content.remoteAction("prev") }
                remoteButton(content.display?.is_paused == true ? "play.fill" : "pause.fill", content.display?.is_paused == true ? "Play" : "Pause", primary: true) {
                    await content.setRemote(["is_paused": !(content.display?.is_paused ?? false)])
                }
                remoteButton("forward.fill", "Next") { await content.remoteAction("next") }
                remoteButton("shuffle", "Shuffle") { await content.remoteAction("reshuffle"); library.toast = "Reshuffled" }
            }
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Kicker("Brightness", icon: "sun.max.fill")
                    Spacer()
                    Text("\(Int(brightness))%").font(.figtree(14, .bold)).foregroundStyle(Clean.ink).monospacedDigit()
                }
                Slider(value: $brightness, in: 5...100, step: 5) { editing in
                    if !editing { Task { await content.setRemote(["brightness": brightness]) } }
                }
                .tint(Clean.cherry)
            }
        }
        .card(padding: 16)
    }

    private func remoteButton(_ icon: String, _ title: String, primary: Bool = false, _ run: @escaping () async -> Void) -> some View {
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            Task { busy = true; await run(); busy = false }
        } label: {
            VStack(spacing: 6) {
                Image(systemName: icon).font(.system(size: 20, weight: .bold))
                Text(title).font(.figtree(12, .bold))
            }
            .foregroundStyle(primary ? .white : Clean.ink)
            .frame(maxWidth: .infinity, minHeight: 70)
            .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(primary ? Clean.cherry : Clean.butter))
        }
        .buttonStyle(PressScale())
        .disabled(busy)
    }

    private var modes: some View {
        VStack(alignment: .leading, spacing: 12) {
            Kicker("Switch the TV to")
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 100), spacing: 10)], spacing: 10) {
                ForEach(FrameMode.allCases.filter { $0.webId != nil }) { m in modeTile(m.webId!, m.title, m.icon) }
                ForEach(FrameMode.webOnly, id: \.id) { w in modeTile(w.id, w.title, w.icon) }
            }
        }
    }

    private func modeTile(_ id: String, _ title: String, _ icon: String) -> some View {
        let on = content.display?.active_mode_id == id
        let enabled = content.remoteModes.first { $0.id == id }?.is_enabled ?? true
        return Button {
            UISelectionFeedbackGenerator().selectionChanged()
            Task { await content.setRemote(["active_mode_id": id]) }
        } label: {
            VStack(spacing: 8) {
                Image(systemName: icon).font(.system(size: 20, weight: .semibold))
                Text(title).font(.figtree(13, .bold)).lineLimit(1)
            }
            .foregroundStyle(on ? .white : Clean.ink)
            .frame(maxWidth: .infinity, minHeight: 78)
            .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(on ? Clean.cherry : Clean.paper))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Clean.line))
            .opacity(enabled ? 1 : 0.45)
        }
        .buttonStyle(PressScale())
    }

    @ViewBuilder private var albums: some View {
        let cloud = library.albums.filter { !$0.isDevice }
        if !cloud.isEmpty {
            let active = Set(content.display?.active_album_ids ?? [])
            VStack(alignment: .leading, spacing: 10) {
                Kicker("Albums on the TV")
                FlowLayout(spacing: 8) {
                    ForEach(cloud) { a in
                        let on = active.isEmpty || active.contains(a.id)
                        Chip(title: a.name, icon: on ? "checkmark" : nil, on: on) {
                            var next = active.isEmpty ? Set(cloud.map(\.id)) : active
                            if next.contains(a.id) { next.remove(a.id) } else { next.insert(a.id) }
                            let ids = next.count == cloud.count ? [] : Array(next)
                            Task { await content.setRemote(["active_album_ids": ids]) }
                        }
                    }
                }
            }
        }
    }
}
