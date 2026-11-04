import SwiftUI

/// An image from a URL (Unsplash), kept in the URL cache so it shows offline after the first time.
struct RemoteImage: View {
    let url: URL?
    @State private var image: UIImage?
    private static let memory = NSCache<NSURL, UIImage>()
    /// Unsplash backgrounds and album art. 100 MB on disk at most; counted and cleared in Settings → Storage.
    static let cache = URLCache(memoryCapacity: 10 << 20, diskCapacity: 100 << 20, directory: AppGroup.cache.appending(path: "web"))
    static func clear() { cache.removeAllCachedResponses(); memory.removeAllObjects() }
    private static let session: URLSession = {
        let c = URLSessionConfiguration.default
        c.urlCache = cache
        c.requestCachePolicy = .returnCacheDataElseLoad
        c.timeoutIntervalForRequest = 15
        return URLSession(configuration: c)
    }()
    var body: some View {
        Color.clear
            .overlay { if let image { Image(uiImage: image).resizable().scaledToFill().transition(.opacity) } }
            .clipped()
            .task(id: url) {
                guard let url else { return }
                if let m = Self.memory.object(forKey: url as NSURL) { image = m; return }
                var got = try? await Self.session.data(from: url)
                if got == nil { got = try? await MantelAPI.shared.fetch(URLRequest(url: url)) }   // retry on a fresh connection
                guard let (data, _) = got,
                      let img = ImageCache.downsample(data: data, max: 2048) else { return }
                Self.memory.setObject(img, forKey: url as NSURL)
                withAnimation(.easeInOut(duration: 1)) { image = img }
            }
    }
}

// MARK: - Clock

struct ClockMode: View {
    let landscape: Bool
    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { ctx in
            let h = Calendar.current.component(.hour, from: ctx.date)
            let night = h >= 22 || h < 6
            GeometryReader { g in
                VStack(spacing: 8) {
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text(ctx.date, format: .dateTime.hour(.defaultDigits(amPM: .omitted)).minute())
                            .font(.display(min(g.size.width * (landscape ? 0.26 : 0.3), 300))).tracking(-6).monospacedDigit()
                            .contentTransition(.numericText())
                        Text(ctx.date, format: .dateTime.second(.twoDigits))
                            .font(.figtree(min(g.size.width * 0.06, 54), .bold)).monospacedDigit().opacity(0.45)
                    }
                    .lineLimit(1).minimumScaleFactor(0.5)
                    Text(ctx.date, format: .dateTime.weekday(.wide).day().month(.wide))
                        .font(.figtree(min(g.size.width * 0.05, 30), .bold)).opacity(0.6)
                }
                .foregroundStyle(night ? Color(hex: 0xff453a) : .white)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .animation(.easeInOut, value: ctx.date)
            }
        }
        .background(Color.black)
    }
}

// MARK: - Scripture

struct ScriptureMode: View {
    let landscape: Bool
    @Environment(Prefs.self) private var prefs
    @Environment(ModeContent.self) private var content
    var body: some View {
        ZStack {
            Color(hex: 0x1c2a22)
            RemoteImage(url: content.verseBackground?.url).ignoresSafeArea()
            LinearGradient(colors: [.black.opacity(0.15), .black.opacity(0.55)], startPoint: .top, endPoint: .bottom)
            if let v = content.verse {
                VStack(spacing: 22) {
                    Text("“\(v.text)”")
                        .font(.system(size: landscape ? 34 : 30, weight: .medium, design: .serif))
                        .multilineTextAlignment(.center).lineSpacing(6)
                        .minimumScaleFactor(0.5)
                    Text("\(v.reference) · \(v.translation)").font(.figtree(15, .extrabold)).tracking(2).textCase(.uppercase).opacity(0.85)
                }
                .foregroundStyle(.white)
                .shadow(color: .black.opacity(0.45), radius: 16, y: 4)
                .padding(.horizontal, landscape ? 90 : 32)
                .frame(maxWidth: 900)
                .transition(.opacity)
                .id(v.reference)
            } else {
                ProgressView().tint(.white)
            }
            if let a = content.verseBackground?.author {
                Text("Photo: \(a) / Unsplash").font(.figtree(11, .semibold)).foregroundStyle(.white.opacity(0.6))
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing).padding(18)
            }
        }
        .task(id: prefs.translation) { await content.loadVerse(translation: prefs.translation) }
    }
}

// MARK: - Mood

