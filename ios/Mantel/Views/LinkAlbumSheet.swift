import SwiftUI
import Photos

/// Pick an album from the iPhone's Photos app to show on Mantel. Nothing is copied or uploaded —
/// the album is read live from Photos, so new photos you add there show up here too.
struct LinkAlbumSheet: View {
    @Environment(Library.self) private var library
    @Environment(\.dismiss) private var dismiss
    @State private var status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
    @State private var albums: [PHAssetCollection] = []

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Kicker("iPhone Photos", icon: "photo.on.rectangle")
                Display("Link an *album*", size: 30)
                Text("Streams straight from your Photos app. Nothing is uploaded or copied, and the album stays up to date — photos and videos you add in Photos show up here.")
                    .font(.figtree(15, .medium)).foregroundStyle(Clean.label)
                switch status {
                case .authorized:
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 14)], spacing: 16) {
                        ForEach(albums, id: \.localIdentifier) { c in
                            Button { library.linkLibraryAlbum(c); dismiss() } label: { LibraryAlbumCard(collection: c) }
                                .buttonStyle(PressScale())
                        }
                    }
                case .limited:
                    note("Mantel can only see the photos you selected. To link whole albums, allow Full Access in Settings → Mantel → Photos.")
                default:
                    note("Allow Mantel to read your Photos library to link albums. Nothing leaves your iPhone.")
                }
            }
            .padding(24)
        }
        .background(Clean.appBg.ignoresSafeArea())
        .presentationDetents([.large])
        .presentationCornerRadius(28)
        .task {
            if status == .notDetermined { status = await PHPhotoLibrary.requestAuthorization(for: .readWrite) }
            if status == .authorized { albums = Self.fetchAlbums() }
        }
    }

    private func note(_ text: String) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(text).font(.figtree(15, .semibold)).foregroundStyle(Clean.ink)
            Button("Open Settings") { if let u = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(u) } }
                .buttonStyle(CleanButton(kind: .primary, size: 48))
        }
        .card(padding: 16)
    }

    /// Favourites, Recents and other useful smart albums first, then your own albums.
    static func fetchAlbums() -> [PHAssetCollection] {
        var out: [PHAssetCollection] = []
        for sub in [PHAssetCollectionSubtype.smartAlbumFavorites, .smartAlbumUserLibrary, .smartAlbumSelfPortraits, .smartAlbumDepthEffect,
                    .smartAlbumVideos, .smartAlbumLivePhotos, .smartAlbumPanoramas] {
            PHAssetCollection.fetchAssetCollections(with: .smartAlbum, subtype: sub, options: nil).enumerateObjects { c, _, _ in out.append(c) }
        }
        let opts = PHFetchOptions()
        opts.sortDescriptors = [NSSortDescriptor(key: "localizedTitle", ascending: true)]
        PHAssetCollection.fetchAssetCollections(with: .album, subtype: .any, options: opts).enumerateObjects { c, _, _ in out.append(c) }
        return out.filter { PHAsset.fetchAssets(in: $0, options: nil).count > 0 }
    }
}

struct LibraryAlbumCard: View {
    let collection: PHAssetCollection
    @State private var cover: UIImage?
    @State private var count = 0
    @Environment(Library.self) private var library

    var body: some View {
        let linked = library.albums.contains { $0.libraryId == collection.localIdentifier }
        VStack(alignment: .leading, spacing: 8) {
            Color.clear.aspectRatio(1, contentMode: .fit)
                .overlay { if let cover { Image(uiImage: cover).resizable().scaledToFill() } else { Clean.cream } }
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(alignment: .topTrailing) {
                    if linked { Image(systemName: "checkmark.circle.fill").font(.system(size: 22)).foregroundStyle(.white, Clean.cherry).padding(8) }
                }
            Text(collection.localizedTitle ?? "Album").font(.figtree(15, .bold)).foregroundStyle(Clean.ink).lineLimit(1)
            Text("\(count) item\(count == 1 ? "" : "s")").font(.figtree(13, .semibold)).foregroundStyle(Clean.label)
        }
        .task {
            let opts = PHFetchOptions()
            opts.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
            let assets = PHAsset.fetchAssets(in: collection, options: opts)
            count = assets.count
            if let first = assets.firstObject { cover = await ImageCache.libraryImage(first.localIdentifier, max: 400) }
        }
    }
}
