import Foundation
import UIKit

/// Talks to the Mantel web app (mantelapp.vercel.app) with the same session cookie the website uses.
/// The cookie lives in the app's cookie store (30 days, like a browser sign-in).
final class MantelAPI: @unchecked Sendable {
    static let shared = MantelAPI()

    static let defaultBase = URL(string: "https://mantelapp.vercel.app")!
    /// Public project URL (NEXT_PUBLIC_SUPABASE_URL) — needed to PUT uploads to the signed storage URLs.
    static let storageBase = URL(string: "https://xhdsibtqcvoqyblkihsm.supabase.co")!

    /// Read on the main thread at launch (UIDevice is main-actor only).
    nonisolated(unsafe) static var userAgent = "Mantel-iOS/1.0 (iPhone; Mobile)"
    nonisolated(unsafe) static var deviceName = "iPhone"
    @MainActor static func configure() {
        let pad = UIDevice.current.userInterfaceIdiom == .pad
        userAgent = "Mantel-iOS/1.0 (\(pad ? "iPad" : "iPhone"); Mobile)"
        deviceName = "Mantel on \(UIDevice.current.name)"
    }

    var base: URL {
        if let s = UserDefaults.standard.string(forKey: "server"), let u = URL(string: s), u.scheme != nil { return u }
        return Self.defaultBase
    }

    let session: URLSession = {
        let c = URLSessionConfiguration.default
        c.httpCookieStorage = .shared
        c.httpCookieAcceptPolicy = .always
        c.httpShouldSetCookies = true
        c.timeoutIntervalForRequest = 12
        c.waitsForConnectivity = false
        return URLSession(configuration: c)
    }()

    /// Data for a request. If URLSession times out or can't connect (often HTTP/3 being blocked), retry over plain TCP.
    func fetch(_ req0: URLRequest) async throws -> (Data, URLResponse) {
        var req = req0
        if UserDefaults.standard.bool(forKey: "tcpOnly") { return try await TCPFetch.data(for: req) }
        req.assumesHTTP3Capable = false
        do { return try await session.data(for: req) }
        catch let e as URLError where [.timedOut, .networkConnectionLost, .cannotConnectToHost, .secureConnectionFailed].contains(e.code) {
            let r = try await TCPFetch.data(for: req)
            // HTTP/3 is blocked on this network: go straight to TCP for the rest of this launch.
            UserDefaults.standard.set(true, forKey: "tcpOnly")
            return r
        }
    }

    enum APIError: LocalizedError {
        case unauthorized, server(String), offline
        var errorDescription: String? {
            switch self {
            case .unauthorized: "You've been signed out. Sign in again to refresh your albums."
            case .server(let m): m
            case .offline: "You're offline. Mantel is showing the photos saved on this device."
            }
        }
    }

