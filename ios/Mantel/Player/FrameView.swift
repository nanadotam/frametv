import SwiftUI

/// Draws one slide: the photo (or a side-by-side pair) with the chosen fit and a slow drift.
struct SlideCanvas: View {
    let slide: Slide
    var fit: Prefs.Fit
    var drift: Bool
    var interval: Double
    var corner: CGFloat = 0
    @State private var zoomed = false

    var body: some View {
        GeometryReader { geo in
            HStack(spacing: slide.images.count > 1 ? 6 : 0) {
                ForEach(Array(slide.images.enumerated()), id: \.offset) { _, img in
                    photo(img, size: CGSize(width: (geo.size.width - (slide.images.count > 1 ? 6 : 0)) / CGFloat(slide.images.count),
                                            height: geo.size.height))
                }
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: corner, style: .continuous))
        .onAppear {
            zoomed = false
            guard drift else { return }
            withAnimation(.linear(duration: interval + 2)) { zoomed = true }
        }
    }

    @ViewBuilder private func photo(_ img: UIImage, size: CGSize) -> some View {
        ZStack {
            if fit == .fit {
                // Whole photo, with a soft blurred copy filling the bars.
                Image(uiImage: img).resizable().scaledToFill().frame(width: size.width, height: size.height)
                    .blur(radius: 40).opacity(0.55).clipped()
                Image(uiImage: img).resizable().scaledToFit().frame(width: size.width, height: size.height)
                    .scaleEffect(zoomed ? 1.03 : 1)
            } else {
                Image(uiImage: img).resizable().scaledToFill().frame(width: size.width, height: size.height)
                    .scaleEffect(zoomed ? 1.08 : 1, anchor: .center)
                    .clipped()
            }
        }
        .frame(width: size.width, height: size.height).clipped()
    }
}

/// The full-screen frame. Tap for controls, swipe sideways to change photo, swipe down to shrink it into a corner.
struct FrameView: View {
    @Environment(Player.self) private var player
    @Environment(Prefs.self) private var prefs
    @Environment(Library.self) private var library
    @State private var controls = true
    @State private var hideTask: Task<Void, Never>?
    @State private var drag: CGSize = .zero
    @State private var lookSheet = false
    @State private var modeStrip = false
    @State private var modeToast: String?

    var body: some View {
        GeometryReader { geo in
            let landscape = geo.size.width > geo.size.height
            ZStack {
                Color.black.ignoresSafeArea()
                PiPHost().ignoresSafeArea()   // the layer PiP lifts out (sits under the photo, showing the same frame)
                content(landscape: landscape, size: geo.size)
                    .ignoresSafeArea()
                    // Taps on the picture toggle the controls. This sits on the content only, so it never
                    // competes with the close / minimise buttons drawn above it.
                    .contentShape(Rectangle())
                    .onTapGesture { toggleControls() }
                if prefs.nightDim && ![.nightstand, .clock].contains(prefs.mode) { NightDim() }
                if let t = modeToast {
                    Text(t).font(.figtree(17, .bold)).foregroundStyle(.white)
                        .padding(.horizontal, 18).padding(.vertical, 10).glassPill()
                        .transition(.scale(scale: 0.9).combined(with: .opacity))
                        .allowsHitTesting(false)
                }
                if controls { overlay(landscape: landscape).transition(.opacity) }
            }
            .scaleEffect(1 - min(max(drag.height, 0) / 1600, 0.18))
            .offset(y: max(drag.height, 0) * 0.6)
            .clipShape(RoundedRectangle(cornerRadius: drag.height > 4 ? 32 : 0, style: .continuous))
            .ignoresSafeArea()
            .onAppear { player.relayout(landscape: landscape); bump() }
            .onChange(of: landscape) { _, l in player.relayout(landscape: l) }
        }
        .simultaneousGesture(
            DragGesture(minimumDistance: 18)
                .onChanged { v in
                    if abs(v.translation.height) > abs(v.translation.width) { drag = CGSize(width: 0, height: v.translation.height) }
                }
                .onEnded { v in
                    let dx = v.translation.width, dy = v.translation.height
                    if dy > 140 || v.predictedEndTranslation.height > 420 {
                        withAnimation(Clean.ease(0.5)) { player.presentation = .mini; drag = .zero }
                    } else if abs(dx) > abs(dy), abs(dx) > 60 {
                        if prefs.mode == .slideshow || prefs.mode == .nightstand { dx < 0 ? player.next() : player.previous() }
                        else if prefs.mode != .coverflow { stepMode(dx < 0 ? 1 : -1) }
                        withAnimation(Clean.spring) { drag = .zero }
                    } else {
                        withAnimation(Clean.spring) { drag = .zero }
                    }
                }
        )
        .statusBarHidden(true)
        .persistentSystemOverlays(.hidden)
        .sheet(isPresented: $lookSheet) { LookSheet().presentationDetents([.medium, .large]) }
    }

