import AVKit
import AVFoundation
import UIKit
import CoreMedia

/// System Picture in Picture for a photo slideshow. Each slide is pushed into an
/// AVSampleBufferDisplayLayer as a single still frame; iOS floats that layer above
/// every app when you swipe home, and you can drag it to any corner.
@MainActor
final class PiPController: NSObject {
    let hostView = PiPLayerView()
    private var controller: AVPictureInPictureController?
    private var keepAlive: Timer?
    private var lastImage: UIImage?
    var isActive: Bool { controller?.isPictureInPictureActive ?? false }
    var isPossible: Bool { controller?.isPictureInPicturePossible ?? false }

    var onRestore: (() -> Void)?
    var onNext: (() -> Void)?
    var onPrevious: (() -> Void)?
    var onSetPlaying: ((Bool) -> Void)?
    var onActiveChange: ((Bool) -> Void)?
    var isPaused: () -> Bool = { false }

    static var supported: Bool { AVPictureInPictureController.isPictureInPictureSupported() }

    func activate(auto: Bool) {
        guard Self.supported else { return }
        let s = AVAudioSession.sharedInstance()
        try? s.setCategory(.playback, mode: .moviePlayback, options: [.mixWithOthers])
        try? s.setActive(true)
        if controller == nil {
            let layer = hostView.displayLayer
            var tb: CMTimebase?
            CMTimebaseCreateWithSourceClock(allocator: kCFAllocatorDefault, sourceClock: CMClockGetHostTimeClock(), timebaseOut: &tb)
            if let tb { CMTimebaseSetTime(tb, time: .zero); CMTimebaseSetRate(tb, rate: 1); layer.controlTimebase = tb }
            let source = AVPictureInPictureController.ContentSource(sampleBufferDisplayLayer: layer, playbackDelegate: self)
            let c = AVPictureInPictureController(contentSource: source)
            c.delegate = self
            c.requiresLinearPlayback = false
            controller = c
        }
        controller?.canStartPictureInPictureAutomaticallyFromInline = auto
        keepAlive?.invalidate()
        // Re-send the current frame now and then so the PiP window never goes black.
        keepAlive = Timer.scheduledTimer(withTimeInterval: 4, repeats: true) { [weak self] _ in
            Task { @MainActor in if let img = self?.lastImage { self?.enqueue(img) } }
        }
    }

    func setAuto(_ on: Bool) { controller?.canStartPictureInPictureAutomaticallyFromInline = on }

