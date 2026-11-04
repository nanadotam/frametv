import Foundation
import SwiftUI
import Observation
import Network
import WidgetKit
import UIKit
import Photos

/// Your albums and photos, what's "Now showing", and what's saved for offline.
/// Everything is kept on the device so the app opens straight into your photos, online or not.
@Observable @MainActor
final class Library {
    static let shared = Library()

    // Account
    var user: APIUser?
    var signedIn: Bool { user != nil }
    var onboarded: Bool { didSet { UserDefaults.standard.set(onboarded, forKey: "onboarded") } }

    // Content
    private(set) var albums: [AlbumItem] = []
    private(set) var photos: [String: [PhotoItem]] = [:]
    /// Videos per album (Video mode). Mantel videos stream from storage; iPhone videos play from Photos.
    private(set) var videos: [String: [PhotoItem]] = [:]
    var showing: Set<String> = [] { didSet { persist(); scheduleSync() } }
    private(set) var hidden: Set<String> = []

    // Status
    private(set) var refreshing = false
    private(set) var lastSynced: Date?
    private(set) var online = true
    private(set) var expensive = false
    private(set) var saved: [String: Int] = [:]          // album → photos saved on this device
    private(set) var downloading: (done: Int, total: Int)?
    var toast: String?

    private let monitor = NWPathMonitor()
    private var syncTask: Task<Void, Never>?
    private var file: URL { AppGroup.support.appending(path: "library.json") }

    private struct Snapshot: Codable {
        var user: APIUser?; var albums: [AlbumItem]; var photos: [String: [PhotoItem]]; var videos: [String: [PhotoItem]]?
        var showing: Set<String>; var hidden: Set<String>; var lastSynced: Date?
    }