    @ViewBuilder private func content(landscape: Bool, size: CGSize) -> some View {
        switch prefs.mode {
        case .nightstand: NightstandView(slide: player.slide, landscape: landscape)
        case .grid: GridMode(landscape: landscape)
        case .pinterest: PinterestMode(landscape: landscape)
        case .scrapbook: ScrapbookMode()
        case .coverflow: CoverFlowMode(landscape: landscape)
        case .video: VideoMode(landscape: landscape)
        case .clock: ClockMode(landscape: landscape)
        case .scripture: ScriptureMode(landscape: landscape)
        case .mood: MoodMode()
        case .flipboard: FlipBoardMode(landscape: landscape)
        case .easel: EaselMode(landscape: landscape)
        case .tasks: TasksMode(landscape: landscape)
        case .slideshow:
            ZStack(alignment: .bottomLeading) {
                if let s = player.slide {
                    SlideCanvas(slide: s, fit: prefs.fit, drift: prefs.transition == .drift, interval: prefs.interval)
                        .id(s.id)
                        .transition(transition)
                } else {
                    EmptyFrame()
                }
                if prefs.clockOverlay {
                    ClockOverlay(big: landscape ? 92 : 76)
                        .padding(.leading, landscape ? 48 : 28).padding(.bottom, landscape ? 104 : 140)
                        .allowsHitTesting(false)
                }
            }
        }
    }

    private func stepMode(_ d: Int) {
        let all = FrameMode.allCases.filter { !$0.needsAccount || library.signedIn }
        let i = all.firstIndex(of: prefs.mode) ?? 0
        setMode(all[(i + d + all.count) % all.count])
    }

    private func setMode(_ m: FrameMode) {
        withAnimation(Clean.ease(0.5)) { prefs.mode = m; modeToast = m.title }
        UISelectionFeedbackGenerator().selectionChanged()
        bump()
        Task {
            try? await Task.sleep(for: .seconds(1.2))
            withAnimation(Clean.ease()) { if modeToast == m.title { modeToast = nil } }
        }
    }

    private var transition: AnyTransition {
        switch prefs.transition {
        case .slide: .asymmetric(insertion: .move(edge: .trailing), removal: .move(edge: .leading))
        default: .opacity
        }
    }

