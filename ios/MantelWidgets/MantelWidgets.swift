import WidgetKit
import SwiftUI
import AppIntents
import ImageIO

// Mantel's widgets: Home Screen, StandBy (iPhone on its side, charging) and iPad.
// The app writes small copies of saved photos to the shared app group (Library.writeWidgetFeed),
// so everything here works offline. Each photo widget can be set to one album (hold → Edit Widget).

// MARK: - Album choice

struct AlbumEntity: AppEntity {
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Album"
    static let defaultQuery = AlbumQuery()
    var id: String
    var name: String
    var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(name)") }
    static let showing = AlbumEntity(id: "showing", name: "Now showing")
}

struct AlbumQuery: EntityQuery {
    func all() -> [AlbumEntity] {
        let list = (try? Data(contentsOf: AppGroup.widgetAlbums)).flatMap { try? JSONDecoder().decode([WidgetAlbum].self, from: $0) } ?? []
        return [.showing] + list.map { AlbumEntity(id: $0.id, name: $0.name) }
    }
    func entities(for identifiers: [String]) async throws -> [AlbumEntity] { all().filter { identifiers.contains($0.id) } }
    func suggestedEntities() async throws -> [AlbumEntity] { all() }
    func defaultResult() async -> AlbumEntity? { .showing }
}

struct PhotoConfig: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "Photos"
    static let description = IntentDescription("Choose which album the widget shows.")
    @Parameter(title: "Album") var album: AlbumEntity?
    @Parameter(title: "Show date", default: false) var showDate: Bool
}

// MARK: - Timeline

struct PhotoEntry: TimelineEntry {
    let date: Date
    let files: [String]
    let album: String
    let takenAt: Date?
    var showDate = false
    /// Which layout the Grid widget uses for this entry (it changes shape as it rotates).
    var variant = 0
    var empty: Bool { files.isEmpty }
}

struct PhotoProvider: AppIntentTimelineProvider {
    var perEntry = 1
    /// Clock widgets need an entry every minute (widgets can't tick on their own); photos still change every N minutes.
    var clock = false

    func placeholder(in context: Context) -> PhotoEntry { PhotoEntry(date: .now, files: [], album: "Mantel", takenAt: nil) }

    func snapshot(for config: PhotoConfig, in context: Context) async -> PhotoEntry {
        let items = Self.items(for: config.album)
        return PhotoEntry(date: .now, files: Array(items.prefix(perEntry)).map(\.file), album: items.first?.album ?? "Mantel",
                          takenAt: items.first?.takenAt, showDate: config.showDate)
    }

    func timeline(for config: PhotoConfig, in context: Context) async -> Timeline<PhotoEntry> {
        let feed = WidgetFeed.load()
        let items = Self.items(for: config.album)
        guard !items.isEmpty else {
            return Timeline(entries: [placeholder(in: context)], policy: .after(.now.addingTimeInterval(900)))
        }
        let step = max(feed?.rotateMinutes ?? 5, 1)
        // Start somewhere different each refresh so two widgets don't show the same photo.
        let salt = (config.album?.id ?? "").unicodeScalars.reduce(0) { $0 + Int($1.value) } + perEntry * 7
        let start = (Int(Date().timeIntervalSince1970 / 60) / step + salt) % items.count
        let now = Date()
        let minute = Calendar.current.dateInterval(of: .minute, for: now)?.start ?? now
        // Cover about two hours, at most 120 entries.
        let count = clock ? 120 : min(120, max(12, 120 / step))
        let entries = (0..<count).map { i -> PhotoEntry in
            let slot = clock ? i / step : i
            let first = (start + slot * perEntry) % items.count
            let group = (0..<perEntry).map { items[(first + $0) % items.count] }
            let at = clock ? minute.addingTimeInterval(Double(i * 60)) : now.addingTimeInterval(Double(i * step * 60))
            return PhotoEntry(date: i == 0 ? now : at, files: group.map(\.file), album: group[0].album,
                              takenAt: group[0].takenAt, showDate: config.showDate, variant: start + slot)
        }
        return Timeline(entries: entries, policy: .atEnd)
    }

