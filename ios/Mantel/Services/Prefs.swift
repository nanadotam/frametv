import Foundation
import SwiftUI
import Observation

/// Everything you can change in Settings. Saved on the device.
@Observable @MainActor
final class Prefs {
    static let shared = Prefs()
    private let d = UserDefaults.standard

    enum Appearance: String, CaseIterable, Identifiable { case auto, light, dark
        var id: String { rawValue }
        var title: String { switch self { case .auto: "Automatic"; case .light: "Light"; case .dark: "Dark" } }
        var scheme: ColorScheme? { switch self { case .auto: nil; case .light: .light; case .dark: .dark } }
    }
    enum Transition: String, CaseIterable, Identifiable { case drift, fade, slide
        var id: String { rawValue }
        var title: String { switch self { case .drift: "Slow drift"; case .fade: "Fade"; case .slide: "Slide" } }
    }
    enum Fit: String, CaseIterable, Identifiable { case fill, fit
        var id: String { rawValue }
        var title: String { switch self { case .fill: "Fill the screen"; case .fit: "Whole photo" } }
    }

    var appearance: Appearance { didSet { d.set(appearance.rawValue, forKey: "appearance") } }
    var interval: Double { didSet { d.set(interval, forKey: "interval") } }
    var transition: Transition { didSet { d.set(transition.rawValue, forKey: "transition") } }
    var fit: Fit { didSet { d.set(fit.rawValue, forKey: "fit") } }
    var mode: FrameMode { didSet { d.set(mode.rawValue, forKey: "mode") } }
    var clockOverlay: Bool { didSet { d.set(clockOverlay, forKey: "clockOverlay") } }   // small clock on photo modes
    var translation: String { didSet { d.set(translation, forKey: "translation") } }      // Scripture
    var moodQuery: String { didSet { d.set(moodQuery, forKey: "moodQuery") } }            // Mood
    var shuffle: Bool { didSet { d.set(shuffle, forKey: "shuffle") } }
    var duo: Bool { didSet { d.set(duo, forKey: "duo") } }                   // landscape: two portrait photos side by side
    var nightDim: Bool { didSet { d.set(nightDim, forKey: "nightDim") } }    // dim the frame late at night
    var autoPiP: Bool { didSet { d.set(autoPiP, forKey: "autoPiP") } }       // keep playing in Picture in Picture when you leave
    var cacheLimitMB: Int { didSet { d.set(cacheLimitMB, forKey: "cacheLimitMB") } }
    var wifiOnly: Bool { didSet { d.set(wifiOnly, forKey: "wifiOnly") } }
    var widgetMinutes: Int { didSet { d.set(widgetMinutes, forKey: "widgetMinutes") } }

    private init() {
        d.register(defaults: ["interval": 12.0, "shuffle": true, "duo": true, "nightDim": true, "autoPiP": true,
                              "cacheLimitMB": 2048, "wifiOnly": false, "widgetMinutes": 5,
                              "translation": "NIV", "moodQuery": "calm", "clockOverlay": false])
        appearance = Appearance(rawValue: d.string(forKey: "appearance") ?? "") ?? .auto
        interval = d.double(forKey: "interval")
        transition = Transition(rawValue: d.string(forKey: "transition") ?? "") ?? .drift
        fit = Fit(rawValue: d.string(forKey: "fit") ?? "") ?? .fill
        mode = FrameMode(rawValue: d.string(forKey: "mode") ?? "") ?? .slideshow
        clockOverlay = d.bool(forKey: "clockOverlay")
        translation = d.string(forKey: "translation") ?? "NIV"
        moodQuery = d.string(forKey: "moodQuery") ?? "calm"
        shuffle = d.bool(forKey: "shuffle")
        duo = d.bool(forKey: "duo")
        nightDim = d.bool(forKey: "nightDim")
        autoPiP = d.bool(forKey: "autoPiP")
        cacheLimitMB = d.integer(forKey: "cacheLimitMB")
        wifiOnly = d.bool(forKey: "wifiOnly")
        widgetMinutes = d.integer(forKey: "widgetMinutes")
    }
}
