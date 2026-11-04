import Foundation
import SwiftUI
import UIKit
import AppIntents
#if canImport(WidgetKit)
import WidgetKit
#endif

/// Storage both the app and the widgets can see. Photos the app downloads live in the group's
/// Caches folder, so the widgets (and StandBy) keep working offline.
enum AppGroup {
    static let id = "group.com.nanaamoako.mantel"

    static var container: URL {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: id)
            ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    }
    static var defaults: UserDefaults { UserDefaults(suiteName: id) ?? .standard }

    /// Library/Caches/Mantel — downloaded photos (full + thumbnails), safe for iOS to purge.
    static var cache: URL { dir(container.appending(path: "Library/Caches/Mantel")) }
    /// Library/Application Support/Mantel — things that must survive: albums list, photos you picked from your library.
    static var support: URL { dir(container.appending(path: "Library/Application Support/Mantel")) }
    /// Small copies for the widgets.
    static var widget: URL { dir(container.appending(path: "Library/Application Support/Mantel/Widget")) }
    static var widgetManifest: URL { widget.appending(path: "feed.json") }
    static var widgetAlbums: URL { widget.appending(path: "albums.json") }

    /// Where a widget feed entry's image is.
    static func widgetImageURL(_ file: String) -> URL {
        file.contains("/") ? container.appending(path: file) : widget.appending(path: file)
    }

    @discardableResult
    static func dir(_ url: URL) -> URL {
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }
}

/// What the widgets show: a rotation of small photos written by the app.
struct WidgetFeed: Codable {
    struct Item: Codable, Hashable {
        /// A plain file name lives in the Widget folder (linked-album copies only); a path with "/" is relative to the
        /// app-group container — the app's own download or on-device photo, read in place (no duplicate copies).
        var file: String
        var album: String
        var takenAt: Date?
        var albumId: String?
        /// In an album that's "Now showing" (the default widget rotation).
        var showing: Bool?
    }
    var items: [Item]
    var rotateMinutes: Int
    var updatedAt: Date

    static func load() -> WidgetFeed? {
        guard let data = try? Data(contentsOf: AppGroup.widgetManifest) else { return nil }
        let dec = JSONDecoder(); dec.dateDecodingStrategy = .iso8601
        return try? dec.decode(WidgetFeed.self, from: data)
    }
}

/// Launch request handed from the Control Center control / widget to the app.
enum LaunchRequest {
    static let key = "launch.frame"
    static func requestFrame() { AppGroup.defaults.set(Date().timeIntervalSince1970, forKey: key) }
    /// True (once) if a control asked for the frame in the last minute.
    static func consume() -> Bool {
        let t = AppGroup.defaults.double(forKey: key)
        guard t > 0 else { return false }
        AppGroup.defaults.removeObject(forKey: key)
        return Date().timeIntervalSince1970 - t < 60
    }
}

/// "Play Mantel": opens the app straight into the full-screen frame. Used by the
/// Control Center / Lock Screen control, the Action button, Shortcuts and Siri.
struct PlayFrameIntent: AppIntent {
    static let title: LocalizedStringResource = "Play Mantel"
    static let description = IntentDescription("Opens Mantel full screen and starts the slideshow.")
    static let openAppWhenRun = true

    func perform() async throws -> some IntentResult {
        LaunchRequest.requestFrame()
        await MainActor.run { NotificationCenter.default.post(name: .mantelPlayRequested, object: nil) }
        return .result()
    }
}

extension Notification.Name {
    static let mantelPlayRequested = Notification.Name("mantel.play")
}

// MARK: - Clean theme (GlamBooth's Clean app theme: sans-serif on off-white, the app red, smooth and quick)

extension Color {
    init(hex: UInt32, alpha: Double = 1) {
        self.init(.sRGB, red: Double((hex >> 16) & 0xff) / 255, green: Double((hex >> 8) & 0xff) / 255,
                  blue: Double(hex & 0xff) / 255, opacity: alpha)
    }
    /// A colour with separate light and dark values.
    init(light: UInt32, dark: UInt32, lightAlpha: Double = 1, darkAlpha: Double = 1) {
        self.init(uiColor: UIColor { t in
            let dark0 = t.userInterfaceStyle == .dark
            let v = dark0 ? dark : light, a = dark0 ? darkAlpha : lightAlpha
            return UIColor(red: CGFloat((v >> 16) & 0xff) / 255, green: CGFloat((v >> 8) & 0xff) / 255,
                           blue: CGFloat(v & 0xff) / 255, alpha: a)
        })
    }
}

enum Clean {
    // Tokens straight from glambooth web/src/themes.css → :root[data-theme='clean'] (+ dark mode).
    static let appBg   = Color(light: 0xf7f6f2, dark: 0x121110)
    static let paper   = Color(light: 0xffffff, dark: 0x1c1b18)
    static let cream   = Color(light: 0xefede8, dark: 0x26241f)
    static let butter  = Color(light: 0xecebe6, dark: 0x2c2a26)   // secondary button
    static let field   = Color(light: 0xffffff, dark: 0x24221f)
    static let pink    = Color(light: 0xf7dfe0, dark: 0x3a2224)
    static let cherry  = Color(light: 0xc1272d, dark: 0xef5b5f)
    static let ink     = Color(light: 0x1c1a19, dark: 0xf2efe9)   // --cocoa
    static let label   = Color(light: 0x77736d, dark: 0xa39e96)
    static let line    = Color(light: 0x000000, dark: 0xffffff, lightAlpha: 0.08, darkAlpha: 0.10)
    static let green   = Color(hex: 0x34c759)
    static let toast   = Color(light: 0x1c1a19, dark: 0xf2efe9)
    static let toastInk = Color(light: 0xffffff, dark: 0x121110)

    static let radius: CGFloat = 20
    static let btnRadius: CGFloat = 14
    static let fieldRadius: CGFloat = 12

    /// cubic-bezier(.32, .72, 0, 1) — the Clean theme's ease.
    static func ease(_ d: Double = 0.45) -> Animation { .timingCurve(0.32, 0.72, 0, 1, duration: d) }
    static let spring = Animation.spring(response: 0.42, dampingFraction: 0.86)
}

extension Font {
    enum FigtreeWeight: String { case regular = "Regular", medium = "Medium", semibold = "SemiBold", bold = "Bold", extrabold = "ExtraBold" }
    static func figtree(_ size: CGFloat, _ w: FigtreeWeight = .regular, relativeTo style: Font.TextStyle = .body) -> Font {
        .custom("Figtree-\(w.rawValue)", size: size, relativeTo: style)
    }
    /// The Clean display face: Figtree 800, tight tracking (apply .tracking(display tracking) on Text).
    static func display(_ size: CGFloat) -> Font { .custom("Figtree-ExtraBold", size: size, relativeTo: .largeTitle) }
}

/// Albums the widgets can be set to (written by the app).
struct WidgetAlbum: Codable, Hashable { var id: String; var name: String; var count: Int }