struct MoodMode: View {
    @Environment(Prefs.self) private var prefs
    @Environment(ModeContent.self) private var content
    @Environment(Player.self) private var player
    @State private var i = 0
    var body: some View {
        ZStack(alignment: .bottomLeading) {
            Color.black
            if !content.mood.isEmpty {
                let p = content.mood[i % content.mood.count]
                RemoteImage(url: p.url).id(p.id).transition(.opacity).ignoresSafeArea()
                VStack(alignment: .leading, spacing: 2) {
                    Text(prefs.moodQuery.capitalized).font(.figtree(22, .extrabold))
                    Text("Photo: \(p.author) / Unsplash").font(.figtree(12, .semibold)).opacity(0.75)
                }
                .foregroundStyle(.white).shadow(color: .black.opacity(0.5), radius: 10)
                .padding(.leading, 26).padding(.bottom, 120)
            } else { ProgressView().tint(.white).frame(maxWidth: .infinity, maxHeight: .infinity) }
        }
        .task(id: prefs.moodQuery) { i = 0; await content.loadMood(prefs.moodQuery) }
        .task(id: player.paused) {
            guard !player.paused else { return }
            while !Task.isCancelled {
                do { try await Task.sleep(for: .seconds(prefs.interval)) } catch { break }
                withAnimation(.easeInOut(duration: 1.4)) { i += 1 }
            }
        }
    }
}

// MARK: - FlipBoard

/// Split-flap board: each cell flips through letters before landing on your message.
struct FlipBoardMode: View {
    let landscape: Bool
    @Environment(ModeContent.self) private var content
    @Environment(Prefs.self) private var prefs
    @Environment(Player.self) private var player
    @State private var index = 0

    private var lines: [String] {
        let msgs = content.messages.map(\.text)
        if !msgs.isEmpty { return msgs }
        let h = Calendar.current.component(.hour, from: .now)
        let greet = h < 5 ? "GOOD NIGHT" : h < 12 ? "GOOD MORNING" : h < 17 ? "GOOD AFTERNOON" : h < 22 ? "GOOD EVENING" : "GOOD NIGHT"
        return ["\(greet)\n\(Date.now.formatted(.dateTime.weekday(.wide).day().month(.wide)).uppercased())",
                "WELCOME HOME", "ADD MESSAGES ON THE WEB TO SEE THEM HERE"]
    }

    var body: some View {
        GeometryReader { g in
            let cols = landscape ? 20 : 12
            let rows = landscape ? 5 : 8
            let gap: CGFloat = 4
            let cw = min((g.size.width - 40 - gap * CGFloat(cols - 1)) / CGFloat(cols), 60)
            let ch = cw * 1.4
            let text = lines[index % lines.count]
            let grid = layout(text, cols: cols, rows: rows)
            VStack(spacing: gap) {
                ForEach(0..<rows, id: \.self) { r in
                    HStack(spacing: gap) {
                        ForEach(0..<cols, id: \.self) { c in
                            FlapCell(char: grid[r][c], delay: Double(r * cols + c) * 0.012, size: CGSize(width: cw, height: ch))
                        }
                    }
                }
                if let a = content.messages[safe: index % max(content.messages.count, 1)]?.author, !content.messages.isEmpty {
                    Text("— \(a)").font(.figtree(15, .bold)).foregroundStyle(.white.opacity(0.6)).padding(.top, 14)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(Color(hex: 0x0d0d0f))
        .task { await content.loadBoards() }
        .task(id: player.paused) {
            guard !player.paused else { return }
            while !Task.isCancelled {
                do { try await Task.sleep(for: .seconds(max(10, prefs.interval))) } catch { break }
                index += 1
            }
        }
    }

    /// Word-wraps the message into the board, centred.
    private func layout(_ text: String, cols: Int, rows: Int) -> [[Character]] {
        var lines: [String] = []
        for para in text.uppercased().split(separator: "\n") {
            var line = ""
            for word in para.split(separator: " ") {
                let w = String(word.prefix(cols))
                if line.isEmpty { line = w } else if line.count + 1 + w.count <= cols { line += " " + w } else { lines.append(line); line = w }
            }
            if !line.isEmpty { lines.append(line) }
        }
        lines = Array(lines.prefix(rows))
        let top = (rows - lines.count) / 2
        var grid = Array(repeating: Array(repeating: Character(" "), count: cols), count: rows)
        for (i, l) in lines.enumerated() {
            let start = (cols - l.count) / 2
            for (j, ch) in l.enumerated() { grid[top + i][start + j] = ch }
        }
        return grid
    }
}

struct FlapCell: View {
    let char: Character
    let delay: Double
    let size: CGSize
    @State private var shown: Character = " "
    private static let glyphs = Array("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 4, style: .continuous).fill(Color(hex: 0x1d1d21))
            Text(String(shown)).font(.custom("Figtree-ExtraBold", size: size.height * 0.62)).foregroundStyle(Color(hex: 0xf2efe9))
            Rectangle().fill(.black.opacity(0.55)).frame(height: 1)
        }
        .frame(width: size.width, height: size.height)
        .rotation3DEffect(.degrees(shown == char ? 0 : 8), axis: (1, 0, 0))
        .task(id: char) {
            guard shown != char else { return }
            // A cancelled flip must stop here, or it would finish with the old letter.
            do { try await Task.sleep(for: .seconds(delay)) } catch { return }
            if char != " " || shown != " " {
                for _ in 0..<Int.random(in: 3...7) {
                    withAnimation(.easeOut(duration: 0.06)) { shown = Self.glyphs.randomElement()! }
                    do { try await Task.sleep(for: .milliseconds(60)) } catch { return }
                }
            }
            withAnimation(.easeOut(duration: 0.08)) { shown = char }
        }
    }
}

// MARK: - Easel

/// Big words on paper, rotating through your Easel texts.
struct EaselMode: View {
    let landscape: Bool
    @Environment(ModeContent.self) private var content
    @Environment(Prefs.self) private var prefs
    @Environment(Player.self) private var player
    @State private var i = 0
    var body: some View {
        let texts = content.easelTexts
        ZStack {
            Color(hex: 0xf4efe6)
            Text(texts[i % max(texts.count, 1)])
                .font(.display(landscape ? 64 : 52)).tracking(-2)
                .foregroundStyle(Color(hex: 0x1c1a19))
                .multilineTextAlignment(.center).minimumScaleFactor(0.4)
                .padding(.horizontal, landscape ? 80 : 30)
                .id(i)
                .transition(.asymmetric(insertion: .move(edge: .bottom).combined(with: .opacity), removal: .opacity))
            Rectangle().fill(Clean.cherry).frame(width: 60, height: 6)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom).padding(.bottom, 130)
        }
        .task { await content.loadBoards() }
        .task(id: player.paused) {
            guard !player.paused else { return }
            while !Task.isCancelled {
                do { try await Task.sleep(for: .seconds(max(15, prefs.interval * 2))) } catch { break }
                withAnimation(Clean.ease(0.8)) { i += 1 }
            }
        }
    }
}

// MARK: - Eisenhower

struct TasksMode: View {
    let landscape: Bool
    @Environment(ModeContent.self) private var content
    @Environment(Library.self) private var library