    func deactivate() {
        keepAlive?.invalidate(); keepAlive = nil
        if isActive { controller?.stopPictureInPicture() }
        controller?.canStartPictureInPictureAutomaticallyFromInline = false
        hostView.displayLayer.sampleBufferRenderer.flush(removingDisplayedImage: true, completionHandler: nil)
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    func start() { if controller?.isPictureInPicturePossible == true { controller?.startPictureInPicture() } }
    func stop() { controller?.stopPictureInPicture() }

    func show(_ image: UIImage) {
        lastImage = image
        enqueue(image)
        controller?.invalidatePlaybackState()
    }

    private func enqueue(_ image: UIImage) {
        guard let buf = Self.sampleBuffer(from: image) else { return }
        let r = hostView.displayLayer.sampleBufferRenderer
        if r.status == .failed { r.flush() }
        r.enqueue(buf)
    }

    /// Draws the photo into a BGRA pixel buffer (aspect kept, long side ≤ 1280) wrapped as a display-immediately sample buffer.
    static func sampleBuffer(from image: UIImage) -> CMSampleBuffer? {
        let aspect = min(max(image.size.width / max(image.size.height, 1), 0.6), 1.8)
        let long: CGFloat = 1280
        let w = Int(aspect >= 1 ? long : long * aspect) & ~1, h = Int(aspect >= 1 ? long / aspect : long) & ~1
        var pb: CVPixelBuffer?
        let attrs: [CFString: Any] = [kCVPixelBufferCGImageCompatibilityKey: true, kCVPixelBufferCGBitmapContextCompatibilityKey: true,
                                      kCVPixelBufferIOSurfacePropertiesKey: [:] as CFDictionary]
        guard CVPixelBufferCreate(kCFAllocatorDefault, w, h, kCVPixelFormatType_32BGRA, attrs as CFDictionary, &pb) == kCVReturnSuccess, let pb else { return nil }
        CVPixelBufferLockBaseAddress(pb, [])
        defer { CVPixelBufferUnlockBaseAddress(pb, []) }
        guard let ctx = CGContext(data: CVPixelBufferGetBaseAddress(pb), width: w, height: h, bitsPerComponent: 8,
                                  bytesPerRow: CVPixelBufferGetBytesPerRow(pb), space: CGColorSpaceCreateDeviceRGB(),
                                  bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue),
              let cg = image.cgImage else { return nil }
        ctx.setFillColor(UIColor.black.cgColor); ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
        // aspect-fill
        let s = max(CGFloat(w) / image.size.width, CGFloat(h) / image.size.height)
        let dw = image.size.width * s, dh = image.size.height * s
        ctx.interpolationQuality = .high
        ctx.draw(cg, in: CGRect(x: (CGFloat(w) - dw) / 2, y: (CGFloat(h) - dh) / 2, width: dw, height: dh))

        var fmt: CMVideoFormatDescription?
        CMVideoFormatDescriptionCreateForImageBuffer(allocator: kCFAllocatorDefault, imageBuffer: pb, formatDescriptionOut: &fmt)
        guard let fmt else { return nil }
        var timing = CMSampleTimingInfo(duration: .invalid, presentationTimeStamp: CMClockGetTime(CMClockGetHostTimeClock()), decodeTimeStamp: .invalid)
        var sb: CMSampleBuffer?
        CMSampleBufferCreateReadyWithImageBuffer(allocator: kCFAllocatorDefault, imageBuffer: pb, formatDescription: fmt, sampleTiming: &timing, sampleBufferOut: &sb)
        if let sb, let arr = CMSampleBufferGetSampleAttachmentsArray(sb, createIfNecessary: true), CFArrayGetCount(arr) > 0 {
            let dict = unsafeBitCast(CFArrayGetValueAtIndex(arr, 0), to: CFMutableDictionary.self)
            CFDictionarySetValue(dict, Unmanaged.passUnretained(kCMSampleAttachmentKey_DisplayImmediately).toOpaque(),
                                 Unmanaged.passUnretained(kCFBooleanTrue).toOpaque())
        }
        return sb
    }
}

extension PiPController: AVPictureInPictureSampleBufferPlaybackDelegate {
    nonisolated func pictureInPictureController(_ c: AVPictureInPictureController, setPlaying playing: Bool) {
        Task { @MainActor in self.onSetPlaying?(playing) }
    }
    nonisolated func pictureInPictureControllerTimeRangeForPlayback(_ c: AVPictureInPictureController) -> CMTimeRange {
        CMTimeRange(start: .negativeInfinity, duration: .positiveInfinity)   // live: no scrubber
    }
    nonisolated func pictureInPictureControllerIsPlaybackPaused(_ c: AVPictureInPictureController) -> Bool {
        MainActor.assumeIsolated { isPaused() }
    }
    nonisolated func pictureInPictureController(_ c: AVPictureInPictureController, didTransitionToRenderSize newRenderSize: CMVideoDimensions) {}
    nonisolated func pictureInPictureController(_ c: AVPictureInPictureController, skipByInterval skipInterval: CMTime, completion completionHandler: @escaping () -> Void) {
        let forward = CMTimeGetSeconds(skipInterval) >= 0
        Task { @MainActor in (forward ? self.onNext : self.onPrevious)?(); completionHandler() }
    }
}

extension PiPController: AVPictureInPictureControllerDelegate {
    nonisolated func pictureInPictureControllerDidStartPictureInPicture(_ c: AVPictureInPictureController) {
        Task { @MainActor in self.onActiveChange?(true) }
    }
    nonisolated func pictureInPictureControllerDidStopPictureInPicture(_ c: AVPictureInPictureController) {
        Task { @MainActor in self.onActiveChange?(false) }
    }
    nonisolated func pictureInPictureController(_ c: AVPictureInPictureController, restoreUserInterfaceForPictureInPictureStopWithCompletionHandler completionHandler: @escaping (Bool) -> Void) {
        Task { @MainActor in self.onRestore?(); completionHandler(true) }
    }
}

/// The view whose layer PiP lifts out of the app.
final class PiPLayerView: UIView {
    override class var layerClass: AnyClass { AVSampleBufferDisplayLayer.self }
    var displayLayer: AVSampleBufferDisplayLayer { layer as! AVSampleBufferDisplayLayer }
    override init(frame: CGRect) {
        super.init(frame: frame)
        displayLayer.videoGravity = .resizeAspectFill
        backgroundColor = .black
        isUserInteractionEnabled = false
    }
    required init?(coder: NSCoder) { fatalError() }
}