    private init() {
        onboarded = UserDefaults.standard.bool(forKey: "onboarded")
        if let data = try? Data(contentsOf: file), let s = try? JSONDecoder().decode(Snapshot.self, from: data) {
            user = s.user; albums = s.albums; photos = s.photos; videos = s.videos ?? [:]; hidden = s.hidden; lastSynced = s.lastSynced
            showing = s.showing
        }
        recountSaved()
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                guard let self else { return }
                let was = self.online
                self.online = path.status == .satisfied
                self.expensive = path.isExpensive
                if !was && self.online { await self.refresh(quiet: true) }
            }
        }
        monitor.start(queue: .global(qos: .utility))
        if albums.contains(where: \.isLibrary) { startWatchingPhotos() }
    }

    private func persist() {
        let s = Snapshot(user: user, albums: albums, photos: photos, videos: videos, showing: showing, hidden: hidden, lastSynced: lastSynced)
        if let data = try? JSONEncoder().encode(s) { try? data.write(to: file, options: .atomic) }
    }

    // MARK: - What the frame plays

    /// Photos in the albums you're showing (everything, if none are picked), minus hidden ones.
    /// Offline, only photos saved on the device.
    var playlist: [PhotoItem] {
        let ids = showing.isEmpty ? albums.map(\.id) : albums.map(\.id).filter(showing.contains)
        var out = ids.flatMap { photos[$0] ?? [] }.filter { !hidden.contains($0.id) }
        if !online { out = out.filter { ImageCache.shared.isSaved($0) } }
        return out
    }

    /// Videos in the albums you're showing, for Video mode.
    var videoPlaylist: [PhotoItem] {
        let ids = showing.isEmpty ? albums.map(\.id) : albums.map(\.id).filter(showing.contains)
        var out = ids.flatMap { videos[$0] ?? [] }.filter { !hidden.contains($0.id) }
        if !online { out = out.filter { $0.assetId != nil || VideoCache.isSaved($0) } }
        return out
    }

    func album(_ id: String) -> AlbumItem? { albums.first { $0.id == id } }
    func count(_ id: String) -> Int { (photos[id] ?? []).filter { !hidden.contains($0.id) }.count }
    func videoCount(_ id: String) -> Int { (videos[id] ?? []).filter { !hidden.contains($0.id) }.count }
    func cover(_ a: AlbumItem) -> PhotoItem? {
        let list = photos[a.id] ?? []
        return list.first { $0.id == a.coverPhotoId } ?? list.first
    }
    func isShowing(_ id: String) -> Bool { showing.isEmpty || showing.contains(id) }
    func toggleShowing(_ id: String) {
        if showing.isEmpty { showing = Set(albums.map(\.id)) }
        if showing.contains(id) { showing.remove(id) } else { showing.insert(id) }
        if showing.count == albums.count { showing = [] }      // all on = "everything", new albums included
        UISelectionFeedbackGenerator().selectionChanged()
    }

    // MARK: - Account

    func signIn(email: String, password: String) async throws {
        let u = try await MantelAPI.shared.signIn(email: email.trimmingCharacters(in: .whitespaces), password: password)
        user = u; onboarded = true; persist()
        await refresh()
    }

    func signOut() async {
        await MantelAPI.shared.signOut()
        let cloud = albums.filter { !$0.isDevice }.map(\.id)
        for id in cloud { await ImageCache.shared.removeAlbum(id); photos[id] = nil }
        albums.removeAll { $0.kind == .cloud }
        showing.subtract(cloud)
        user = nil
        persist(); recountSaved(); writeWidgetFeed()
    }

    // MARK: - Sync

    /// Fetch albums + photos from Mantel, then save the showing albums for offline.
    func refresh(quiet: Bool = false) async {
        reloadLibraryAlbums()
        guard signedIn, !refreshing else { scheduleSync(); return }
        refreshing = true
        defer { refreshing = false }
        do {
            let remote = try await MantelAPI.shared.albums()
            var next: [String: [PhotoItem]] = photos
            var nextVideos: [String: [PhotoItem]] = videos
            try await withThrowingTaskGroup(of: (String, [PhotoItem], [PhotoItem]).self) { g in
                for a in remote {
                    g.addTask {
                        async let p = MantelAPI.shared.photos(album: a.id)
                        let v = (try? await MantelAPI.shared.photos(album: a.id, media: "video")) ?? []
                        return (a.id, try await p, v)
                    }
                }
                for try await (id, list, vids) in g { next[id] = list; nextVideos[id] = vids }
            }
            let cloud = remote.map { a in
                AlbumItem(id: a.id, name: a.name, kind: .cloud, source: a.source_type, coverPhotoId: a.cover_photo_id,
                          order: a.display_order ?? 0, updatedAt: a.updated_at.flatMap(ISO.parse))
            }
            // Albums deleted on the website: drop them and their downloads.
            let gone = Set(albums.filter { !$0.isDevice }.map(\.id)).subtracting(cloud.map(\.id))
            for id in gone { next[id] = nil; nextVideos[id] = nil; await ImageCache.shared.removeAlbum(id) }
            showing.subtract(gone)
            albums = cloud.sorted { $0.order < $1.order } + albums.filter(\.isLocal)
            photos = next
            videos = nextVideos
            lastSynced = Date()
            persist()
        } catch MantelAPI.APIError.unauthorized {
            user = nil; persist()
            if !quiet { toast = MantelAPI.APIError.unauthorized.errorDescription }
        } catch {
            if !quiet { toast = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription }
        }
        scheduleSync()
    }

    /// Save every photo in the showing albums (newest first), keeping downloads under the limit.
    func scheduleSync() {
        syncTask?.cancel()
        syncTask = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(400))
            await self?.downloadShowing()
        }
    }

    private func downloadShowing() async {
        let prefs = Prefs.shared
        let wanted = playlist.filter { $0.localFile == nil && $0.assetId == nil }
        Task.detached(priority: .background) { [videoPlaylist = self.videoPlaylist, wifi = !self.expensive] in
            if wifi { await VideoCache.prefetch(Array(videoPlaylist.prefix(12))) }
        }
        let limit = Int64(prefs.cacheLimitMB) * 1024 * 1024
        let missing = wanted.filter { !ImageCache.shared.isSaved($0) }
        defer { downloading = nil; recountSaved(); writeWidgetFeed() }
        guard online, !(prefs.wifiOnly && expensive), !missing.isEmpty else { return }
        // Rough budget: ~450 KB a photo. Don't fetch more than fits.
        let budget = max(20, Int(limit / (450 * 1024)))
        let queue = Array(missing.prefix(budget))
        downloading = (0, queue.count)
        var i = 0
        await withTaskGroup(of: Void.self) { g in
            var it = queue.makeIterator()
            func next() -> PhotoItem? { it.next() }
            for _ in 0..<4 { if let p = next() { g.addTask { _ = await ImageCache.shared.save(p) } } }
            while await g.next() != nil {
                if Task.isCancelled { g.cancelAll(); break }
                i += 1
                downloading = (i, queue.count)
                if i % 12 == 0 { recountSaved() }
                if let p = next() { g.addTask { _ = await ImageCache.shared.save(p) } }
            }
        }
        await ImageCache.shared.trim(to: limit, keep: Set(wanted.prefix(budget).map(\.id)))
    }

    func recountSaved() {
        var out: [String: Int] = [:]
        for a in albums { out[a.id] = (photos[a.id] ?? []).filter { ImageCache.shared.isSaved($0) }.count }
        saved = out
    }

    // MARK: - Removing things

    func removeDownloads(album id: String) async {
        await ImageCache.shared.removeAlbum(id)
        recountSaved(); writeWidgetFeed()
        toast = "Removed downloads from this \(UIDevice.current.userInterfaceIdiom == .pad ? "iPad" : "iPhone")"
    }

    func clearAllDownloads() async {
        await ImageCache.shared.removeAll()
        recountSaved(); writeWidgetFeed()
        toast = "Cleared every download"
    }

    func removeDownload(_ ids: Set<String>) async {
        for p in allPhotos where ids.contains(p.id) && p.localFile == nil { await ImageCache.shared.remove(p) }
        recountSaved(); writeWidgetFeed()
    }

    /// Hide from the frame and widgets on this device (the photo stays in your Mantel library).
    func hide(_ ids: Set<String>) async {
        hidden.formUnion(ids)
        await removeDownload(ids)
        persist()
        toast = ids.count == 1 ? "Hidden from this frame" : "\(ids.count) photos hidden from this frame"
    }
    func unhideAll(album: String) {
        let ids = Set((photos[album] ?? []).map(\.id))
        hidden.subtract(ids); persist(); scheduleSync()
    }
    func hiddenCount(album: String) -> Int { (photos[album] ?? []).filter { hidden.contains($0.id) }.count }

    /// Deletes photos for good: device photos from this device, Mantel photos from your account.
    func delete(_ ids: Set<String>) async {
        var failed = 0
        for p in allPhotos where ids.contains(p.id) {
            if p.assetId != nil { hidden.insert(p.id); continue }   // never delete from the iPhone's Photos
            if let f = p.localFile {
                try? FileManager.default.removeItem(at: ImageCache.deviceDir.appending(path: f))
            } else {
                do { try await MantelAPI.shared.deletePhoto(p.id) } catch { failed += 1; continue }
                await ImageCache.shared.remove(p)
            }
            photos[p.albumId]?.removeAll { $0.id == p.id }
        }
        persist(); recountSaved(); writeWidgetFeed()
        toast = failed > 0 ? "Couldn't delete \(failed) — check your connection" : (ids.count == 1 ? "Photo deleted" : "\(ids.count) photos deleted")
    }

    func deleteDeviceAlbum(_ id: String) {
        if album(id)?.isLibrary == true {
            photos[id] = nil; videos[id] = nil
            albums.removeAll { $0.id == id }; showing.remove(id)
            persist(); recountSaved(); writeWidgetFeed()
            toast = "Album unlinked — nothing was removed from Photos"
            return
        }
        for p in photos[id] ?? [] { if let f = p.localFile { try? FileManager.default.removeItem(at: ImageCache.deviceDir.appending(path: f)) } }
        photos[id] = nil
        albums.removeAll { $0.id == id }
        showing.remove(id)
        persist(); recountSaved(); writeWidgetFeed()
        toast = "Album deleted"
    }

    func rename(_ id: String, to name: String) {
        guard let i = albums.firstIndex(where: { $0.id == id }) else { return }
        albums[i].name = name; persist()
    }

    private var allPhotos: [PhotoItem] { photos.values.flatMap { $0 } + videos.values.flatMap { $0 } }

    func appendVideo(_ v: PhotoItem) {
        videos[v.albumId, default: []].insert(v, at: 0)
        persist()
    }

    // MARK: - Linked iPhone albums (PhotoKit)

    /// Links an album from the iPhone's Photos app. Nothing is copied or uploaded: photos and videos are read
    /// from Photos whenever they're shown, and the album stays in step as you add or remove things in Photos.
    @discardableResult
    func linkLibraryAlbum(_ c: PHAssetCollection) -> AlbumItem {
        if let existing = albums.first(where: { $0.libraryId == c.localIdentifier }) { return existing }
        let safe = c.localIdentifier.replacingOccurrences(of: "/", with: "_")
        let a = AlbumItem(id: "lib-\(safe)", name: c.localizedTitle ?? "iPhone album", kind: .library, source: "library",
                          coverPhotoId: nil, order: 20_000 + albums.count, updatedAt: Date(), libraryId: c.localIdentifier)
        albums.append(a)
        if !showing.isEmpty { showing.insert(a.id) }
        load(a)
        persist(); recountSaved(); writeWidgetFeed()
        startWatchingPhotos()
        toast = "Linked \(a.name) from Photos"
        return a
    }

    private func load(_ a: AlbumItem) {
        guard let lid = a.libraryId,
              let c = PHAssetCollection.fetchAssetCollections(withLocalIdentifiers: [lid], options: nil).firstObject else { return }
        let opts = PHFetchOptions()
        opts.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
        let result = PHAsset.fetchAssets(in: c, options: opts)
        var pics: [PhotoItem] = [], vids: [PhotoItem] = []
        result.enumerateObjects { asset, _, _ in
            let id = "a-" + asset.localIdentifier.replacingOccurrences(of: "/", with: "_")
            var item = PhotoItem(id: id, albumId: a.id, assetId: asset.localIdentifier,
                                 width: asset.pixelWidth, height: asset.pixelHeight, takenAt: asset.creationDate)
            if asset.mediaType == .video { item.isVideo = true; item.durationMs = Int(asset.duration * 1000); vids.append(item) }
            else if asset.mediaType == .image { pics.append(item) }
        }
        photos[a.id] = pics
        videos[a.id] = vids
        if let i = albums.firstIndex(where: { $0.id == a.id }) { albums[i].name = c.localizedTitle ?? a.name }
    }

    func reloadLibraryAlbums() {
        let linked = albums.filter(\.isLibrary)
        guard !linked.isEmpty, PHPhotoLibrary.authorizationStatus(for: .readWrite) != .notDetermined else { return }
        for a in linked { load(a) }
        persist(); recountSaved()
    }

    private var photosObserver: PhotosObserver?
    private func startWatchingPhotos() {
        guard photosObserver == nil else { return }
        let o = PhotosObserver { [weak self] in
            Task { @MainActor in self?.reloadLibraryAlbums(); self?.writeWidgetFeed() }
        }
        PHPhotoLibrary.shared().register(o)
        photosObserver = o
    }

    // MARK: - Adding photos

    @discardableResult
    func newDeviceAlbum(_ name: String) -> AlbumItem {
        let a = AlbumItem(id: "device-\(UUID().uuidString.prefix(8).lowercased())", name: name, kind: .device, source: "device",
                          coverPhotoId: nil, order: 10_000 + albums.count, updatedAt: Date())
        albums.append(a); photos[a.id] = []
        if !showing.isEmpty { showing.insert(a.id) }
        persist()
        return a
    }

    func newCloudAlbum(_ name: String) async -> AlbumItem? {
        do {
            let r = try await MantelAPI.shared.createUploadAlbum(name: name)
            let a = AlbumItem(id: r.id, name: r.name, kind: .cloud, source: "upload", coverPhotoId: nil, order: r.display_order ?? 0, updatedAt: Date())
            albums.insert(a, at: albums.firstIndex(where: \.isDevice) ?? albums.count)
            photos[a.id] = []
            if !showing.isEmpty { showing.insert(a.id) }
            persist()
            return a
        } catch {
            toast = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            return nil
        }
    }

    /// Adds picked photos. Device albums keep a 2048 px copy here; upload albums send it to Mantel too.
    func add(_ images: [(data: Data, date: Date?)], to album: AlbumItem, progress: @escaping (Int) -> Void) async {
        var added = 0, failed = 0
        for (i, item) in images.enumerated() {
            progress(i)
            guard let img = ImageCache.downsample(data: item.data, max: 2048), let jpeg = img.jpegData(compressionQuality: 0.88) else { failed += 1; continue }
            let w = Int(img.size.width), h = Int(img.size.height)
            if album.isDevice {
                let name = "\(UUID().uuidString.lowercased()).jpg"
                do { try jpeg.write(to: ImageCache.deviceDir.appending(path: name), options: .atomic) } catch { failed += 1; continue }
                photos[album.id, default: []].insert(PhotoItem(id: "d-\(name.prefix(13))", albumId: album.id, localFile: name,
                                                               width: w, height: h, takenAt: item.date ?? Date()), at: 0)
                added += 1
            } else {
                guard let thumb = ImageCache.downsample(data: jpeg, max: 480)?.jpegData(compressionQuality: 0.8) else { failed += 1; continue }
                do {
                    var p = try await MantelAPI.shared.upload(jpeg: jpeg, thumb: thumb, width: w, height: h, takenAt: item.date,
                                                              album: album.id, name: nil)
                    // Save what we just sent so it's on the device straight away.
                    let f = ImageCache.shared.fileURL(p, .full)
                    AppGroup.dir(f.deletingLastPathComponent())
                    try? jpeg.write(to: f); try? thumb.write(to: ImageCache.shared.fileURL(p, .thumb))
                    p.albumId = album.id
                    photos[album.id, default: []].insert(p, at: 0)
                    added += 1
                } catch {
                    failed += 1
                    toast = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
                }
            }
            if i % 5 == 0 { persist() }
        }
        progress(images.count)
        persist(); recountSaved(); writeWidgetFeed()
        if failed == 0 { toast = added == 1 ? "Added 1 photo" : "Added \(added) photos" }
        else if added > 0 { toast = "Added \(added), \(failed) didn't go through" }
    }

    // MARK: - Widgets & StandBy

    /// Writes small copies of saved photos for the widgets, then asks iOS to redraw them.
    func writeWidgetFeed() {
        // Saved photos from every album (so a widget can be set to one album), newest-viewed first,
        // with the "Now showing" ones flagged for the default rotation.
        let showingIds = Set(playlist.map(\.id))
        var pick: [PhotoItem] = []
        var albumsOut: [WidgetAlbum] = []
        for a in albums {
            let saved = (photos[a.id] ?? []).filter { !hidden.contains($0.id) && ImageCache.shared.isSaved($0) }
            guard !saved.isEmpty else { continue }
            let chosen = Array((Prefs.shared.shuffle ? saved.shuffled() : saved).prefix(30))
            pick += chosen
            albumsOut.append(WidgetAlbum(id: a.id, name: a.name, count: chosen.count))
        }
        pick = Array(pick.prefix(240))
        let names = Dictionary(uniqueKeysWithValues: albums.map { ($0.id, $0.name) })
        let minutes = Prefs.shared.widgetMinutes
        Task.detached(priority: .utility) {
            let dir = AppGroup.widget
            var items: [WidgetFeed.Item] = []
            var keep = Set<String>(["feed.json", "albums.json", "verse.json", "verse.jpg"])
            for p in pick {
                let file = "\(p.id).jpg"
                keep.insert(file)
                let dest = dir.appending(path: file)
                if !FileManager.default.fileExists(atPath: dest.path) {
                    let src = p.localFile.map { ImageCache.deviceDir.appending(path: $0) } ?? ImageCache.shared.fileURL(p, .full)
                    // Widgets have a tight memory budget: ~900 px is sharp on a StandBy screen.
                    var img: UIImage?
                    if let a = p.assetId { img = await ImageCache.libraryImage(a, max: 900) } else { img = ImageCache.downsample(url: src, max: 900) }
                    guard let img, let d = img.jpegData(compressionQuality: 0.8) else { continue }
                    try? d.write(to: dest, options: .atomic)
                }
                items.append(.init(file: file, album: names[p.albumId] ?? "Mantel", takenAt: p.takenAt, albumId: p.albumId, showing: showingIds.contains(p.id)))
            }
            for f in (try? FileManager.default.contentsOfDirectory(atPath: dir.path)) ?? [] where !keep.contains(f) {
                try? FileManager.default.removeItem(at: dir.appending(path: f))
            }
            let feed = WidgetFeed(items: items, rotateMinutes: minutes, updatedAt: Date())
            let enc = JSONEncoder(); enc.dateEncodingStrategy = .iso8601
            if let d = try? enc.encode(feed) { try? d.write(to: AppGroup.widgetManifest, options: .atomic) }
            if let d = try? JSONEncoder().encode(albumsOut) { try? d.write(to: AppGroup.widgetAlbums, options: .atomic) }
            WidgetCenter.shared.reloadAllTimelines()
        }
    }
}

/// Tells the library when anything changes in the Photos app (debounced).
final class PhotosObserver: NSObject, PHPhotoLibraryChangeObserver, @unchecked Sendable {
    private let onChange: @Sendable () -> Void
    private var pending: DispatchWorkItem?
    init(_ onChange: @escaping @Sendable () -> Void) { self.onChange = onChange }
    func photoLibraryDidChange(_ changeInstance: PHChange) {
        pending?.cancel()
        let w = DispatchWorkItem(block: onChange)
        pending = w
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5, execute: w)
    }
}
