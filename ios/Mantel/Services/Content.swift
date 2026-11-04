import Foundation
import SwiftUI
import Observation
import WidgetKit

// Data for the ambient and board modes, from the same endpoints the web display uses.
// Everything is kept on the device, so the modes still work offline with the last thing they saw.

struct Verse: Codable, Equatable { var text: String; var reference: String; var translation: String; var day: String? }
struct MoodPhoto: Codable, Identifiable, Hashable { var id: String; var url: URL; var author: String; var color: String? }
struct BoardMessage: Codable, Identifiable, Hashable { var id: String; var text: String; var author: String? }
struct TaskItem: Codable, Identifiable, Hashable { var id: String; var text: String; var priority: String; var done: Bool }

/// The TV/display state (display_state row).
struct DisplayState: Codable, Equatable {
    var active_mode_id: String?
    var active_album_ids: [String]?
    var is_paused: Bool?
    var brightness: Double?
}
struct RemoteMode: Codable, Identifiable, Hashable { var id: String; var name: String; var is_enabled: Bool? }

@Observable @MainActor
final class ModeContent {
    static let shared = ModeContent()

    var verse: Verse?
    var verseBackground: MoodPhoto?
    var mood: [MoodPhoto] = []
    var messages: [BoardMessage] = []
    var tasks: [TaskItem] = []
    var easelTexts: [String] = ["Make something beautiful today.", "Slow down. Look around.", "This is your space."]

    // Remote (the TV)
    var display: DisplayState?
    var remoteModes: [RemoteMode] = []
    var remoteError: String?

    private var file: URL { AppGroup.support.appending(path: "content.json") }
    private struct Snap: Codable { var verse: Verse?; var verseBackground: MoodPhoto?; var mood: [MoodPhoto]; var messages: [BoardMessage]; var tasks: [TaskItem]; var easel: [String] }

    private init() {
        if let d = try? Data(contentsOf: file), let s = try? JSONDecoder().decode(Snap.self, from: d) {
            verse = s.verse; verseBackground = s.verseBackground; mood = s.mood; messages = s.messages; tasks = s.tasks
            if !s.easel.isEmpty { easelTexts = s.easel }
        }
    }
    private func save() {
        let s = Snap(verse: verse, verseBackground: verseBackground, mood: mood, messages: messages, tasks: tasks, easel: easelTexts)
        if let d = try? JSONEncoder().encode(s) { try? d.write(to: file, options: .atomic) }
    }

    private var api: MantelAPI { .shared }

    // MARK: Scripture — verse of the day + a matching landscape

    static let moodCategories: [(id: String, keywords: [String], query: String)] = [
        ("love", ["love", "beloved", "heart", "compassion", "mercy", "grace", "kindness", "charity", "tender", "affection"], "wildflower meadow golden grass valley pastoral"),
        ("strength", ["strength", "mighty", "power", "rock", "fortress", "shield", "armor", "strong", "courage", "bold", "conquer", "victory"], "mountain peak valley rocky landscape nature"),
        ("peace", ["peace", "rest", "still", "quiet", "calm", "tranquil", "comfort", "gentle", "stillness", "solace", "ease"], "green valley lake reflection serene nature"),
        ("light", ["light", "shine", "glory", "radiant", "bright", "lamp", "beacon", "gleam", "luminous", "glow", "illuminate"], "sunlight through trees forest green nature"),
        ("water", ["water", "river", "sea", "ocean", "waves", "spring", "rain", "flood", "well", "stream", "brook", "fountain"], "mountain river stream valley green nature"),
        ("pastoral", ["shepherd", "sheep", "pasture", "flock", "lamb", "valley", "green", "fold", "meadow"], "rolling green hills pastoral countryside sheep meadow"),
        ("spirit", ["fire", "spirit", "wind", "breath", "flames", "zeal", "anointing", "burning", "holy"], "mountain valley mist dramatic nature landscape"),
        ("joy", ["joy", "praise", "worship", "rejoice", "sing", "thanksgiving", "celebrate", "glad", "delight", "jubilee"], "flower field wildflowers valley sunlight nature"),
        ("wisdom", ["wisdom", "knowledge", "understanding", "counsel", "truth", "discern", "teach", "righteous", "instruction"], "ancient forest tall trees green peaceful nature"),
        ("heaven", ["heaven", "eternal", "kingdom", "throne", "angel", "paradise", "glory", "exalt", "celestial", "everlasting", "above"], "mountain top clouds above valley landscape nature"),
        ("growth", ["tree", "fruit", "vine", "branch", "harvest", "garden", "seed", "plant", "bloom", "grow", "field", "sow"], "lush green forest trees nature lily valley"),
        ("dawn", ["morning", "dawn", "new", "rise", "awaken", "renewal", "restore", "refresh", "born", "beginning", "fresh"], "morning mist green valley sunrise meadow nature"),
        ("journey", ["desert", "wilderness", "journey", "path", "way", "road", "walk", "guide", "lead", "follow", "seek", "wander"], "trail path through valley mountains nature landscape"),
        ("default", [], "green valley mountains nature peaceful grass landscape"),
    ]

    static func moodQuery(for text: String) -> String {
        let words = Set(text.lowercased().components(separatedBy: CharacterSet.letters.inverted))
        var best = moodCategories.last!, score = 0
        for c in moodCategories {
            let s = c.keywords.filter(words.contains).count
            if s > score { best = c; score = s }
        }
        return best.query
    }