    private func request(_ path: String, method: String = "GET", query: [URLQueryItem] = [], json: Any? = nil) async throws -> Data {
        var url = base.appending(path: path)
        if !query.isEmpty { url = url.appending(queryItems: query) }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.setValue(Self.userAgent, forHTTPHeaderField: "User-Agent")
        if let json {
            req.httpBody = try JSONSerialization.data(withJSONObject: json)
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        let data: Data, resp: URLResponse
        do { (data, resp) = try await fetch(req) }
        catch let e as URLError where [.notConnectedToInternet, .networkConnectionLost, .timedOut, .cannotFindHost, .dataNotAllowed].contains(e.code) {
            throw APIError.offline
        }
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        if code == 401 { throw APIError.unauthorized }
        guard (200..<300).contains(code) else {
            let msg = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String
            throw APIError.server(msg ?? "Mantel said \(code). Try again in a moment.")
        }
        return data
    }

    // MARK: Generic

    func get<T: Decodable>(_ path: String, query: [String: String] = [:]) async throws -> T {
        try JSONDecoder().decode(T.self, from: try await request(path, query: query.map { .init(name: $0.key, value: $0.value) }))
    }
    /// Endpoints that don't need a session (scripture, unsplash) — same call, named for clarity.
    func getPublic<T: Decodable>(_ path: String, query: [String: String] = [:]) async throws -> T {
        try await get(path, query: query)
    }
    @discardableResult
    func send(_ path: String, method: String, json: [String: Any]) async throws -> Data {
        try await request(path, method: method, json: json)
    }

    // MARK: Account

    func signIn(email: String, password: String) async throws -> APIUser {
        let data = try await request("api/auth/login", method: "POST",
                                     json: ["email": email, "password": password, "device_name": Self.deviceName])
        return try JSONDecoder().decode(Wrap<APIUser>.self, from: data, key: "user")
    }

    func me() async throws -> APIUser {
        let data = try await request("api/auth/me")
        return try JSONDecoder().decode(Wrap<APIUser>.self, from: data, key: "user")
    }

    func signOut() async {
        _ = try? await request("api/auth/logout", method: "POST")
        for c in HTTPCookieStorage.shared.cookies(for: base) ?? [] { HTTPCookieStorage.shared.deleteCookie(c) }
    }

    // MARK: Library

    func albums() async throws -> [APIAlbum] {
        struct R: Decodable { let albums: [APIAlbum] }
        return try JSONDecoder().decode(R.self, from: try await request("api/albums")).albums
    }

    /// Every photo in an album (pages of 200).
    func photos(album: String, media: String = "image") async throws -> [PhotoItem] {
        struct R: Decodable { let photos: [APIPhoto]; let total: Int? }
        var all: [PhotoItem] = [], offset = 0
        while true {
            let data = try await request("api/photos", query: [.init(name: "albumId", value: album), .init(name: "limit", value: "200"),
                                                               .init(name: "offset", value: String(offset)), .init(name: "mediaType", value: media)])
            let r = try JSONDecoder().decode(R.self, from: data)
            all += r.photos.filter { ($0.media_type ?? "image") == media }.map { $0.item(base: base) }
            offset += r.photos.count
            if r.photos.count < 200 || offset >= (r.total ?? 0) || offset > 5000 { break }
        }
        return all
    }

    func deletePhoto(_ id: String) async throws {
        _ = try await request("api/photos/\(id)", method: "DELETE")
    }

    func createUploadAlbum(name: String) async throws -> APIAlbum {
        let data = try await request("api/albums", method: "POST", json: ["name": name, "source_type": "upload"])
        return try JSONDecoder().decode(Wrap<APIAlbum>.self, from: data, key: "album")
    }

    /// Same flow as the website's uploader: ask for signed URLs, PUT the photo + thumbnail to storage, then register it.
    func upload(jpeg: Data, thumb: Data, width: Int, height: Int, takenAt: Date?, album: String, name: String?) async throws -> PhotoItem {
        struct Signed: Decodable { let imagePath: String; let imageToken: String; let thumbPath: String; let thumbToken: String }
        let signed = try JSONDecoder().decode(Signed.self, from: try await request(
            "api/photos/upload-url", method: "POST", json: ["albumId": album, "bytes": jpeg.count + thumb.count, "ext": "jpg"]))
        try await put(jpeg, path: signed.imagePath, token: signed.imageToken)
        try await put(thumb, path: signed.thumbPath, token: signed.thumbToken)
        var body: [String: Any] = ["albumId": album, "imagePath": signed.imagePath, "thumbPath": signed.thumbPath,
                                   "width": width, "height": height, "bytes": jpeg.count, "mimeType": "image/jpeg", "source": "ios"]
        if let takenAt { body["takenAt"] = ISO.string(takenAt) }
        if let name { body["originalName"] = name }
        let data = try await request("api/photos/register", method: "POST", json: body)
        return try JSONDecoder().decode(Wrap<APIPhoto>.self, from: data, key: "photo").item(base: base)
    }

    private func put(_ data: Data, path: String, token: String, type: String = "image/jpeg") async throws {
        try await putFile(nil, data: data, path: path, token: token, type: type)
    }

    /// PUT to a signed storage upload URL — from memory, or streamed from a file (videos).
    func putFileUpload(_ file: URL?, data: Data? = nil, path: String, token: String, type: String) async throws {
        try await putFile(file, data: data, path: path, token: token, type: type)
    }

    private func putFile(_ file: URL?, data: Data? = nil, path: String, token: String, type: String) async throws {
        var url = Self.storageBase.appending(path: "storage/v1/object/upload/sign/photos/\(path)")
        url = url.appending(queryItems: [.init(name: "token", value: token)])
        var req = URLRequest(url: url)
        req.httpMethod = "PUT"
        req.timeoutInterval = 600
        req.setValue(type, forHTTPHeaderField: "Content-Type")
        req.setValue("max-age=31536000", forHTTPHeaderField: "cache-control")
        let body: Data, resp: URLResponse
        if let file { (body, resp) = try await session.upload(for: req, fromFile: file) }
        else { (body, resp) = try await session.upload(for: req, from: data ?? Data()) }
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(code) else {
            throw APIError.server("Upload failed (\(code)): \(String(data: body, encoding: .utf8)?.prefix(120) ?? "")")
        }
    }
}

extension MantelAPI {
    /// Same flow as the website's video uploader: signed URLs → PUT the MP4 + poster → register with /api/videos.
    func uploadVideo(mp4: URL, poster: Data, width: Int, height: Int, durationMs: Int, takenAt: Date?, album: String, name: String?) async throws -> PhotoItem {
        struct Signed: Decodable { let videoPath: String; let videoToken: String; let posterPath: String; let posterToken: String }
        let bytes = (try? FileManager.default.attributesOfItem(atPath: mp4.path)[.size] as? Int) ?? 0
        let signed = try JSONDecoder().decode(Signed.self, from: try await send("api/videos/upload-url", method: "POST", json: ["albumId": album, "bytes": bytes]))
        try await putFileUpload(mp4, path: signed.videoPath, token: signed.videoToken, type: "video/mp4")
        try await putFileUpload(nil, data: poster, path: signed.posterPath, token: signed.posterToken, type: "image/jpeg")
        var body: [String: Any] = ["albumId": album, "videoPath": signed.videoPath, "posterPath": signed.posterPath,
                                   "width": width, "height": height, "durationMs": durationMs, "bytes": bytes]
        if let name { body["originalName"] = name }
        if let takenAt { body["takenAt"] = ISO.string(takenAt) }
        _ = try await send("api/videos", method: "POST", json: body)
        let pub = { (p: String) in Self.storageBase.appending(path: "storage/v1/object/public/photos/\(p)") }
        return PhotoItem(id: "up-\(UUID().uuidString.prefix(8))", albumId: album, fullURL: pub(signed.posterPath), thumbURL: pub(signed.posterPath),
                         isVideo: true, videoURL: pub(signed.videoPath), durationMs: durationMs, width: width, height: height, takenAt: takenAt ?? Date())
    }
}

/// Decodes `{ "<key>": T }`.
private struct Wrap<T: Decodable>: Decodable {
    let value: T
    struct K: CodingKey { var stringValue: String; var intValue: Int? { nil }; init(stringValue: String) { self.stringValue = stringValue }; init?(intValue: Int) { nil } }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: K.self)
        let key = decoder.userInfo[.wrapKey] as? String ?? ""
        value = try c.decode(T.self, forKey: K(stringValue: key))
    }
}
private extension CodingUserInfoKey { static let wrapKey = CodingUserInfoKey(rawValue: "wrapKey")! }
private extension JSONDecoder {
    func decode<T: Decodable>(_: Wrap<T>.Type, from data: Data, key: String) throws -> T {
        let d = JSONDecoder(); d.userInfo[.wrapKey] = key
        return try d.decode(Wrap<T>.self, from: data).value
    }
}
