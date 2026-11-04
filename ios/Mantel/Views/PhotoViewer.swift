import SwiftUI
import Photos

/// Saves photos to the iPhone's photo library (asks for add-only access the first time).
enum PhotoSaver {
    @MainActor static func save(_ photos: [PhotoItem]) async {
        let lib = Library.shared
        let status = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
        guard status == .authorized || status == .limited else {
            lib.toast = "Allow Mantel to add photos in Settings → Privacy → Photos"
            return
        }
        lib.toast = photos.count == 1 ? "Saving…" : "Saving \(photos.count) photos…"
        var saved = 0
        for p in photos {
            guard let img = await ImageCache.shared.image(p, .full, network: lib.online), let data = img.jpegData(compressionQuality: 0.95) else { continue }
            do {
                try await PHPhotoLibrary.shared().performChanges {
                    let req = PHAssetCreationRequest.forAsset()
                    req.addResource(with: .photo, data: data, options: nil)
                    if let d = p.takenAt { req.creationDate = d }
                }
                saved += 1
            } catch {}
        }
        UINotificationFeedbackGenerator().notificationOccurred(saved > 0 ? .success : .error)
        lib.toast = saved == photos.count ? (saved == 1 ? "Saved to Photos" : "Saved \(saved) photos to Photos")
                                          : "Saved \(saved) of \(photos.count) — the rest aren't downloaded and you're offline"
    }
}

/// Full-screen photo viewer, like the web gallery: swipe between photos, pinch or double-tap to zoom,
/// filmstrip along the bottom, and save / share / play / hide / delete.
struct PhotoViewer: View {
    let photos: [PhotoItem]
    @State var index: Int
    @Environment(\.dismiss) private var dismiss
    @Environment(Library.self) private var library
    @Environment(Player.self) private var player
    @State private var chrome = true
    @State private var shareImage: UIImage?
    @State private var confirmDelete = false

    private var current: PhotoItem? { photos[safe: index] }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            TabView(selection: $index) {
                ForEach(Array(photos.enumerated()), id: \.element.id) { i, p in
                    ZoomablePhoto(photo: p) { withAnimation(Clean.ease(0.25)) { chrome.toggle() } }
                        .tag(i)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .ignoresSafeArea()

            if chrome {
                VStack(spacing: 0) {
                    top
                    Spacer()
                    filmstrip
                    actions
                }
                .transition(.opacity)
            }
        }
        .statusBarHidden(!chrome)
        .sheet(item: Binding(get: { shareImage.map(ShareItem.init) }, set: { if $0 == nil { shareImage = nil } })) { item in
            ShareSheet(items: [item.image]).presentationDetents([.medium, .large])
        }
        .confirmationDialog("Delete this photo?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button(current?.localFile != nil ? "Delete from this iPhone" : "Delete from Mantel", role: .destructive) {
                guard let p = current else { return }
                Task { await library.delete([p.id]); dismiss() }
            }
        } message: { Text(current?.localFile != nil ? "Removed from this album." : "Removed from your Mantel account on every screen.") }
    }

    private var top: some View {
        HStack {
            GlassCircle(icon: "xmark") { dismiss() }
            Spacer()
            VStack(spacing: 1) {
                Text("\(index + 1) of \(photos.count)").font(.figtree(15, .bold))
                if let d = current?.takenAt { Text(d.formatted(.dateTime.day().month(.wide).year())).font(.figtree(12, .semibold)).opacity(0.7) }
            }
            .foregroundStyle(.white)
            Spacer()
            Color.clear.frame(width: 44, height: 44)
        }
        .padding(.horizontal, 16).padding(.top, 8)
        .background(LinearGradient(colors: [.black.opacity(0.5), .clear], startPoint: .top, endPoint: .bottom).ignoresSafeArea())
    }

    private var filmstrip: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal) {
                LazyHStack(spacing: 3) {
                    ForEach(Array(photos.enumerated()), id: \.element.id) { i, p in
                        PhotoThumb(photo: p)
                            .frame(width: i == index ? 48 : 34, height: 48)
                            .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 6, style: .continuous).strokeBorder(.white, lineWidth: i == index ? 2 : 0))
                            .id(i)
                            .onTapGesture { withAnimation(Clean.ease()) { index = i } }
                    }
                }
                .padding(.horizontal, 16)
                .animation(Clean.ease(0.3), value: index)
            }
            .scrollIndicators(.hidden)
            .frame(height: 56)
            .onAppear { proxy.scrollTo(index, anchor: .center) }
            .onChange(of: index) { _, i in withAnimation(Clean.ease()) { proxy.scrollTo(i, anchor: .center) } }
        }
    }

    private var actions: some View {
        HStack(spacing: 4) {
            if current?.assetId == nil {
                action("square.and.arrow.down", "Save") { if let p = current { Task { await PhotoSaver.save([p]) } } }
            }
            action("square.and.arrow.up", "Share") {
                guard let p = current else { return }
                Task { shareImage = await ImageCache.shared.image(p, .full, network: library.online) }
            }
            action("play.fill", "Play") {
                guard let p = current else { return }
                dismiss()
                Task { try? await Task.sleep(for: .milliseconds(350)); player.play(startingAt: p, in: photos) }
            }
            action("eye.slash", "Hide") { if let p = current { Task { await library.hide([p.id]); dismiss() } } }
            if current?.assetId == nil { action("trash", "Delete") { confirmDelete = true } }
        }
        .padding(.horizontal, 12).padding(.top, 10).padding(.bottom, 6)
        .background(LinearGradient(colors: [.clear, .black.opacity(0.6)], startPoint: .top, endPoint: .bottom).ignoresSafeArea())
    }

    private func action(_ icon: String, _ title: String, _ run: @escaping () -> Void) -> some View {
        Button(action: run) {
            VStack(spacing: 4) {
                Image(systemName: icon).font(.system(size: 19, weight: .semibold)).frame(height: 24)
                Text(title).font(.figtree(11, .bold))
            }
            .foregroundStyle(.white).frame(maxWidth: .infinity, minHeight: 50)
        }
        .buttonStyle(PressScale(scale: 0.9))
    }
}