    @ViewBuilder private func overlay(landscape: Bool) -> some View {
        VStack {
            HStack(spacing: 12) {
                GlassCircle(icon: "chevron.down") { hideTask?.cancel(); withAnimation(Clean.ease(0.5)) { player.presentation = .mini } }
                if !prefs.mode.usesPhotos {
                    Text(prefs.mode.title).font(.figtree(15, .bold)).foregroundStyle(.white).shadow(color: .black.opacity(0.4), radius: 6)
                } else if let p = player.slide?.photos.first, let a = library.album(p.albumId) {
                    VStack(alignment: .leading, spacing: 1) {
                        Text(a.name).font(.figtree(15, .bold))
                        Text("\(player.position + 1) of \(player.count)\(library.online ? "" : " · offline")")
                            .font(.figtree(12, .semibold)).opacity(0.75)
                    }
                    .foregroundStyle(.white).shadow(color: .black.opacity(0.4), radius: 6)
                }
                Spacer()
                if PiPController.supported {
                    GlassCircle(icon: "pip.enter") { player.pip.start() }
                }
                GlassCircle(icon: "xmark") { hideTask?.cancel(); player.close() }
            }
            .padding(.horizontal, 18).padding(.top, landscape ? 18 : 58)
            Spacer()
            if modeStrip { ModeStrip(current: prefs.mode) { setMode($0) }.transition(.move(edge: .bottom).combined(with: .opacity)) }
            HStack(spacing: 6) {
                if prefs.mode == .slideshow || prefs.mode == .nightstand {
                    GlassCircle(icon: "backward.fill", plain: true) { player.previous(); bump() }
                }
                GlassCircle(icon: player.paused ? "play.fill" : "pause.fill", plain: true, big: true) { player.togglePause(); bump() }
                if prefs.mode == .slideshow || prefs.mode == .nightstand {
                    GlassCircle(icon: "forward.fill", plain: true) { player.next(); bump() }
                }
                Divider().frame(height: 26).overlay(.white.opacity(0.3)).padding(.horizontal, 4)
                GlassCircle(icon: modeStrip ? "xmark" : "square.grid.2x2", plain: true) {
                    withAnimation(Clean.ease()) { modeStrip.toggle() }; bump()
                }
                if prefs.mode == .slideshow {
                    GlassCircle(icon: prefs.clockOverlay ? "clock.fill" : "clock", plain: true) {
                        withAnimation(Clean.ease()) { prefs.clockOverlay.toggle() }; bump()
                    }
                    GlassCircle(icon: prefs.fit == .fill ? "arrow.down.right.and.arrow.up.left" : "arrow.up.left.and.arrow.down.right", plain: true) {
                        withAnimation(Clean.ease()) { prefs.fit = prefs.fit == .fill ? .fit : .fill }; bump()
                    }
                }
                GlassCircle(icon: "slider.horizontal.3", plain: true) { lookSheet = true }
            }
            .padding(6)
            .glassPill()
            .padding(.bottom, landscape ? 18 : 40)
        }
        .ignoresSafeArea()
    }

    private func toggleControls() {
        withAnimation(Clean.ease(0.3)) { controls.toggle() }
        if controls { bump() }
    }

    private func bump() {
        hideTask?.cancel()
        hideTask = Task {
            try? await Task.sleep(for: .seconds(4))
            guard !Task.isCancelled else { return }
            withAnimation(Clean.ease(0.6)) { controls = false }
        }
    }
}

/// Places the shared PiP layer view in the hierarchy.
struct PiPHost: UIViewRepresentable {
    func makeUIView(context: Context) -> UIView {
        let v = UIView(); v.isUserInteractionEnabled = false
        attach(to: v); return v
    }
    func updateUIView(_ v: UIView, context: Context) { attach(to: v) }
    private func attach(to v: UIView) {
        let host = Player.shared.pip.hostView
        if host.superview !== v {
            host.removeFromSuperview()
            host.frame = v.bounds
            host.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            v.addSubview(host)
        }
    }
}

struct GlassCircle: View {
    let icon: String
    var plain = false
    var big = false
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: big ? 22 : 16, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: big ? 56 : 44, height: big ? 56 : 44)
                .modifier(GlassCircleBG(plain: plain))
                .contentShape(Circle())
        }
        .buttonStyle(PressScale(scale: 0.9))
    }
}

private struct GlassCircleBG: ViewModifier {
    let plain: Bool
    func body(content: Content) -> some View {
        if plain { content }
        // Not .interactive(): the interactive glass can take the touch before the Button sees it.
        else if #available(iOS 26.0, *) { content.glassEffect(.regular, in: Circle()) }
        else { content.background(.ultraThinMaterial, in: Circle()).environment(\.colorScheme, .dark) }
    }
}

extension View {
    @ViewBuilder func glassPill() -> some View {
        if #available(iOS 26.0, *) { self.glassEffect(.regular, in: Capsule()) }
        else { self.background(.ultraThinMaterial, in: Capsule()).environment(\.colorScheme, .dark) }
    }
}

/// Big Figtree clock, StandBy style.
struct ClockOverlay: View {
    var big: CGFloat = 76
    var color: Color = .white
    var body: some View {
        TimelineView(.everyMinute) { ctx in
            VStack(alignment: .leading, spacing: 0) {
                Text(ctx.date, format: .dateTime.hour(.defaultDigits(amPM: .omitted)).minute())
                    .font(.display(big)).tracking(-big * 0.04).monospacedDigit()
                Text(ctx.date, format: .dateTime.weekday(.wide).day().month(.wide))
                    .font(.figtree(big * 0.22, .bold)).opacity(0.85)
            }
            .foregroundStyle(color)
            .shadow(color: .black.opacity(0.35), radius: 20, y: 8)
        }
    }
}

