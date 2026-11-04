import SwiftUI
import AppIntents

@main
struct MantelApp: App {
    @State private var library = Library.shared
    @State private var prefs = Prefs.shared
    @State private var player = Player.shared
    @Environment(\.scenePhase) private var phase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(library)
                .environment(prefs)
                .environment(player)
                .preferredColorScheme(prefs.appearance.scheme)
                .tint(Clean.cherry)
                .onOpenURL { url in
                    // mantel://play from widgets and the control
                    if url.host() == "play" || url.host() == "frame" { startFrame() }
                }
                .onReceive(NotificationCenter.default.publisher(for: .mantelPlayRequested)) { _ in
                    _ = LaunchRequest.consume(); startFrame()
                }
                .task { await boot() }
        }
        .onChange(of: phase) { _, p in
            if p == .active {
                if LaunchRequest.consume() { startFrame() }
                Task { await library.refresh(quiet: true) }
            }
            if p == .background { library.writeWidgetFeed() }
        }
    }

    private func boot() async {
        MantelAPI.configure()
        if ProcessInfo.processInfo.arguments.contains("-MantelDemo") { DemoContent.install() }
        library.writeWidgetFeed()
        if library.signedIn { await library.refresh(quiet: true) } else { library.scheduleSync() }
        if ProcessInfo.processInfo.arguments.contains("-MantelLandscape"),
           let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene {
            scene.requestGeometryUpdate(.iOS(interfaceOrientations: .landscapeRight))
        }
        if ProcessInfo.processInfo.arguments.contains("-MantelPlay") { startFrame() }
        if ProcessInfo.processInfo.arguments.contains("-MantelMini") {
            startFrame(); try? await Task.sleep(for: .seconds(2)); player.presentation = .mini
        }
    }

    private func startFrame() {
        guard library.onboarded else { return }
        if player.presentation == .closed { player.play() } else { player.presentation = .full }
    }
}

/// Siri, Spotlight and the Action button: "Play Mantel".
struct MantelShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: PlayFrameIntent(), phrases: ["Play \(.applicationName)", "Start \(.applicationName) frame"],
                    shortTitle: "Play Mantel", systemImageName: "photo.tv")
    }
}

struct RootView: View {
    @Environment(Library.self) private var library
    @Environment(Player.self) private var player

    var body: some View {
        @Bindable var library = library
        ZStack {
            if library.onboarded {
                NavigationStack { HomeView() }
            } else {
                WelcomeView().transition(.opacity)
            }
            if player.presentation == .mini {
                MiniFrame().zIndex(2)
            }
            if player.presentation == .full {
                FrameView().zIndex(3)
                    .transition(.asymmetric(insertion: .opacity.combined(with: .scale(scale: 1.04)),
                                            removal: .opacity.combined(with: .scale(scale: 0.92))))
            }
        }
        .animation(Clean.ease(0.5), value: library.onboarded)
        .toast($library.toast)
        .background(Clean.appBg.ignoresSafeArea())
    }
}
