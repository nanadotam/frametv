import SwiftUI
import PhotosUI

struct AlbumView: View {
    @Environment(Library.self) private var library
    @Environment(Player.self) private var player
    @Environment(\.dismiss) private var dismiss
    let albumId: String

    @State private var selecting = false
    @State private var selected: Set<String> = []
    @State private var picks: [PhotosPickerItem] = []
    @State private var adding: (done: Int, total: Int)?
    @State private var confirmDelete = false
    @State private var confirmDeleteAlbum = false
    @State private var renaming = false
    @State private var newName = ""

    private var album: AlbumItem? { library.album(albumId) }
    private var photos: [PhotoItem] { library.photos[albumId] ?? [] }

    var body: some View {
        GeometryReader { geo in
            let cols = max(3, Int(geo.size.width / 130))
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    header
                    if let adding {
                        HStack(spacing: 10) {
                            Ring(value: Double(adding.done) / Double(max(adding.total, 1))).frame(width: 22, height: 22)
                            Text(album?.isDevice == true ? "Adding \(adding.done) of \(adding.total)…" : "Uploading \(adding.done) of \(adding.total)…")
                                .font(.figtree(15, .semibold)).foregroundStyle(Clean.ink)
                        }
                        .card(padding: 14)
                    }
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 3), count: cols), spacing: 3) {
                        ForEach(photos) { p in cell(p) }
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    if photos.isEmpty { empty }
                }
                .padding(.horizontal, 16).padding(.bottom, selecting ? 110 : 40)
            }
        }
        .background(Clean.appBg.ignoresSafeArea())
        .navigationBarBackButtonHidden()
        .toolbar(.hidden, for: .navigationBar)
        .safeAreaInset(edge: .bottom) { if selecting { selectionBar } }
        .onChange(of: picks) { _, new in if !new.isEmpty { Task { await add(new) } } }
        .confirmationDialog(deleteTitle, isPresented: $confirmDelete, titleVisibility: .visible) {
            Button(album?.isDevice == true ? "Delete from this iPhone" : "Delete from Mantel", role: .destructive) {
                let ids = selected
                Task { await library.delete(ids); selected = []; selecting = false }
            }
        } message: {
            Text(album?.isDevice == true ? "These photos will be removed from this album." : "These photos are removed from your Mantel account, on every screen. To only stop showing them here, use Hide.")
        }
        .confirmationDialog("Delete \(album?.name ?? "album")?", isPresented: $confirmDeleteAlbum, titleVisibility: .visible) {
            Button("Delete album", role: .destructive) { library.deleteDeviceAlbum(albumId); dismiss() }
        } message: { Text("Its photos are removed from this device. Your photo library isn't touched.") }
        .alert("Rename album", isPresented: $renaming) {
            TextField("Name", text: $newName)
            Button("Save") { library.rename(albumId, to: newName) }
            Button("Cancel", role: .cancel) {}
        }
    }

    private var deleteTitle: String { selected.count == 1 ? "Delete this photo?" : "Delete \(selected.count) photos?" }

    // MARK: Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                IconButton(icon: "chevron.left", size: 40) { dismiss() }
                Spacer()
                if !photos.isEmpty {
                    Button(selecting ? "Done" : "Select") {
                        withAnimation(Clean.ease()) { selecting.toggle(); selected = [] }
                    }
                    .buttonStyle(CleanButton(kind: selecting ? .primary : .outline, size: 38, block: false))
                }
                menu
            }
            .padding(.top, 4)
            VStack(alignment: .leading, spacing: 6) {
                Kicker(album?.sourceLabel ?? "", icon: album?.isDevice == true ? "iphone" : "cloud")
                Display(album?.name ?? "", size: 32)
                Text(meta).font(.figtree(14, .semibold)).foregroundStyle(Clean.label)
            }
            HStack(spacing: 10) {
                Button { player.play(in: visible) } label: { Label("Play", systemImage: "play.fill") }
                    .buttonStyle(CleanButton(kind: .primary, size: 48))
                    .disabled(visible.isEmpty)
                Button {
                    withAnimation(Clean.ease()) { library.toggleShowing(albumId) }
                } label: {
                    Label(library.isShowing(albumId) ? "Showing" : "Hidden",
                          systemImage: library.isShowing(albumId) ? "checkmark.circle.fill" : "circle")
                }
                .buttonStyle(CleanButton(kind: .secondary, size: 48))
                if canAdd {
                    PhotosPicker(selection: $picks, maxSelectionCount: 200, matching: .images, preferredItemEncoding: .compatible) {
                        Image(systemName: "plus").font(.system(size: 18, weight: .bold)).foregroundStyle(Clean.ink)
                            .frame(width: 48, height: 48)
                            .background(RoundedRectangle(cornerRadius: Clean.btnRadius, style: .continuous).fill(Clean.butter))
                    }
                    .accessibilityLabel("Add photos")
                }
            }
        }
    }

    private var visible: [PhotoItem] {
        photos.filter { !isHidden($0) }
    }
    private func isHidden(_ p: PhotoItem) -> Bool { library.hidden.contains(p.id) }

    private var canAdd: Bool { album?.isDevice == true || album?.acceptsUploads == true }

    private var meta: String {
        let n = library.count(albumId), s = library.saved[albumId] ?? 0, h = library.hiddenCount(album: albumId)
        var parts = ["\(n) photo\(n == 1 ? "" : "s")"]
        if album?.isDevice == false { parts.append(s >= n && n > 0 ? "all saved for offline" : "\(s) saved for offline") }
        if h > 0 { parts.append("\(h) hidden") }
        return parts.joined(separator: " · ")
    }

    private var menu: some View {
        Menu {
            if album?.isDevice == false {
                Button { library.showing.insert(albumId); library.scheduleSync() } label: { Label("Save all for offline", systemImage: "arrow.down.circle") }
                Button { Task { await library.removeDownloads(album: albumId) } } label: { Label("Remove downloads", systemImage: "trash.slash") }
            }
            if library.hiddenCount(album: albumId) > 0 {
                Button { library.unhideAll(album: albumId) } label: { Label("Show hidden photos", systemImage: "eye") }
            }
            if album?.isDevice == true {
                Button { newName = album?.name ?? ""; renaming = true } label: { Label("Rename", systemImage: "pencil") }
                Button(role: .destructive) { confirmDeleteAlbum = true } label: { Label("Delete album", systemImage: "trash") }
            }
        } label: {
            Image(systemName: "ellipsis").font(.system(size: 16, weight: .bold)).foregroundStyle(Clean.ink)
                .frame(width: 40, height: 40).background(Circle().fill(Clean.paper)).overlay(Circle().strokeBorder(Clean.line))
        }
    }

    // MARK: Grid

    private func cell(_ p: PhotoItem) -> some View {
        let hidden = isHidden(p)
        let on = selected.contains(p.id)
        return PhotoThumb(photo: p)
            .aspectRatio(1, contentMode: .fit)
            .clipped()
            .opacity(hidden ? 0.35 : 1)
            .overlay(alignment: .bottomLeading) {
                if hidden { Image(systemName: "eye.slash.fill").font(.system(size: 11, weight: .bold)).foregroundStyle(.white).padding(6) }
                else if album?.isDevice == false && !ImageCache.shared.isSaved(p) {
                    Image(systemName: "icloud").font(.system(size: 10, weight: .bold)).foregroundStyle(.white).shadow(radius: 3).padding(6)
                }
            }
            .overlay(alignment: .topTrailing) {
                if selecting {
                    Image(systemName: on ? "checkmark.circle.fill" : "circle")
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundStyle(.white, on ? Clean.cherry : .black.opacity(0.25)).symbolRenderingMode(.palette)
                        .padding(6)
                }
            }
            .overlay { if on { Rectangle().strokeBorder(Clean.cherry, lineWidth: 3) } }
            .contentShape(Rectangle())
            .onTapGesture {
                if selecting {
                    if on { selected.remove(p.id) } else { selected.insert(p.id) }
                } else if !hidden {
                    player.play(startingAt: p, in: visible)
                }
            }
            .contextMenu {
                Button { player.play(startingAt: p, in: visible) } label: { Label("Play from here", systemImage: "play") }
                Button { Task { await library.hide([p.id]) } } label: { Label("Hide from frame", systemImage: "eye.slash") }
                if p.localFile == nil {
                    Button { Task { await library.removeDownload([p.id]) } } label: { Label("Remove download", systemImage: "arrow.down.circle.dotted") }
                }
                Button(role: .destructive) { selected = [p.id]; confirmDelete = true } label: { Label("Delete…", systemImage: "trash") }
            }
    }

    private var empty: some View {
        VStack(spacing: 10) {
            Image(systemName: "photo.on.rectangle").font(.system(size: 36, weight: .light)).foregroundStyle(Clean.label)
            Text(canAdd ? "Tap + to add photos" : "No photos yet").font(.figtree(17, .bold)).foregroundStyle(Clean.ink)
            if !canAdd { Text("Add photos to this album on mantelapp.vercel.app.").font(.figtree(14, .medium)).foregroundStyle(Clean.label) }
        }
        .frame(maxWidth: .infinity).padding(.vertical, 50)
    }

    private var selectionBar: some View {
        HStack(spacing: 8) {
            Text(selected.isEmpty ? "Select photos" : "\(selected.count) selected").font(.figtree(15, .bold)).foregroundStyle(Clean.ink)
            Spacer()
            Button { Task { await library.hide(selected); selected = [] } } label: { Label("Hide", systemImage: "eye.slash") }
                .buttonStyle(CleanButton(kind: .secondary, size: 42, block: false))
            if album?.isDevice == false {
                Button { Task { await library.removeDownload(selected); library.toast = "Downloads removed"; selected = [] } } label: { Image(systemName: "arrow.down.circle.dotted") }
                    .buttonStyle(CleanButton(kind: .secondary, size: 42, block: false))
                    .accessibilityLabel("Remove downloads")
            }
            Button { confirmDelete = true } label: { Image(systemName: "trash") }
                .buttonStyle(CleanButton(kind: .danger, size: 42, block: false))
                .accessibilityLabel("Delete")
        }
        .disabled(selected.isEmpty)
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 22, style: .continuous).fill(Clean.paper).shadow(color: .black.opacity(0.12), radius: 20, y: 8))
        .padding(.horizontal, 14).padding(.bottom, 6)
        .transition(.move(edge: .bottom).combined(with: .opacity))
    }

    private func add(_ items: [PhotosPickerItem]) async {
        guard let album else { return }
        adding = (0, items.count)
        let data = await loadPicks(items)
        await library.add(data, to: album) { adding = ($0, items.count) }
        adding = nil; picks = []
    }
}