/// Like iPhone StandBy: a big clock beside your photo. Red and dim late at night.
struct NightstandView: View {
    let slide: Slide?
    let landscape: Bool
    var body: some View {
        TimelineView(.everyMinute) { ctx in
            let hour = Calendar.current.component(.hour, from: ctx.date)
            let night = hour >= 22 || hour < 6
            let ink: Color = night ? Color(hex: 0xff453a) : .white
            let layout = landscape ? AnyLayout(HStackLayout(spacing: 28)) : AnyLayout(VStackLayout(spacing: 28))
            ZStack {
                Color.black
                layout {
                    VStack(alignment: landscape ? .leading : .center, spacing: 4) {
                        Text(ctx.date, format: .dateTime.hour(.defaultDigits(amPM: .omitted)).minute())
                            .font(.display(landscape ? 120 : 96)).tracking(-4).monospacedDigit()
                            .minimumScaleFactor(0.5).lineLimit(1)
                        Text(ctx.date, format: .dateTime.weekday(.wide).day().month(.wide))
                            .font(.figtree(20, .bold)).opacity(0.7)
                    }
                    .foregroundStyle(ink)
                    .frame(maxWidth: .infinity, alignment: landscape ? .leading : .center)
                    Group {
                        if let s = slide {
                            SlideCanvas(slide: s, fit: .fill, drift: false, interval: 10, corner: 28).id(s.id).transition(.opacity)
                        } else { RoundedRectangle(cornerRadius: 28).fill(Color.white.opacity(0.06)) }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .opacity(night ? 0.55 : 1)
                    .saturation(night ? 0.2 : 1)
                }
                .padding(landscape ? 40 : 28)
                .padding(.top, landscape ? 0 : 90)
                .padding(.bottom, landscape ? 0 : 70)
            }
        }
    }
}

/// Late at night the frame dims itself so it doesn't light up the room.
struct NightDim: View {
    var body: some View {
        TimelineView(.everyMinute) { ctx in
            let h = Calendar.current.component(.hour, from: ctx.date)
            Color.black.opacity(h >= 23 || h < 6 ? 0.45 : 0).ignoresSafeArea().allowsHitTesting(false)
                .animation(.easeInOut(duration: 2), value: h)
        }
    }
}

struct EmptyFrame: View {
    @Environment(Library.self) private var library
    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: library.online ? "photo.on.rectangle.angled" : "wifi.slash").font(.system(size: 40, weight: .semibold))
            Text(library.online ? "Nothing to show yet" : "No saved photos").font(.figtree(22, .extrabold))
            Text(library.online ? "Pick albums to show, or add photos from your library." : "Photos you've viewed before are kept for offline. Connect once to save more.")
                .font(.figtree(15, .medium)).multilineTextAlignment(.center).opacity(0.7).frame(maxWidth: 300)
        }
        .foregroundStyle(.white)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// The floating frame you get by swiping the full frame down. Drag it to any corner; tap to go full screen.
struct MiniFrame: View {
    @Environment(Player.self) private var player
    @Environment(Prefs.self) private var prefs
    @State private var corner: Alignment = .bottomTrailing
    @State private var drag: CGSize = .zero