    static func items(for album: AlbumEntity?) -> [WidgetFeed.Item] {
        let all = WidgetFeed.load()?.items ?? []
        guard let id = album?.id, id != "showing" else {
            let showing = all.filter { $0.showing ?? true }
            return showing.isEmpty ? all : showing
        }
        return all.filter { $0.albumId == id }
    }
}

/// Loads a widget photo at exactly the resolution the box needs (aspect-fill, in pixels), so it's sharp but
/// stays inside the widget's memory budget. `fill` is the on-screen size × display scale.
func widgetImage(_ file: String, fill: CGSize) -> UIImage? {
    let url = AppGroup.widgetImageURL(file)
    guard let src = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
    var need = Swift.max(fill.width, fill.height)
    if let props = CGImageSourceCopyPropertiesAtIndex(src, 0, nil) as? [CFString: Any],
       let w = props[kCGImagePropertyPixelWidth] as? CGFloat, let h = props[kCGImagePropertyPixelHeight] as? CGFloat, w > 0, h > 0 {
        let o = (props[kCGImagePropertyOrientation] as? Int) ?? 1
        let (sw, sh) = o >= 5 ? (h, w) : (w, h)
        let scale = Swift.max(fill.width / sw, fill.height / sh)    // aspect-fill
        need = Swift.max(sw, sh) * scale
    }
    return widgetImage(file, max: Swift.min(Swift.max(need, 200), 1600))
}

func widgetImage(_ file: String, max: CGFloat) -> UIImage? {
    let url = AppGroup.widgetImageURL(file)
    guard let src = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
    let opts: [CFString: Any] = [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceCreateThumbnailWithTransform: true,
                                 kCGImageSourceThumbnailMaxPixelSize: max]
    return CGImageSourceCreateThumbnailAtIndex(src, 0, opts as CFDictionary).map { UIImage(cgImage: $0) }
}


// MARK: - Views

struct PhotoFill: View {
    let file: String?
    let family: WidgetFamily
    var px: CGFloat? = nil          // kept for call sites; the real size comes from the layout
    @Environment(\.displayScale) private var displayScale
    var body: some View {
        GeometryReader { g in
            if let file, let img = widgetImage(file, fill: CGSize(width: g.size.width * displayScale, height: g.size.height * displayScale)) {
                Image(uiImage: img).resizable().interpolation(.high).antialiased(true).widgetAccentedRenderingMode(.fullColor)
                    .scaledToFill().frame(width: g.size.width, height: g.size.height).clipped()
            } else {
                ZStack {
                    LinearGradient(colors: [Color(hex: 0xFFB547), Color(hex: 0xF2622E), Color(hex: 0xC92D5C)], startPoint: .topLeading, endPoint: .bottomTrailing)
                    if family != .systemSmall || px == nil {
                        VStack(spacing: 6) {
                            Image(systemName: "photo.on.rectangle.angled").font(.system(size: 26, weight: .semibold))
                            Text("Open Mantel to add photos").font(.figtree(13, .bold)).multilineTextAlignment(.center)
                        }
                        .foregroundStyle(.white).padding()
                    }
                }
            }
        }
    }
}

struct PhotoWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: PhotoEntry
    var clock = false

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            if clock {
                LinearGradient(colors: [.clear, .black.opacity(0.55)], startPoint: .center, endPoint: .bottom)
                VStack(alignment: .leading, spacing: 0) {
                    Text(entry.date, format: .dateTime.hour(.defaultDigits(amPM: .omitted)).minute())
                        .font(.display(family == .systemSmall ? 34 : 46)).tracking(-1.2)
                        .minimumScaleFactor(0.6).lineLimit(1)
                    Text(entry.date, format: .dateTime.weekday(.wide).day().month())
                        .font(.figtree(family == .systemSmall ? 12 : 14, .bold)).opacity(0.9)
                }
                .foregroundStyle(.white)
                .shadow(color: .black.opacity(0.3), radius: 8)
                .padding(family == .systemSmall ? 14 : 18)
            } else if !entry.empty && (family != .systemSmall || entry.showDate) {
                LinearGradient(colors: [.clear, .black.opacity(0.4)], startPoint: .center, endPoint: .bottom)
                VStack(alignment: .leading, spacing: 1) {
                    if family != .systemSmall { Text(entry.album).font(.figtree(13, .bold)) }
                    if entry.showDate, let d = entry.takenAt {
                        Text(d.formatted(.dateTime.day().month(.abbreviated).year())).font(.figtree(11, .semibold)).opacity(0.85)
                    }
                }
                .foregroundStyle(.white).padding(14).shadow(color: .black.opacity(0.3), radius: 6)
            }
        }
        .containerBackground(for: .widget) { PhotoFill(file: entry.files.first, family: family) }
        .widgetURL(URL(string: "mantel://play"))
    }
}