    func loadVerse(translation: String) async {
        let today = Date().formatted(.iso8601.year().month().day())
        if verse?.day == today, verse?.translation == translation || translation == "NET", verseBackground != nil { return }
        var v: Verse
        do { v = try await api.getPublic("api/scripture", query: ["translation": translation]) }
        catch { NSLog("[Mantel] verse failed: %@", String(describing: error)); return }
        NSLog("[Mantel] verse ok: %@", v.reference)
        v.day = today
        verse = v
        if let photos = try? await unsplash(Self.moodQuery(for: v.text)), let p = photos.randomElement() { verseBackground = p }
        save()
        writeVerseForWidget()
    }

    /// The Scripture widget reads this.
    func writeVerseForWidget() {
        guard let v = verse else { return }
        var out: [String: String] = ["text": v.text, "reference": v.reference, "translation": v.translation]
        if let bg = verseBackground {
            Task.detached {
                if let (data, _) = try? await MantelAPI.shared.fetch(URLRequest(url: bg.url)),
                   let img = ImageCache.downsample(data: data, max: 900), let jpg = img.jpegData(compressionQuality: 0.8) {
                    try? jpg.write(to: AppGroup.widget.appending(path: "verse.jpg"), options: .atomic)
                }
                WidgetCenter.shared.reloadTimelines(ofKind: "MantelVerse")
            }
            out["author"] = bg.author
        }
        if let d = try? JSONSerialization.data(withJSONObject: out) { try? d.write(to: AppGroup.widget.appending(path: "verse.json"), options: .atomic) }
        WidgetCenter.shared.reloadTimelines(ofKind: "MantelVerse")
    }

    // MARK: Mood — Unsplash by mood

    static let moods = ["calm", "ocean", "forest", "golden hour", "mountains", "city lights", "flowers", "rain", "desert", "snow"]

    func loadMood(_ mood: String) async {
        do { let p = try await unsplash(mood); if !p.isEmpty { self.mood = p.shuffled(); save() } }
        catch { NSLog("[Mantel] mood failed: %@", String(describing: error)) }
    }

    private func unsplash(_ q: String) async throws -> [MoodPhoto] {
        struct R: Decodable { struct P: Decodable { let id: String; let color: String?; let urls: [String: String]; let user: U }; struct U: Decodable { let name: String }; let photos: [P] }
        let r: R = try await api.getPublic("api/unsplash", query: ["mood": q])
        return r.photos.compactMap { p in
            guard let s = p.urls["regular"], let u = URL(string: s) else { return nil }
            return MoodPhoto(id: p.id, url: u, author: p.user.name, color: p.color)
        }
    }

    // MARK: Boards — FlipBoard messages, Easel texts, Eisenhower tasks (your account)

    func loadBoards() async {
        guard Library.shared.signedIn else { return }
        struct M: Decodable { struct X: Decodable { let id: String; let text: String; let author: String? }; let messages: [X] }
        struct T: Decodable { struct X: Decodable { let id: String; let text: String; let priority: String?; let is_done: Bool? ; let show_on_board: Bool? }; let reminders: [X] }
        struct Modes: Decodable { struct X: Decodable { let id: String; let name: String?; let is_enabled: Bool?; let config: [String: AnyJSON]? }; let modes: [X] }
        if let m: M = try? await api.get("api/flipboard/messages") { messages = m.messages.map { BoardMessage(id: $0.id, text: $0.text, author: $0.author) } }
        if let t: T = try? await api.get("api/reminders") {
            tasks = t.reminders.filter { $0.show_on_board ?? true }.map { TaskItem(id: $0.id, text: $0.text, priority: $0.priority ?? "not_urgent_not_important", done: $0.is_done ?? false) }
        }
        if let m: Modes = try? await api.get("api/modes") {
            remoteModes = m.modes.map { RemoteMode(id: $0.id, name: $0.name ?? $0.id, is_enabled: $0.is_enabled) }
            if case .array(let a)? = m.modes.first(where: { $0.id == "easel" })?.config?["texts"] {
                let texts = a.compactMap { if case .string(let s) = $0 { return s } else { return nil } }.filter { !$0.isEmpty }
                if !texts.isEmpty { easelTexts = texts }
            }
        }
        save()
    }

    func toggleTask(_ t: TaskItem) async {
        guard let i = tasks.firstIndex(of: t) else { return }
        tasks[i].done.toggle()
        _ = try? await api.send("api/reminders/\(t.id)", method: "PATCH", json: ["is_done": tasks[i].done])
        save()
    }

    // MARK: Remote — drive the TV / web display

    func loadRemote() async {
        struct S: Decodable { let state: DisplayState? }
        do {
            let s: S = try await api.get("api/display-state")
            display = s.state; remoteError = nil
            if remoteModes.isEmpty { await loadBoards() }
        } catch { remoteError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription }
    }

    func setRemote(_ fields: [String: Any]) async {
        struct S: Decodable { let state: DisplayState? }
        do {
            let data = try await api.send("api/display-state", method: "PATCH", json: fields)
            if let s = try? JSONDecoder().decode(S.self, from: data), let st = s.state { display = st }
            remoteError = nil
        } catch { remoteError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription }
    }

    func remoteAction(_ action: String) async {   // next | prev | reshuffle
        _ = try? await api.send("api/display-state/\(action)", method: "POST", json: [:])
    }
}

/// Minimal JSON value for mode configs.
enum AnyJSON: Decodable {
    case string(String), number(Double), bool(Bool), array([AnyJSON]), object([String: AnyJSON]), null
    init(from d: Decoder) throws {
        let c = try d.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let v = try? c.decode(Bool.self) { self = .bool(v) }
        else if let v = try? c.decode(Double.self) { self = .number(v) }
        else if let v = try? c.decode(String.self) { self = .string(v) }
        else if let v = try? c.decode([AnyJSON].self) { self = .array(v) }
        else { self = .object((try? c.decode([String: AnyJSON].self)) ?? [:]) }
    }
}