    var body: some View {
        GeometryReader { geo in
            let pad = UIDevice.current.userInterfaceIdiom == .pad
            let landscape = geo.size.width > geo.size.height
            let w: CGFloat = pad ? 300 : (landscape ? 220 : 168)
            let h: CGFloat = w * (landscape || pad ? 0.68 : 1.28)
            ZStack {
                Color.black
                PiPHost()
                if let s = player.slide {
                    SlideCanvas(slide: s, fit: .fill, drift: false, interval: prefs.interval).id(s.id).transition(.opacity)
                }
                VStack {
                    HStack {
                        Spacer()
                        Button { player.close() } label: {
                            Image(systemName: "xmark").font(.system(size: 11, weight: .heavy)).foregroundStyle(.white)
                                .frame(width: 26, height: 26).background(.black.opacity(0.45), in: Circle())
                        }
                    }
                    Spacer()
                    HStack {
                        Button { player.togglePause() } label: {
                            Image(systemName: player.paused ? "play.fill" : "pause.fill").font(.system(size: 12, weight: .bold))
                                .foregroundStyle(.white).frame(width: 28, height: 28).background(.black.opacity(0.45), in: Circle())
                        }
                        Spacer()
                    }
                }
                .padding(8)
            }
            .frame(width: w, height: h)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(.white.opacity(0.18), lineWidth: 1))
            .shadow(color: .black.opacity(0.3), radius: 24, y: 12)
            .padding(.horizontal, 14)
            .padding(.top, 8)
            .padding(.bottom, 96)      // clear of the floating tab bar
            .offset(drag)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: corner)
            .onTapGesture { withAnimation(Clean.ease(0.5)) { player.presentation = .full } }
            .gesture(
                DragGesture()
                    .onChanged { drag = $0.translation }
                    .onEnded { v in
                        // Snap to the corner nearest where the flick would land.
                        let start = origin(corner, in: geo.size, w: w, h: h)
                        let end = CGPoint(x: start.x + v.predictedEndTranslation.width, y: start.y + v.predictedEndTranslation.height)
                        let right = end.x > geo.size.width / 2, bottom = end.y > geo.size.height / 2
                        withAnimation(.spring(response: 0.45, dampingFraction: 0.8)) {
                            corner = bottom ? (right ? .bottomTrailing : .bottomLeading) : (right ? .topTrailing : .topLeading)
                            drag = .zero
                        }
                    }
            )
        }
        .transition(.scale(scale: 0.4, anchor: .bottomTrailing).combined(with: .opacity))
    }

    private func origin(_ a: Alignment, in s: CGSize, w: CGFloat, h: CGFloat) -> CGPoint {
        CGPoint(x: (a == .bottomTrailing || a == .topTrailing) ? s.width - w / 2 : w / 2,
                y: (a == .bottomTrailing || a == .bottomLeading) ? s.height - h / 2 : h / 2)
    }
}

/// Quick look settings from inside the frame.
struct LookSheet: View {
    @Environment(Prefs.self) private var prefs
    var body: some View {
        @Bindable var prefs = prefs
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                Display("Frame *look*", size: 28).padding(.top, 8)
                FrameOptions()
            }
            .padding(22)
        }
        .background(Clean.appBg)
    }
}

/// Shared between the in-frame sheet and Settings.
struct FrameOptions: View {
    @Environment(Prefs.self) private var prefs
    var body: some View {
        @Bindable var prefs = prefs
        VStack(alignment: .leading, spacing: 22) {
            group("Mode") {
                ForEach(FrameMode.allCases.filter { !$0.needsAccount || Library.shared.signedIn }) { m in Chip(title: m.title, icon: m.icon, on: prefs.mode == m) { prefs.mode = m } }
            }
            if prefs.mode == .scripture {
                group("Bible translation") {
                    ForEach(["KJV", "NKJV", "ESV", "NIV", "NLT", "AMP", "NET"], id: \.self) { t in Chip(title: t, on: prefs.translation == t) { prefs.translation = t } }
                }
            }
            if prefs.mode == .video {
                group("Video look") {
                    ForEach(VideoMode.Look.allCases) { l in Chip(title: l.title, on: prefs.videoLook == l.rawValue) { prefs.videoLook = l.rawValue } }
                }
            }
            if prefs.mode == .mood {
                group("Mood") {
                    ForEach(ModeContent.moods, id: \.self) { m in Chip(title: m.capitalized, on: prefs.moodQuery == m) { prefs.moodQuery = m } }
                }
            }
            group("Change photo every") {
                ForEach([6.0, 12, 30, 60, 300], id: \.self) { s in
                    Chip(title: s < 60 ? "\(Int(s)) sec" : "\(Int(s / 60)) min", on: prefs.interval == s) { prefs.interval = s }
                }
            }
            group("Transition") {
                ForEach(Prefs.Transition.allCases) { t in Chip(title: t.title, on: prefs.transition == t) { prefs.transition = t } }
            }
            group("Photo") {
                ForEach(Prefs.Fit.allCases) { f in Chip(title: f.title, on: prefs.fit == f) { prefs.fit = f } }
            }
            VStack(spacing: 14) {
                Toggle(isOn: $prefs.clockOverlay) { label("Clock on photos", "A big clock in the corner of the slideshow") }
                Divider().overlay(Clean.line)
                Toggle(isOn: $prefs.shuffle) { label("Shuffle", "Mix photos from every album") }
                Divider().overlay(Clean.line)
                Toggle(isOn: $prefs.duo) { label("Side by side in landscape", "Two portrait photos at once, iPad style") }
                Divider().overlay(Clean.line)
                Toggle(isOn: $prefs.nightDim) { label("Dim late at night", "Softer from 11 pm to 6 am") }
                Divider().overlay(Clean.line)
                Toggle(isOn: $prefs.autoPiP) { label("Keep playing when you leave", "Picture in Picture you can drag to any corner") }
                    .onChange(of: prefs.autoPiP) { _, on in Player.shared.pip.setAuto(on) }
            }
            .toggleStyle(CleanToggleStyle())
            .card(padding: 16)
        }
    }
    private func group<C: View>(_ title: String, @ViewBuilder _ c: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Kicker(title)
            FlowLayout(spacing: 8) { c() }
        }
    }
    private func label(_ t: String, _ s: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(t).font(.figtree(16, .semibold)).foregroundStyle(Clean.ink)
            Text(s).font(.figtree(13, .medium)).foregroundStyle(Clean.label)
        }
    }
}

