import SwiftUI

enum AppTab: Hashable { case home, albums, modes, remote, settings }

@Observable @MainActor
final class Nav {
    static let shared = Nav()
    var tab: AppTab = .home
}

/// The app's tab bar: Home, Albums, Modes, Remote, Settings.
struct MainTabs: View {
    @Environment(Library.self) private var library
    @State private var nav = Nav.shared

    var body: some View {
        TabView(selection: $nav.tab) {
            Tab("Home", systemImage: "house.fill", value: AppTab.home) {
                NavigationStack { HomeView() }
            }
            Tab("Albums", systemImage: "photo.stack.fill", value: AppTab.albums) {
                NavigationStack { AlbumsView() }
            }
            Tab("Modes", systemImage: "square.grid.2x2.fill", value: AppTab.modes) {
                NavigationStack { ModesView() }
            }
            Tab("Remote", systemImage: "tv.fill", value: AppTab.remote) {
                NavigationStack { RemoteView() }
            }
            Tab("Settings", systemImage: "gearshape.fill", value: AppTab.settings) {
                NavigationStack { SettingsView(inTab: true) }
            }
        }
        .tint(Clean.cherry)
        .environment(nav)
    }
}

/// Every album, with "New album" and the show/hide check on each.
struct AlbumsView: View {
    @Environment(Library.self) private var library
    @State private var newAlbum: NewAlbumKind?
    @State private var linking = false

    var body: some View {
        GeometryReader { geo in
            let cols = geo.size.width > 900 ? 5 : geo.size.width > 560 ? 4 : 2
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    HStack(alignment: .bottom) {
                        VStack(alignment: .leading, spacing: 8) {
                            Kicker("\(library.albums.count) albums · \(library.albums.reduce(0) { $0 + library.count($1.id) }) photos")
                            Display("Albums", size: 34)
                        }
                        Spacer()
                        Menu {
                            Button { linking = true } label: { Label("Link an iPhone album (nothing copied)", systemImage: "photo.on.rectangle") }
                            Button { newAlbum = .device } label: { Label("Pick photos into a new album", systemImage: "iphone") }
                            if library.signedIn { Button { newAlbum = .cloud } label: { Label("Upload to Mantel", systemImage: "icloud.and.arrow.up") } }
                        } label: {
                            Image(systemName: "plus").font(.system(size: 18, weight: .bold)).foregroundStyle(.white)
                                .frame(width: 42, height: 42).background(Circle().fill(Clean.cherry))
                        }
                    }
                    Text("Tap the tick to choose what plays on the frame. Link an iPhone album to stream it straight from Photos — nothing is uploaded.")
                        .font(.figtree(14, .medium)).foregroundStyle(Clean.label)
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 14), count: cols), spacing: 18) {
                        ForEach(library.albums) { a in
                            NavigationLink(value: a) { AlbumCard(album: a) }.buttonStyle(PressScale())
                        }
                        Button { newAlbum = .device } label: { AddAlbumCard() }.buttonStyle(PressScale())
                    }
                    if !library.signedIn { SignInNudge() }
                }
                .padding(.horizontal, 20).padding(.top, 6).padding(.bottom, 30)
            }
            .scrollIndicators(.hidden)
            .refreshable { await library.refresh() }
        }
        .background(Clean.appBg.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
        .navigationDestination(for: AlbumItem.self) { AlbumView(albumId: $0.id) }
        .sheet(item: $newAlbum) { NewAlbumSheet(kind: $0) }
        .sheet(isPresented: $linking) { LinkAlbumSheet() }
    }
}