/// Grid: a mosaic that changes shape every rotation (big + 2, 2×2, three columns, editorial…), like the Grid mode.
struct MosaicView: View {
    @Environment(\.widgetFamily) private var family
    let entry: PhotoEntry

    /// Unit rects drawn for a wide widget (medium); tall widgets swap x/y.
    private static let layouts: [[CGRect]] = [
        [CGRect(x: 0, y: 0, width: 0.5, height: 1), CGRect(x: 0.5, y: 0, width: 0.5, height: 0.5), CGRect(x: 0.5, y: 0.5, width: 0.5, height: 0.5)],
        [CGRect(x: 0, y: 0, width: 0.5, height: 0.5), CGRect(x: 0.5, y: 0, width: 0.5, height: 0.5), CGRect(x: 0, y: 0.5, width: 0.5, height: 0.5), CGRect(x: 0.5, y: 0.5, width: 0.5, height: 0.5)],
        [CGRect(x: 0, y: 0, width: 1 / 3, height: 1), CGRect(x: 1 / 3, y: 0, width: 1 / 3, height: 1), CGRect(x: 2 / 3, y: 0, width: 1 / 3, height: 1)],
        [CGRect(x: 0, y: 0, width: 0.6, height: 1), CGRect(x: 0.6, y: 0, width: 0.4, height: 1 / 3), CGRect(x: 0.6, y: 1 / 3, width: 0.4, height: 1 / 3), CGRect(x: 0.6, y: 2 / 3, width: 0.4, height: 1 / 3)],
        [CGRect(x: 0, y: 0, width: 0.5, height: 1), CGRect(x: 0.5, y: 0, width: 0.5, height: 1)],
    ]

    var body: some View {
        let tall = family == .systemLarge
        let rects = Self.layouts[abs(entry.variant) % Self.layouts.count]
        GeometryReader { g in
            ZStack(alignment: .topLeading) {
                ForEach(0..<rects.count, id: \.self) { i in
                    let r = tall ? CGRect(x: rects[i].minY, y: rects[i].minX, width: rects[i].height, height: rects[i].width) : rects[i]
                    let f = CGRect(x: r.minX * g.size.width, y: r.minY * g.size.height, width: r.width * g.size.width, height: r.height * g.size.height).insetBy(dx: 3, dy: 3)
                    PhotoFill(file: entry.files[safe: i % max(entry.files.count, 1)], family: .systemSmall, px: 420)
                        .frame(width: f.width, height: f.height)
                        // Concentric with the widget's own corners, like Apple's Photos widget.
                        .clipShape(ContainerRelativeShape())
                        .offset(x: f.minX, y: f.minY)
                }
            }
        }
        .padding(3)
        .containerBackground(for: .widget) { Color(hex: 0x111111) }
        .widgetURL(URL(string: "mantel://play"))
    }
}