/// Wrapping row of chips.
struct FlowLayout: Layout {
    var spacing: CGFloat = 8
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = arrange(proposal.width ?? .infinity, subviews)
        return CGSize(width: proposal.width ?? rows.map(\.w).max() ?? 0, height: rows.reduce(0) { $0 + $1.h } + spacing * CGFloat(max(rows.count - 1, 0)))
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for row in arrange(bounds.width, subviews) {
            var x = bounds.minX
            for i in row.items {
                let s = subviews[i].sizeThatFits(.unspecified)
                subviews[i].place(at: CGPoint(x: x, y: y), proposal: .init(s))
                x += s.width + spacing
            }
            y += row.h + spacing
        }
    }
    private func arrange(_ width: CGFloat, _ subviews: Subviews) -> [(items: [Int], w: CGFloat, h: CGFloat)] {
        var rows: [(items: [Int], w: CGFloat, h: CGFloat)] = [([], 0, 0)]
        for i in subviews.indices {
            let s = subviews[i].sizeThatFits(.unspecified)
            if rows[rows.count - 1].w + s.width > width, !rows[rows.count - 1].items.isEmpty { rows.append(([], 0, 0)) }
            rows[rows.count - 1].items.append(i)
            rows[rows.count - 1].w += s.width + spacing
            rows[rows.count - 1].h = max(rows[rows.count - 1].h, s.height)
        }
        return rows
    }
}


/// Quick mode picker that slides up above the frame controls.
struct ModeStrip: View {
    let current: FrameMode
    let pick: (FrameMode) -> Void
    @Environment(Library.self) private var library
    var body: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal) {
                HStack(spacing: 8) {
                    ForEach(FrameMode.allCases.filter { !$0.needsAccount || library.signedIn }) { m in
                        Button { pick(m) } label: {
                            VStack(spacing: 6) {
                                Image(systemName: m.icon).font(.system(size: 18, weight: .semibold))
                                    .frame(width: 48, height: 48)
                                    .background(Circle().fill(m == current ? Clean.cherry : .white.opacity(0.14)))
                                Text(m.title).font(.figtree(11, .bold)).lineLimit(1)
                            }
                            .foregroundStyle(.white).frame(width: 70)
                        }
                        .buttonStyle(PressScale(scale: 0.92))
                        .id(m)
                    }
                }
                .padding(.horizontal, 14).padding(.vertical, 10)
            }
            .scrollIndicators(.hidden)
            .onAppear { proxy.scrollTo(current, anchor: .center) }
        }
        .glassPill()
        .padding(.horizontal, 12).padding(.bottom, 8)
    }
}
