import SwiftUI
import Observation
import UIKit

/// One thing on screen: a photo, or two portrait photos side by side (landscape).
struct Slide: Identifiable, Equatable {
    let id: String
    let photos: [PhotoItem]
    let images: [UIImage]
    static func == (a: Slide, b: Slide) -> Bool { a.id == b.id }
}

/// Runs the slideshow for the full-screen frame, the floating mini frame and system Picture in Picture.
@Observable @MainActor
final class Player {
    static let shared = Player()

    enum Presentation { case closed, full, mini }
    var presentation: Presentation = .closed {
        didSet { presentationChanged(from: oldValue) }
    }
    private(set) var slide: Slide?
    private(set) var paused = false
    private(set) var position = 0
    private(set) var count = 0
    private(set) var pipActive = false
    /// Set by the frame view: wide screens can pair portrait photos.
    var landscape = false
    /// Bumps each time a slide starts, so the drift animation restarts.
    private(set) var tick = 0
    var empty: Bool { count == 0 }

    @ObservationIgnored let pip = PiPController()
    @ObservationIgnored private var order: [PhotoItem] = []
    /// The photos in play order, for the grid/Pinterest/scrapbook/cover-flow modes.
    var photos: [PhotoItem] { order }
    @ObservationIgnored private var timer: Task<Void, Never>?
    @ObservationIgnored private var history: [Int] = []

    private init() {
        pip.onNext = { [weak self] in self?.next() }
        pip.onPrevious = { [weak self] in self?.previous() }
        pip.onSetPlaying = { [weak self] playing in self?.setPaused(!playing) }
        pip.onRestore = { [weak self] in self?.presentation = .full }
        pip.onActiveChange = { [weak self] on in self?.pipActive = on }
        pip.isPaused = { [weak self] in self?.paused ?? false }
    }

    // MARK: Controls

    func play(startingAt photo: PhotoItem? = nil, in list: [PhotoItem]? = nil, mode: FrameMode? = nil) {
        let prefs = Prefs.shared
        if let mode { prefs.mode = mode } else if photo != nil || list != nil, !prefs.mode.usesPhotos { prefs.mode = .slideshow }
        var items = list ?? Library.shared.playlist
        if prefs.shuffle && photo == nil { items.shuffle() } else if photo == nil { items.sort { ($0.takenAt ?? .distantPast) > ($1.takenAt ?? .distantPast) } }
        order = items
        count = items.count
        position = 0
        if let photo, let i = items.firstIndex(of: photo) { position = i }
        paused = false
        history = []
        slide = nil
        withAnimation(Clean.ease(0.5)) { presentation = .full }
        Task { await show(position, animated: false) }
    }

    func close() {
        withAnimation(Clean.ease(0.45)) { presentation = .closed }
    }

    func next() {
        guard count > 0 else { return }
        history.append(position)
        let step = slide?.photos.count ?? 1
        Task { await show((position + step) % count, animated: true) }
    }

    func previous() {
        guard count > 0 else { return }
        let target = history.popLast() ?? (position - 1 + count) % count
        Task { await show(target, animated: true) }
    }

    func setPaused(_ p: Bool) {
        paused = p
        if p { timer?.cancel() } else { schedule() }
        pip.show(slide?.images.first ?? UIImage())
    }
    func togglePause() { setPaused(!paused) }

    // MARK: Slides

    private func show(_ index: Int, animated: Bool) async {
        guard count > 0 else { slide = nil; return }
        let online = Library.shared.online
        // Find the next photo we can actually show (offline, skip ones that aren't saved).
        var i = index, tries = 0
        var first: UIImage?
        while tries < min(count, 40) {
            first = await ImageCache.shared.image(order[i], .full, network: online)
            if first != nil { break }
            i = (i + 1) % count; tries += 1
        }
        guard let first else { slide = nil; schedule(); return }
        var photos = [order[i]], images = [first]
        // Landscape + two portrait photos in a row: show them side by side.
        if landscape, Prefs.shared.duo, order[i].isPortrait || first.size.height > first.size.width, count > 2 {
            let j = (i + 1) % count
            if let second = await ImageCache.shared.image(order[j], .full, network: online),
               second.size.height > second.size.width {
                photos.append(order[j]); images.append(second)
            }
        }
        position = i
        let s = Slide(id: photos.map(\.id).joined(separator: "+") + "-\(tick + 1)", photos: photos, images: images)
        if animated { withAnimation(.easeInOut(duration: 1.1)) { slide = s; tick += 1 } } else { slide = s; tick += 1 }
        pip.show(first)
        schedule()
        prefetch(after: (i + photos.count) % count)
    }

    private func prefetch(after i: Int) {
        guard count > 1 else { return }
        let ahead = (0..<3).map { order[(i + $0) % count] }
        let online = Library.shared.online
        Task.detached(priority: .utility) { for p in ahead { _ = await ImageCache.shared.image(p, .full, network: online) } }
    }

    private func schedule() {
        timer?.cancel()
        guard !paused, presentation != .closed else { return }
        let secs = Prefs.shared.interval
        timer = Task { [weak self] in
            try? await Task.sleep(for: .seconds(secs))
            guard !Task.isCancelled else { return }
            self?.next()
        }
    }

    /// Reload with the newest playlist without leaving the frame (e.g. after a sync).
    func refreshIfEmpty() {
        guard presentation != .closed, count == 0 || slide == nil else { return }
        order = Library.shared.playlist.shuffled(); count = order.count; position = 0
        Task { await show(0, animated: true) }
    }

    func relayout(landscape: Bool) {
        guard landscape != self.landscape else { return }
        self.landscape = landscape
        guard presentation != .closed, count > 0 else { return }
        Task { await show(position, animated: false) }
    }

    private func presentationChanged(from old: Presentation) {
        let app = UIApplication.shared
        switch presentation {
        case .closed:
            timer?.cancel()
            pip.deactivate()
            app.isIdleTimerDisabled = false
            slide = nil
        case .full:
            app.isIdleTimerDisabled = true
            pip.activate(auto: Prefs.shared.autoPiP)
            if pipActive { pip.stop() }
            schedule()
        case .mini:
            app.isIdleTimerDisabled = false
            pip.activate(auto: Prefs.shared.autoPiP)
            schedule()
        }
    }
}