private struct ShareItem: Identifiable { let image: UIImage; var id: ObjectIdentifier { ObjectIdentifier(image) } }

struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController { UIActivityViewController(activityItems: items, applicationActivities: nil) }
    func updateUIViewController(_ vc: UIActivityViewController, context: Context) {}
}

/// One photo: pinch to zoom, double-tap to zoom in/out, drag to pan when zoomed.
struct ZoomablePhoto: View {
    let photo: PhotoItem
    var onTap: () -> Void
    @State private var image: UIImage?
    @State private var scale: CGFloat = 1
    @State private var lastScale: CGFloat = 1
    @State private var offset: CGSize = .zero
    @State private var lastOffset: CGSize = .zero

    var body: some View {
        GeometryReader { g in
            ZStack {
                if let image {
                    Image(uiImage: image).resizable().scaledToFit()
                        .scaleEffect(scale).offset(offset)
                        .frame(width: g.size.width, height: g.size.height)
                } else {
                    ProgressView().tint(.white)
                }
            }
            .frame(width: g.size.width, height: g.size.height)
            .contentShape(Rectangle())
            .onTapGesture(count: 2) {
                withAnimation(Clean.spring) {
                    if scale > 1 { scale = 1; offset = .zero } else { scale = 2.5 }
                    lastScale = scale; lastOffset = offset
                }
            }
            .onTapGesture(count: 1, perform: onTap)
            .gesture(MagnifyGesture()
                .onChanged { v in scale = max(1, min(lastScale * v.magnification, 6)) }
                .onEnded { _ in
                    lastScale = scale
                    if scale <= 1.01 { withAnimation(Clean.spring) { offset = .zero; lastOffset = .zero } }
                })
            .simultaneousGesture(scale > 1 ? DragGesture()
                .onChanged { v in offset = CGSize(width: lastOffset.width + v.translation.width, height: lastOffset.height + v.translation.height) }
                .onEnded { _ in lastOffset = offset } : nil)
        }
        .task(id: photo.id) {
            if let m = ImageCache.shared.cached(photo, .full) { image = m; return }
            if let t = ImageCache.shared.cached(photo, .thumb) { image = t }
            if let full = await ImageCache.shared.image(photo, .full, network: Library.shared.online) { image = full }
        }
        .onDisappear { scale = 1; lastScale = 1; offset = .zero; lastOffset = .zero }
    }
}