/// Polaroids taped onto paper, like the Scrapbook mode.
struct ScrapbookWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: PhotoEntry
    var body: some View {
        let n = family == .systemSmall ? 1 : 3
        GeometryReader { g in
            let w = family == .systemSmall ? g.size.width * 0.78 : min(g.size.width * 0.36, g.size.height * 0.7)
            ZStack {
                ForEach(0..<n, id: \.self) { i in
                    let angle: Double = [-7, 5, -2][(i + abs(entry.variant)) % 3]
                    VStack(spacing: 0) {
                        PhotoFill(file: entry.files[safe: i % max(entry.files.count, 1)], family: .systemSmall, px: 380)
                            .frame(width: w - 12, height: w - 12)
                        Text(entry.takenAt.map { $0.formatted(.dateTime.day().month(.abbreviated)) } ?? " ")
                            .font(.figtree(10, .semibold)).foregroundStyle(Color(hex: 0x3a3632)).frame(height: w * 0.2)
                    }
                    .padding(.top, 6).padding(.horizontal, 6)
                    .background(Color(hex: 0xfdfcf8))
                    .shadow(color: .black.opacity(0.25), radius: 5, y: 3)
                    .overlay(alignment: .top) {
                        Rectangle().fill(Color(hex: 0xf3e4b5).opacity(0.8)).frame(width: w * 0.36, height: 12).rotationEffect(.degrees(-angle / 2)).offset(y: -6)
                    }
                    .rotationEffect(.degrees(angle))
                    .offset(x: n == 1 ? 0 : CGFloat(i - 1) * g.size.width * 0.3, y: n == 1 ? 0 : CGFloat(i % 2) * 8)
                }
            }
            .frame(width: g.size.width, height: g.size.height)
        }
        .containerBackground(for: .widget) { Color(hex: 0xe9dfcc) }
        .widgetURL(URL(string: "mantel://play"))
    }
}

/// Staggered masonry columns, like the Pinterest mode.
struct PinterestWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: PhotoEntry
    var body: some View {
        let files = entry.files
        let cols = family == .systemMedium ? 3 : (family == .systemExtraLarge ? 4 : 2)
        GeometryReader { g in
            HStack(alignment: .top, spacing: 6) {
                ForEach(0..<cols, id: \.self) { c in
                    let heights: [CGFloat] = (c % 2 == 0) ? [0.62, 0.38, 0.45] : [0.4, 0.6, 0.45]
                    VStack(spacing: 6) {
                        ForEach(0..<3, id: \.self) { r in
                            PhotoFill(file: files[safe: (c * 3 + r) % max(files.count, 1)], family: .systemSmall, px: 360)
                                .frame(height: g.size.height * heights[r])
                                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }
                    }
                    .offset(y: c % 2 == 0 ? 0 : -g.size.height * 0.12)
                }
            }
            .frame(width: g.size.width, height: g.size.height, alignment: .top)
            // Staggered columns run off the edges, so trim the whole wall to the widget's shape.
            .clipShape(ContainerRelativeShape())
        }
        .padding(6)
        .containerBackground(for: .widget) { Color(hex: 0x111111) }
        .widgetURL(URL(string: "mantel://play"))
    }
}

// MARK: - Scripture

struct VerseEntry: TimelineEntry { let date: Date; let text: String; let reference: String; let author: String? }

struct VerseProvider: TimelineProvider {
    func placeholder(in context: Context) -> VerseEntry {
        VerseEntry(date: .now, text: "The Lord is my shepherd; I shall not want.", reference: "Psalm 23:1", author: nil)
    }
    func getSnapshot(in context: Context, completion: @escaping (VerseEntry) -> Void) { completion(load() ?? placeholder(in: context)) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<VerseEntry>) -> Void) {
        // The app refreshes the verse each day; check again just after midnight.
        let tomorrow = Calendar.current.startOfDay(for: .now.addingTimeInterval(86_400)).addingTimeInterval(120)
        completion(Timeline(entries: [load() ?? placeholder(in: context)], policy: .after(tomorrow)))
    }
    private func load() -> VerseEntry? {
        guard let d = try? Data(contentsOf: AppGroup.widget.appending(path: "verse.json")),
              let o = try? JSONSerialization.jsonObject(with: d) as? [String: String], let t = o["text"], let r = o["reference"] else { return nil }
        return VerseEntry(date: .now, text: t, reference: "\(r) · \(o["translation"] ?? "")", author: o["author"])
    }
}