    private let quadrants: [(id: String, title: String, sub: String, color: UInt32)] = [
        ("urgent_important", "Do first", "Urgent · Important", 0xef5b5f),
        ("not_urgent_important", "Schedule", "Important", 0x5b8def),
        ("urgent_not_important", "Delegate", "Urgent", 0xf0a541),
        ("not_urgent_not_important", "Later", "Neither", 0x9a958d),
    ]

    var body: some View {
        let layout = landscape ? AnyLayout(HStackLayout(spacing: 12)) : AnyLayout(VStackLayout(spacing: 12))
        ZStack {
            Color(hex: 0x111111)
            if !library.signedIn {
                Text("Sign in to see your tasks").font(.figtree(20, .bold)).foregroundStyle(.white)
            } else {
                VStack(spacing: 12) {
                    layout {
                        quadrant(quadrants[0]); quadrant(quadrants[1])
                    }
                    layout {
                        quadrant(quadrants[2]); quadrant(quadrants[3])
                    }
                }
                .padding(.horizontal, 16).padding(.top, landscape ? 16 : 100).padding(.bottom, landscape ? 90 : 120)
            }
        }
        .task { await content.loadBoards() }
    }

    private func quadrant(_ q: (id: String, title: String, sub: String, color: UInt32)) -> some View {
        let items = content.tasks.filter { $0.priority == q.id }
        return VStack(alignment: .leading, spacing: 8) {
            HStack {
                Circle().fill(Color(hex: q.color)).frame(width: 10, height: 10)
                Text(q.title).font(.figtree(17, .extrabold))
                Spacer()
                Text(q.sub).font(.figtree(11, .bold)).textCase(.uppercase).tracking(1).opacity(0.5)
            }
            ScrollView {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(items) { t in
                        Button { Task { await content.toggleTask(t) } } label: {
                            HStack(alignment: .top, spacing: 8) {
                                Image(systemName: t.done ? "checkmark.circle.fill" : "circle").foregroundStyle(Color(hex: q.color))
                                Text(t.text).font(.figtree(15, .semibold)).strikethrough(t.done).opacity(t.done ? 0.45 : 1)
                                    .multilineTextAlignment(.leading)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                    if items.isEmpty { Text("Nothing here").font(.figtree(14, .medium)).opacity(0.4) }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .scrollIndicators(.hidden)
        }
        .foregroundStyle(.white)
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Color(hex: q.color).opacity(0.14)))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Color(hex: q.color).opacity(0.35), lineWidth: 1))
    }
}

extension Array { subscript(safe i: Int) -> Element? { indices.contains(i) ? self[i] : nil } }
