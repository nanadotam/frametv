import SwiftUI
import AppIntents
import BackgroundTasks

@main
struct MantelApp: App {
    @State private var library = Library.shared
    @State private var prefs = Prefs.shared
    @State private var player = Player.shared
    @State private var content = ModeContent.shared
    @Environment(\.scenePhase) private var phase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(library)
                .environment(prefs)
                .environment(player)
                .environment(content)
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
            if p == .background { library.writeWidgetFeed(); Self.scheduleRefresh() }
        }
        // iOS wakes the app now and then (roughly every 15+ minutes, its choice) to pull new photos,
        // save them for offline and refresh the widgets.
        .backgroundTask(.appRefresh(Self.refreshId)) {
            await Self.scheduleRefreshAsync()
            await Library.shared.refresh(quiet: true)
            await ModeContent.shared.loadVerse(translation: await Prefs.shared.translation)
            await Library.shared.writeWidgetFeed()
        }
    }

    static let refreshId = "com.nanaamoako.mantel.refresh"
    static func scheduleRefresh() {
        let r = BGAppRefreshTaskRequest(identifier: refreshId)
        r.earliestBeginDate = Date().addingTimeInterval(15 * 60)
        try? BGTaskScheduler.shared.submit(r)
    }
    nonisolated static func scheduleRefreshAsync() async { await MainActor.run { scheduleRefresh() } }

    private func boot() async {
        MantelAPI.configure()
        UserDefaults.standard.removeObject(forKey: "tcpOnly")   // re-try HTTP/3 each launch (networks change)
        if ProcessInfo.processInfo.arguments.contains("-MantelDemo") { DemoContent.install() }
        #if DEBUG
        // Simulator testing only: -MantelLogin <email> <password>
        let args = ProcessInfo.processInfo.arguments
        if let i = args.firstIndex(of: "-MantelLogin"), args.count > i + 2, !library.signedIn {
            try? await library.signIn(email: args[i + 1], password: args[i + 2])
        }
        if let i = args.firstIndex(of: "-MantelSetTV"), args.count > i + 1 {
            await ModeContent.shared.setRemote(["active_mode_id": args[i + 1], "brightness": 60])
        }
        #endif
        library.writeWidgetFeed()
        Task { await ModeContent.shared.loadVerse(translation: prefs.translation) }
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
                MainTabs()
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
