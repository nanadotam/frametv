import SwiftUI
import PhotosUI
import ImageIO

struct HomeView: View {
    @Environment(Library.self) private var library
    @Environment(Player.self) private var player
    @State private var newAlbum: NewAlbumKind?
    @State private var openAlbum: AlbumItem?

    var body: some View {
        GeometryReader { geo in
            let wide = geo.size.width > geo.size.height && geo.size.width > 560
            ScrollView {
                if wide {
                    // Landscape / iPad: frame preview on the left, albums on the right.
                    HStack(alignment: .top, spacing: 28) {
                        VStack(alignment: .leading, spacing: 20) {
                            header
                            hero(height: max(150, min(geo.size.height - 270, 520)))
                        }
                        .frame(width: min(geo.size.width * 0.42, 460))
                        VStack(alignment: .leading, spacing: 26) {
                            modesRow
                            nowShowing
                            albums(columns: geo.size.width > 1000 ? 3 : 2, limit: nil)
                        }
                        .padding(.top, 8)
                    }
                    .padding(.horizontal, 28).padding(.vertical, 18)
                } else {
                    VStack(alignment: .leading, spacing: 26) {
                        header
                        hero(height: min(geo.size.width * 0.92, 420))
                        modesRow
                        nowShowing
                        albums(columns: 2, limit: 4)
                    }
                    .padding(.horizontal, 20).padding(.top, 6).padding(.bottom, 40)
                }
            }
            .scrollIndicators(.hidden)
            .refreshable { await library.refresh() }
        }
        .background(Clean.appBg.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
        .navigationDestination(for: AlbumItem.self) { AlbumView(albumId: $0.id) }
        .sheet(item: $newAlbum) { NewAlbumSheet(kind: $0) }
        .navigationDestination(item: $openAlbum) { AlbumView(albumId: $0.id) }
        .task {
            // Screenshot helpers for the simulator (scripts/screens.sh).
            let args = ProcessInfo.processInfo.arguments
            try? await Task.sleep(for: .seconds(1.5))
            if args.contains("-MantelSettings") { Nav.shared.tab = .settings }
            if args.contains("-MantelModes") { Nav.shared.tab = .modes }
            if args.contains("-MantelRemote") { Nav.shared.tab = .remote }
            if args.contains("-MantelAlbum") { openAlbum = library.albums.first }
        }
    }

    // MARK: Header

    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 8) {
                Kicker(Date.now.formatted(.dateTime.weekday(.wide).day().month(.wide)))
                Display(greeting, size: 36)
                status
            }
            Spacer()
            IconButton(icon: "gearshape.fill", size: 42) { Nav.shared.tab = .settings }
        }
    }

    private var greeting: String {
        let h = Calendar.current.component(.hour, from: .now)
        let part = h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
        if let n = library.user?.name?.split(separator: " ").first { return "\(part),\n*\(n)*" }
        return "\(part)\n*on the mantel*"
    }

    private var status: some View {
        HStack(spacing: 6) {
            Circle().fill(library.online ? Clean.green : Color.orange).frame(width: 7, height: 7)
            Group {
                if !library.online {
                    Text("Offline · \(savedTotal) photos saved here")
                } else if let d = library.downloading {
                    Text("Saving for offline · \(d.done) of \(d.total)")
                } else if library.refreshing {
                    Text("Syncing…")
                } else if let t = library.lastSynced {
                    Text("Synced \(t.formatted(.relative(presentation: .named)))")
                } else {
                    Text(library.signedIn ? "Ready" : "Photos on this device")
                }
            }
            .font(.figtree(13, .semibold)).foregroundStyle(Clean.label)
            .contentTransition(.numericText())
        }
        .animation(Clean.ease(), value: library.downloading?.done)
    }

    private var savedTotal: Int { library.saved.values.reduce(0, +) }

    // MARK: Hero

    private func hero(height: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HeroPreview()
                .frame(height: height)
                .clipShape(UnevenRoundedRectangle(topLeadingRadius: Clean.radius, topTrailingRadius: Clean.radius, style: .continuous))
                .overlay(alignment: .bottomLeading) {
                    VStack(alignment: .leading, spacing: 4) {
                        Kicker("Now showing").foregroundStyle(.white.opacity(0.85)).colorScheme(.dark)
                        Text(showingSummary).font(.figtree(20, .extrabold)).foregroundStyle(.white)
                    }
                    .padding(18)
                    .shadow(color: .black.opacity(0.35), radius: 10)
                }
                .onTapGesture { player.play() }
            HStack(spacing: 10) {
                Button { player.play() } label: { Label("Play full screen", systemImage: "play.fill") }
                    .buttonStyle(CleanButton(kind: .primary, size: 52))
                Button {
                    player.play(mode: .nightstand)
                } label: { Image(systemName: "bed.double.fill") }
                    .buttonStyle(CleanButton(kind: .secondary, size: 52, block: false))
                    .accessibilityLabel("Nightstand")
            }
            .padding(12)
        }
        .background(RoundedRectangle(cornerRadius: Clean.radius, style: .continuous).fill(Clean.paper))
        .overlay(RoundedRectangle(cornerRadius: Clean.radius, style: .continuous).strokeBorder(Clean.line, lineWidth: 1))
        .shadow(color: .black.opacity(0.07), radius: 15, y: 10)
    }

    private var showingSummary: String {
        let n = library.playlist.count
        let albums = library.showing.isEmpty ? library.albums.count : library.showing.count
        if n == 0 { return "Add photos to get started" }
        return "\(n) photo\(n == 1 ? "" : "s") · \(albums) album\(albums == 1 ? "" : "s")"
    }

    // MARK: Now showing

    @ViewBuilder private var nowShowing: some View {
        if library.albums.count > 1 {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Kicker("Albums on the frame")
                    Spacer()
                    if !library.showing.isEmpty {
                        Button("Show all") { withAnimation(Clean.ease()) { library.showing = [] } }
                            .font(.figtree(13, .bold)).foregroundStyle(Clean.cherry)
                    }
                }
                ScrollView(.horizontal) {
                    HStack(spacing: 8) {
                        ForEach(library.albums) { a in
                            Chip(title: a.name, icon: library.isShowing(a.id) ? "checkmark" : nil, on: library.isShowing(a.id)) {
                                withAnimation(Clean.ease()) { library.toggleShowing(a.id) }
                            }
                        }
                    }
                }
                .scrollIndicators(.hidden)
            }
        }
    }

    // MARK: Albums

    private var modesRow: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Kicker("Modes")
                Spacer()
                Button("See all") { Nav.shared.tab = .modes }.font(.figtree(13, .bold)).foregroundStyle(Clean.cherry)
            }
            ScrollView(.horizontal) {
                HStack(spacing: 10) {
                    ForEach(FrameMode.allCases.filter { !$0.needsAccount || library.signedIn }) { m in
                        Button { player.play(mode: m) } label: {
                            VStack(alignment: .leading, spacing: 6) {
                                ModePreview(mode: m).frame(width: 128, height: 84)
                                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                                Text(m.title).font(.figtree(14, .bold)).foregroundStyle(Clean.ink)
                            }
                        }
                        .buttonStyle(PressScale())
                    }
                }
                .padding(.horizontal, 20)
            }
            .padding(.horizontal, -20)
            .scrollIndicators(.hidden)
        }
    }

    private func albums(columns: Int, limit: Int?) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Kicker("Albums")
                Spacer()
                if let limit, library.albums.count > limit {
                    Button("See all \(library.albums.count)") { Nav.shared.tab = .albums }.font(.figtree(13, .bold)).foregroundStyle(Clean.cherry)
                        .padding(.trailing, 6)
                }
                Menu {
                    Button { newAlbum = .device } label: { Label("From this iPhone's photos", systemImage: "iphone") }
                    if library.signedIn {
                        Button { newAlbum = .cloud } label: { Label("Upload to Mantel", systemImage: "icloud.and.arrow.up") }
                    }
                } label: {
                    Label("New album", systemImage: "plus").font(.figtree(14, .bold)).foregroundStyle(Clean.cherry)
                }
            }
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 14), count: columns), spacing: 18) {
                ForEach(limit.map { Array(library.albums.prefix($0)) } ?? library.albums) { a in
                    NavigationLink(value: a) { AlbumCard(album: a) }.buttonStyle(PressScale())
                }
                if limit == nil || library.albums.count < (limit ?? 0) {
                    Button { newAlbum = .device } label: { AddAlbumCard() }.buttonStyle(PressScale())
                }
            }
            if !library.signedIn {
                SignInNudge().padding(.top, 8)
            }
        }
    }
}