struct VerseView: View {
    @Environment(\.widgetFamily) private var family
    let entry: VerseEntry
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: "book.closed.fill").font(.system(size: 12, weight: .bold)).opacity(0.8)
            Text(entry.text)
                .font(.system(size: family == .systemSmall ? 14 : 18, weight: .medium, design: .serif))
                .minimumScaleFactor(0.55)
            Spacer(minLength: 0)
            Text(entry.reference).font(.figtree(11, .extrabold)).textCase(.uppercase).tracking(1).opacity(0.85)
        }
        .foregroundStyle(.white)
        .shadow(color: .black.opacity(0.5), radius: 6)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .containerBackground(for: .widget) {
            ZStack {
                Color(hex: 0x1c2a22)
                if FileManager.default.fileExists(atPath: AppGroup.widget.appending(path: "verse.jpg").path) {
                    PhotoFill(file: "verse.jpg", family: family)
                }
                LinearGradient(colors: [.black.opacity(0.25), .black.opacity(0.6)], startPoint: .top, endPoint: .bottom)
            }
        }
        .widgetURL(URL(string: "mantel://play"))
    }
}

extension Array { subscript(safe i: Int) -> Element? { indices.contains(i) ? self[i] : nil } }

// MARK: - Widgets

private let photoFamilies: [WidgetFamily] = [.systemSmall, .systemMedium, .systemLarge, .systemExtraLarge]

struct PhotoWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "MantelPhoto", intent: PhotoConfig.self, provider: PhotoProvider()) { PhotoWidgetView(entry: $0) }
            .configurationDisplayName("Photo")
            .description("A photo from your Mantel, changing every few minutes. Great in StandBy.")
            .supportedFamilies(photoFamilies)
            .containerBackgroundRemovable(false)
            .contentMarginsDisabled()
    }
}

struct ClockWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "MantelClock", intent: PhotoConfig.self, provider: PhotoProvider(clock: true)) { PhotoWidgetView(entry: $0, clock: true) }
            .configurationDisplayName("Photo & Clock")
            .description("Your photo with a big clock — a bedside frame for StandBy.")
            .supportedFamilies(photoFamilies)
            .containerBackgroundRemovable(false)
            .contentMarginsDisabled()
    }
}

struct PinterestWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "MantelPinterest", intent: PhotoConfig.self, provider: PhotoProvider(perEntry: 12)) { PinterestWidgetView(entry: $0) }
            .configurationDisplayName("Pinterest")
            .description("Staggered masonry columns of your photos.")
            .supportedFamilies([.systemMedium, .systemLarge, .systemExtraLarge])
            .containerBackgroundRemovable(false)
            .contentMarginsDisabled()
    }
}

struct MosaicWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "MantelMosaic", intent: PhotoConfig.self, provider: PhotoProvider(perEntry: 4)) { MosaicView(entry: $0) }
            .configurationDisplayName("Grid")
            .description("A mosaic that changes shape every few minutes.")
            .supportedFamilies([.systemMedium, .systemLarge, .systemExtraLarge])
            .containerBackgroundRemovable(false)
            .contentMarginsDisabled()
    }
}

struct ScrapbookWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "MantelScrapbook", intent: PhotoConfig.self, provider: PhotoProvider(perEntry: 3)) { ScrapbookWidgetView(entry: $0) }
            .configurationDisplayName("Scrapbook")
            .description("Polaroids taped onto paper.")
            .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
            .containerBackgroundRemovable(false)
            .contentMarginsDisabled()
    }
}

struct VerseWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MantelVerse", provider: VerseProvider()) { VerseView(entry: $0) }
            .configurationDisplayName("Scripture")
            .description("Verse of the day on a matching landscape.")
            .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
            .containerBackgroundRemovable(false)
    }
}

/// Control Center, Lock Screen and Action button: open the full-screen frame.
struct PlayControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "com.nanaamoako.mantel.play") {
            ControlWidgetButton(action: PlayFrameIntent()) {
                Label("Play Mantel", systemImage: "photo.tv")
            }
        }
        .displayName("Play Mantel")
        .description("Open your photo frame full screen.")
    }
}

@main
struct MantelWidgetBundle: WidgetBundle {
    var body: some Widget {
        PhotoWidget()
        ClockWidget()
        PinterestWidget()
        MosaicWidget()
        ScrapbookWidget()
        VerseWidget()
        PlayControl()
    }
}
