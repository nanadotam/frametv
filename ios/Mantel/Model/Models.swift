import Foundation

/// An album on your Mantel account, or one made on this device from your photo library.
struct AlbumItem: Codable, Identifiable, Hashable {
    enum Kind: String, Codable { case cloud, device }
    var id: String
    var name: String
    var kind: Kind
    var source: String            // drive | picker | upload | device
    var coverPhotoId: String?
    var order: Int
    var updatedAt: Date?

    var isDevice: Bool { kind == .device }
    /// Cloud albums you can add photos to from the phone (uploads go to Mantel's storage).
    var acceptsUploads: Bool { kind == .cloud && source == "upload" }
    var sourceLabel: String {
        switch source {
        case "drive": "Google Drive"
        case "picker": "Google Photos"
        case "upload": "Uploads"
        default: "On this iPhone"
        }
    }
}

struct PhotoItem: Codable, Identifiable, Hashable {
    var id: String
    var albumId: String
    var fullURL: URL?
    var thumbURL: URL?
    /// Device-album photos: the file name in Application Support (never purged).
    var localFile: String?
    var width: Int?
    var height: Int?
    var takenAt: Date?

    var isPortrait: Bool { (height ?? 0) > (width ?? 0) }
    var aspect: CGFloat {
        guard let w = width, let h = height, w > 0, h > 0 else { return 1 }
        return CGFloat(w) / CGFloat(h)
    }
}

// MARK: - Server JSON (mantelapp.vercel.app, see SCHEMA.md)

struct APIUser: Codable, Equatable { let id: String; let email: String; let username: String?; let name: String? }

struct APIAlbum: Decodable {
    let id: String
    let name: String
    let source_type: String
    let cover_photo_id: String?
    let display_order: Int?
    let updated_at: String?
}

struct APIPhoto: Decodable {
    let id: String
    let album_id: String
    let source_type: String
    let source_id: String?
    let storage_path: String?
    let thumbnail_path: String?
    let width: Int?
    let height: Int?
    let taken_at: String?
    let media_type: String?

    /// Mirrors src/lib/image-urls.ts: Drive photos come straight from Google's CDN at the size we ask for;
    /// uploads are already resolved to public storage URLs by /api/photos.
    func item(base: URL) -> PhotoItem {
        var full: URL?, thumb: URL?
        if source_type == "drive", let sid = source_id {
            full = URL(string: "https://drive.google.com/thumbnail?id=\(sid)&sz=w2048")
            thumb = URL(string: "https://drive.google.com/thumbnail?id=\(sid)&sz=w480")
        } else {
            let resolve: (String?) -> URL? = { s in
                guard let s, !s.isEmpty else { return nil }
                return s.hasPrefix("http") ? URL(string: s) : nil
            }
            full = resolve(storage_path) ?? resolve(thumbnail_path)
            thumb = resolve(thumbnail_path) ?? full
            if full == nil {
                full = base.appending(path: "api/photos/\(id)/thumbnail").appending(queryItems: [.init(name: "size", value: "2000")])
                thumb = base.appending(path: "api/photos/\(id)/thumbnail").appending(queryItems: [.init(name: "size", value: "400")])
            }
        }
        return PhotoItem(id: id, albumId: album_id, fullURL: full, thumbURL: thumb, localFile: nil,
                         width: width, height: height, takenAt: taken_at.flatMap(ISO.parse))
    }
}

enum ISO {
    private static let a: ISO8601DateFormatter = { let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f }()
    private static let b = ISO8601DateFormatter()
    static func parse(_ s: String) -> Date? { a.date(from: s) ?? b.date(from: s) }
    static func string(_ d: Date) -> String { b.string(from: d) }
}