enum NewAlbumKind: String, Identifiable { case device, cloud; var id: String { rawValue } }

/// The big preview on the home screen: your photos gently cycling.
struct HeroPreview: View {
    @Environment(Library.self) private var library
    @State private var index = 0
    @State private var image: UIImage?
    var body: some View {
        ZStack {
            Clean.cream
            if let image {
                // Fill inside a fixed box: a bare scaledToFill() would size the view to the photo,
                // so a landscape photo pushed the whole page sideways.
                Color.clear.overlay { Image(uiImage: image).resizable().scaledToFill() }
                    .clipped()
                    .transition(.opacity).id(index)
            } else {
                Image(systemName: "photo.on.rectangle.angled").font(.system(size: 44, weight: .light)).foregroundStyle(Clean.label)
            }
            LinearGradient(colors: [.clear, .black.opacity(0.45)], startPoint: .center, endPoint: .bottom)
        }
        .clipped()
        .task(id: library.playlist.count) {
            while !Task.isCancelled {
                let list = library.playlist
                if !list.isEmpty {
                    let p = list[index % list.count]
                    if let img = await ImageCache.shared.image(p, .full, network: library.online) {
                        withAnimation(.easeInOut(duration: 1.2)) { image = img }
                    }
                }
                try? await Task.sleep(for: .seconds(6))
                index = Int.random(in: 0..<max(list.count, 1))
            }
        }
    }
}

