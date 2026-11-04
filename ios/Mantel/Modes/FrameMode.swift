import SwiftUI

/// The display modes, matching the web display (src/lib/modeMetadata.ts) plus the phone-only Nightstand.
enum FrameMode: String, CaseIterable, Identifiable, Codable {
    case slideshow, grid, pinterest, scrapbook, coverflow
    case clock, scripture, mood, nightstand
    case flipboard, easel, tasks

    var id: String { rawValue }

    enum Category: String, CaseIterable { case photos, ambient, boards
        var title: String { switch self { case .photos: "Photos"; case .ambient: "Ambient"; case .boards: "Boards" } }
        var blurb: String {
            switch self {
            case .photos: "Albums, galleries and moving photo layouts"
            case .ambient: "Clock, scripture, mood and calm displays"
            case .boards: "Messages, writing and task boards"
            }
        }
    }

    var category: Category {
        switch self {
        case .slideshow, .grid, .pinterest, .scrapbook, .coverflow: .photos
        case .clock, .scripture, .mood, .nightstand: .ambient
        case .flipboard, .easel, .tasks: .boards
        }
    }

    var title: String {
        switch self {
        case .slideshow: "Slideshow"; case .grid: "Grid"; case .pinterest: "Pinterest"; case .scrapbook: "Scrapbook"
        case .coverflow: "Cover Flow"; case .clock: "Clock"; case .scripture: "Scripture"; case .mood: "Mood"
        case .nightstand: "Nightstand"; case .flipboard: "FlipBoard"; case .easel: "Easel"; case .tasks: "Eisenhower"
        }
    }

    var blurb: String {
        switch self {
        case .slideshow: "One photo at a time with smooth transitions"
        case .grid: "Mosaic grid of photos, one tile changing at a time"
        case .pinterest: "Scrolling masonry columns"
        case .scrapbook: "Polaroids tossed and taped across the screen"
        case .coverflow: "3D cover flow carousel"
        case .clock: "Large ambient clock"
        case .scripture: "Verse of the day on a matching landscape"
        case .mood: "Curated Unsplash photos by mood"
        case .nightstand: "Big clock beside your photo, red at night"
        case .flipboard: "Split-flap board with your messages"
        case .easel: "Rotating text messages"
        case .tasks: "Your tasks in four priority quadrants"
        }
    }

    var icon: String {
        switch self {
        case .slideshow: "photo"; case .grid: "square.grid.3x3.fill"; case .pinterest: "rectangle.3.group.fill"
        case .scrapbook: "photo.stack"; case .coverflow: "rectangle.stack"; case .clock: "clock"
        case .scripture: "book.closed"; case .mood: "mountain.2"; case .nightstand: "bed.double"
        case .flipboard: "text.bubble"; case .easel: "pencil.line"; case .tasks: "checklist"
        }
    }

    /// Colour for the mode card (Clean palette, one per category).
    var tint: Color {
        switch category { case .photos: Color(hex: 0x2f7dd1); case .ambient: Color(hex: 0xd9822b); case .boards: Color(hex: 0x2e9b6a) }
    }

    /// The same mode on the web/TV display (user_modes.id), for the Remote.
    var webId: String? {
        switch self {
        case .slideshow: "slideshow-single"; case .grid: "slideshow-grid"; case .pinterest: "pinterest"; case .scrapbook: "scrapbook"
        case .coverflow: "coverflow"; case .clock: "clock-text"; case .scripture: "scripture"; case .mood: "unsplash-mood"
        case .flipboard: "flipboard"; case .easel: "easel"; case .tasks: "eisenhower"; case .nightstand: nil
        }
    }

    /// Modes that show your albums (swipe changes photo, PiP shows the current one).
    var usesPhotos: Bool { category == .photos || self == .nightstand }
    var needsAccount: Bool { self == .tasks }

    static func forWeb(_ id: String?) -> FrameMode? { allCases.first { $0.webId == id } }

    /// Web-only modes the Remote can still switch the TV to.
    static let webOnly: [(id: String, title: String, icon: String)] = [
        ("video", "Video", "film"), ("vinyl", "Vinyl", "opticaldisc"),
    ]
}
