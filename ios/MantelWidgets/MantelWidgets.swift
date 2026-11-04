import WidgetKit
import SwiftUI
import AppIntents
import ImageIO

// Mantel's widgets: Home Screen, Lock-free StandBy (iPhone on its side, charging) and iPad.
// The app writes small copies of saved photos to the shared app group (see Library.writeWidgetFeed),
// so everything here works offline.

struct PhotoEntry: TimelineEntry {
    let date: Date
    let files: [String]
    let album: String
    let takenAt: Date?
    var empty: Bool { files.isEmpty }
}

struct PhotoProvider: TimelineProvider {
    var perEntry = 1
    /// Clock widgets need an entry every minute (widgets can't tick on their own); the photo still changes every N minutes.
    var clock = false

    func placeholder(in context: Context) -> PhotoEntry { PhotoEntry(date: .now, files: [], album: "Mantel", takenAt: nil) }

    func getSnapshot(in context: Context, completion: @escaping (PhotoEntry) -> Void) {
        let feed = WidgetFeed.load()
        let items = feed?.items ?? []
        completion(PhotoEntry(date: .now, files: Array(items.prefix(perEntry)).map(\.file), album: items.first?.album ?? "Mantel", takenAt: items.first?.takenAt))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PhotoEntry>) -> Void) {
        guard let feed = WidgetFeed.load(), !feed.items.isEmpty else {
            completion(Timeline(entries: [placeholder(in: context)], policy: .after(.now.addingTimeInterval(1800))))
            return
        }
        // Start somewhere different each refresh so every widget doesn't show the same photo.
        let items = feed.items
        let step = max(feed.rotateMinutes, 5)
        let start = Int(Date().timeIntervalSince1970 / 60) / step % items.count
        let now = Date()
        let minute = Calendar.current.dateInterval(of: .minute, for: now)?.start ?? now
        let count = clock ? 120 : 12
        let entries = (0..<count).map { i -> PhotoEntry in
            let slot = clock ? i / step : i
            let first = (start + slot * perEntry) % items.count
            let group = (0..<perEntry).map { items[(first + $0) % items.count] }
            let at = clock ? minute.addingTimeInterval(Double(i * 60)) : now.addingTimeInterval(Double(i * step * 60))
            return PhotoEntry(date: i == 0 ? now : at, files: group.map(\.file), album: group[0].album, takenAt: group[0].takenAt)
        }
        completion(Timeline(entries: entries, policy: .atEnd))
    }
}

/// Loads a widget photo small enough for the widget's memory budget.
func widgetImage(_ file: String, max: CGFloat) -> UIImage? {
    let url = AppGroup.widget.appending(path: file)
    guard let src = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
    let opts: [CFString: Any] = [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceCreateThumbnailWithTransform: true,
                                 kCGImageSourceThumbnailMaxPixelSize: max]
    return CGImageSourceCreateThumbnailAtIndex(src, 0, opts as CFDictionary).map { UIImage(cgImage: $0) }
}

private func maxPixels(_ family: WidgetFamily) -> CGFloat {
    switch family { case .systemSmall: 500; case .systemMedium: 760; default: 900 }
}

// MARK: - Views

struct PhotoFill: View {
    let file: String?
    let family: WidgetFamily
    var body: some View {
        GeometryReader { g in
            if let file, let img = widgetImage(file, max: maxPixels(family)) {
                Image(uiImage: img).resizable().widgetAccentedRenderingMode(.fullColor)
                    .scaledToFill().frame(width: g.size.width, height: g.size.height).clipped()
            } else {
                ZStack {
                    LinearGradient(colors: [Color(hex: 0xFFB547), Color(hex: 0xF2622E), Color(hex: 0xC92D5C)], startPoint: .topLeading, endPoint: .bottomTrailing)
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

struct PhotoWidgetView: View {
    @Environment(\.widgetFamily) private var family
    @Environment(\.showsWidgetContainerBackground) private var hasBackground
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
            } else if family != .systemSmall, !entry.empty {
                LinearGradient(colors: [.clear, .black.opacity(0.35)], startPoint: .center, endPoint: .bottom)
                Text(entry.album).font(.figtree(13, .bold)).foregroundStyle(.white).padding(14)
                    .shadow(color: .black.opacity(0.3), radius: 6)
            }
        }
        .containerBackground(for: .widget) { PhotoFill(file: entry.files.first, family: family) }
        .widgetURL(URL(string: "mantel://play"))
    }
}

struct MosaicView: View {
    @Environment(\.widgetFamily) private var family
    let entry: PhotoEntry
    var body: some View {
        let files = entry.files
        GeometryReader { g in
            let gap: CGFloat = 4
            if family == .systemMedium {
                HStack(spacing: gap) {
                    tile(files[safe: 0]).frame(width: g.size.width * 0.5)
                    VStack(spacing: gap) { tile(files[safe: 1]); tile(files[safe: 2]) }
                }
            } else {
                VStack(spacing: gap) {
                    tile(files[safe: 0]).frame(height: g.size.height * 0.58)
                    HStack(spacing: gap) { tile(files[safe: 1]); tile(files[safe: 2]); tile(files[safe: 3]) }
                }
            }
        }
        .padding(4)
        .containerBackground(for: .widget) { Color.black }
        .widgetURL(URL(string: "mantel://play"))
    }
    private func tile(_ f: String?) -> some View {
        PhotoFill(file: f, family: .systemSmall).clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

extension Array { subscript(safe i: Int) -> Element? { indices.contains(i) ? self[i] : nil } }

// MARK: - Widgets

struct PhotoWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MantelPhoto", provider: PhotoProvider()) { PhotoWidgetView(entry: $0) }
            .configurationDisplayName("Photo")
            .description("A photo from your Mantel, changing through the day. Great in StandBy.")
            .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .systemExtraLarge])
            .containerBackgroundRemovable(false)
            .contentMarginsDisabled()
    }
}

struct ClockWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MantelClock", provider: PhotoProvider(clock: true)) { PhotoWidgetView(entry: $0, clock: true) }
            .configurationDisplayName("Photo & Clock")
            .description("Your photo with a big clock — a bedside frame for StandBy.")
            .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .systemExtraLarge])
            .containerBackgroundRemovable(false)
            .contentMarginsDisabled()
    }
}

struct MosaicWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MantelMosaic", provider: PhotoProvider(perEntry: 4)) { MosaicView(entry: $0) }
            .configurationDisplayName("Mosaic")
            .description("A few photos at once.")
            .supportedFamilies([.systemMedium, .systemLarge, .systemExtraLarge])
            .containerBackgroundRemovable(false)
            .contentMarginsDisabled()
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
        MosaicWidget()
        PlayControl()
    }
}