struct AlbumCard: View {
    @Environment(Library.self) private var library
    let album: AlbumItem
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ZStack(alignment: .topTrailing) {
                Group {
                    if let c = library.cover(album) { PhotoThumb(photo: c) } else {
                        Clean.cream.overlay(Image(systemName: album.isDevice ? "iphone" : "photo").font(.system(size: 26)).foregroundStyle(Clean.label))
                    }
                }
                .aspectRatio(1, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Clean.line, lineWidth: 1))
                .opacity(library.isShowing(album.id) ? 1 : 0.55)

                Image(systemName: library.isShowing(album.id) ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(library.isShowing(album.id) ? .white : .white.opacity(0.9), library.isShowing(album.id) ? Clean.cherry : .black.opacity(0.25))
                    .symbolRenderingMode(.palette)
                    .padding(8)
                    .onTapGesture { withAnimation(Clean.ease()) { library.toggleShowing(album.id) } }
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(album.name).font(.figtree(16, .bold)).foregroundStyle(Clean.ink).lineLimit(1)
                HStack(spacing: 4) {
                    let n = library.count(album.id), s = library.saved[album.id] ?? 0
                    Text("\(n) photo\(n == 1 ? "" : "s")")
                    if !album.isDevice && n > 0 {
                        Image(systemName: s >= n ? "arrow.down.circle.fill" : "arrow.down.circle").foregroundStyle(s >= n ? Clean.green : Clean.label)
                        Text(s >= n ? "offline" : "\(s) saved")
                    } else if album.isDevice {
                        Image(systemName: "iphone")
                    }
                }
                .font(.figtree(13, .semibold)).foregroundStyle(Clean.label).lineLimit(1)
            }
        }
    }
}

struct AddAlbumCard: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(Clean.label.opacity(0.4), style: StrokeStyle(lineWidth: 1.5, dash: [6, 5]))
                .aspectRatio(1, contentMode: .fit)
                .overlay {
                    VStack(spacing: 8) {
                        Image(systemName: "plus").font(.system(size: 22, weight: .bold)).foregroundStyle(Clean.cherry)
                            .frame(width: 46, height: 46).background(Circle().fill(Clean.pink))
                        Text("Add photos").font(.figtree(14, .bold)).foregroundStyle(Clean.ink)
                    }
                }
            Text("From your library").font(.figtree(13, .semibold)).foregroundStyle(Clean.label)
        }
    }
}

struct SignInNudge: View {
    @State private var signIn = false
    var body: some View {
        HStack(spacing: 14) {
            Image("Mark").resizable().frame(width: 44, height: 44).clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                Text("Have a Mantel account?").font(.figtree(15, .bold)).foregroundStyle(Clean.ink)
                Text("Bring your Drive and Google Photos albums here.").font(.figtree(13, .medium)).foregroundStyle(Clean.label)
            }
            Spacer()
            Button("Sign in") { signIn = true }.buttonStyle(CleanButton(kind: .secondary, size: 38, block: false))
        }
        .card(padding: 14)
        .sheet(isPresented: $signIn) { SignInSheet() }
    }
}

/// A grid thumbnail, loaded from the device first.
struct PhotoThumb: View {
    @Environment(Library.self) private var library
    let photo: PhotoItem
    var size: ImageCache.Size = .thumb
    @State private var image: UIImage?
    var body: some View {
        GeometryReader { g in
            ZStack {
                Clean.cream
                if let image {
                    Image(uiImage: image).resizable().scaledToFill().frame(width: g.size.width, height: g.size.height).clipped()
                        .transition(.opacity)
                }
            }
        }
        .task(id: photo.id) {
            if let m = ImageCache.shared.cached(photo, size) { image = m; return }
            let img = await ImageCache.shared.image(photo, size, network: library.online)
            withAnimation(Clean.ease(0.3)) { image = img }
        }
    }
}

/// New album: from this iPhone's library, or uploaded to your Mantel account.
struct NewAlbumSheet: View {
    @Environment(Library.self) private var library
    @Environment(\.dismiss) private var dismiss
    let kind: NewAlbumKind
    @State private var name = ""
    @State private var picks: [PhotosPickerItem] = []
    @State private var busy = false
    @State private var progress = 0

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Kicker(kind == .device ? "On this iPhone" : "Upload to Mantel", icon: kind == .device ? "iphone" : "icloud.and.arrow.up")
            Display(kind == .device ? "New *album*" : "New Mantel *album*", size: 30)
            Text(kind == .device ? "Photos stay on this device and work offline. They aren't uploaded anywhere."
                                 : "Photos are uploaded to your Mantel account so your TV and Mac show them too.")
                .font(.figtree(15, .medium)).foregroundStyle(Clean.label)
            CleanField(label: "Name", text: $name)
            PhotosPicker(selection: $picks, maxSelectionCount: 200, matching: .images, preferredItemEncoding: .compatible) {
                HStack {
                    Image(systemName: "photo.stack")
                    Text(picks.isEmpty ? "Choose photos" : "\(picks.count) photo\(picks.count == 1 ? "" : "s") chosen")
                }
                .font(.figtree(16, .bold)).foregroundStyle(Clean.ink)
                .frame(maxWidth: .infinity, minHeight: 52)
                .background(RoundedRectangle(cornerRadius: Clean.btnRadius, style: .continuous).fill(Clean.butter))
            }
            Spacer()
            if busy {
                HStack(spacing: 10) {
                    Ring(value: Double(progress) / Double(max(picks.count, 1))).frame(width: 22, height: 22)
                    Text("Adding \(min(progress + 1, picks.count)) of \(picks.count)…").font(.figtree(15, .semibold)).foregroundStyle(Clean.ink)
                }
            }
            Button { Task { await create() } } label: { Text("Create album") }
                .buttonStyle(CleanButton(kind: .primary, size: 56))
                .disabled(busy || name.trimmingCharacters(in: .whitespaces).isEmpty)
                .opacity(name.trimmingCharacters(in: .whitespaces).isEmpty ? 0.5 : 1)
        }
        .padding(24)
        .background(Clean.appBg.ignoresSafeArea())
        .presentationDetents([.large])
        .presentationCornerRadius(28)
        .interactiveDismissDisabled(busy)
        .onAppear { if name.isEmpty { name = kind == .device ? "Favourites" : "From my iPhone" } }
    }

    private func create() async {
        busy = true
        let a: AlbumItem? = kind == .device ? library.newDeviceAlbum(name) : await library.newCloudAlbum(name)
        guard let a else { busy = false; return }
        let items = await loadPicks(picks)
        await library.add(items, to: a) { progress = $0 }
        busy = false
        dismiss()
    }
}

/// Reads picked photos (data + the date they were taken).
func loadPicks(_ picks: [PhotosPickerItem]) async -> [(data: Data, date: Date?)] {
    var out: [(Data, Date?)] = []
    for p in picks {
        if let d = try? await p.loadTransferable(type: Data.self) { out.append((d, exifDate(d))) }
    }
    return out
}

/// When the photo was taken, from its EXIF (no photo-library permission needed).
func exifDate(_ data: Data) -> Date? {
    guard let src = CGImageSourceCreateWithData(data as CFData, nil),
          let props = CGImageSourceCopyPropertiesAtIndex(src, 0, nil) as? [CFString: Any],
          let exif = props[kCGImagePropertyExifDictionary] as? [CFString: Any],
          let s = exif[kCGImagePropertyExifDateTimeOriginal] as? String else { return nil }
    let f = DateFormatter(); f.dateFormat = "yyyy:MM:dd HH:mm:ss"; f.locale = Locale(identifier: "en_US_POSIX")
    return f.date(from: s)
}
