import UIKit

/// Painted sample photos for simulator screenshots (launch with -MantelDemo). Never used on a real install.
@MainActor
enum DemoContent {
    static func install() {
        let lib = Library.shared
        guard !lib.albums.contains(where: { $0.name == "Golden hour" }) else { return }
        lib.onboarded = true
        let sets: [(String, [[UInt32]])] = [
            ("Golden hour", [[0x3B2A6B, 0xE0588A, 0xFFB16B], [0x1b2a4a, 0xc0567a, 0xffc27a], [0x2b1d52, 0xff7a59, 0xffd38a], [0x402060, 0xf06292, 0xffcc80], [0x22305a, 0xd9708a, 0xf9d29d]]),
            ("Coast", [[0x0e3a5c, 0x4fa3c7, 0xe9f1f2], [0x12405e, 0x6cc1d6, 0xfdf3df], [0x0b2f4a, 0x3b8fb5, 0xd7ecf0], [0x1d4d4f, 0x6fb3a0, 0xf2e5c4]]),
            ("Family", [[0x5a2a1a, 0xd9814a, 0xf6d7a7], [0x2f3e2a, 0x88a96b, 0xf1e9c9], [0x4b1d2f, 0xc75b7a, 0xf7d4c2], [0x3a2a1a, 0xb98a4f, 0xf3e1b8], [0x1f2a44, 0x7f8fbf, 0xe8e2f5]]),
        ]
        for (name, palettes) in sets {
            let a = lib.newDeviceAlbum(name)
            let imgs: [(data: Data, date: Date?)] = palettes.enumerated().map { i, p in
                (paint(p, portrait: i % 2 == 0, seed: i).jpegData(compressionQuality: 0.9)!, Date().addingTimeInterval(Double(-i) * 86400))
            }
            Task { await lib.add(imgs, to: a) { _ in } }
        }
        lib.toast = nil
    }

    /// A sunset-over-hills landscape, like the Mantel icon.
    static func paint(_ c: [UInt32], portrait: Bool, seed: Int) -> UIImage {
        let size = portrait ? CGSize(width: 1200, height: 1600) : CGSize(width: 1600, height: 1100)
        let col = { (h: UInt32) in UIColor(red: CGFloat((h >> 16) & 0xff) / 255, green: CGFloat((h >> 8) & 0xff) / 255, blue: CGFloat(h & 0xff) / 255, alpha: 1) }
        return UIGraphicsImageRenderer(size: size).image { ctx in
            let g = ctx.cgContext
            let grad = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: c.map { col($0).cgColor } as CFArray, locations: [0, 0.6, 1])!
            g.drawLinearGradient(grad, start: .zero, end: CGPoint(x: 0, y: size.height), options: [])
            let sunY = size.height * (0.52 + Double(seed % 3) * 0.04)
            let sun = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: [UIColor(white: 1, alpha: 0.95).cgColor, col(0xFFD27A).cgColor, col(0xFFB547).withAlphaComponent(0).cgColor] as CFArray, locations: [0, 0.45, 1])!
            g.drawRadialGradient(sun, startCenter: CGPoint(x: size.width * (0.35 + Double(seed % 4) * 0.1), y: sunY), startRadius: 0,
                                 endCenter: CGPoint(x: size.width * (0.35 + Double(seed % 4) * 0.1), y: sunY), endRadius: size.width * 0.22, options: [])
            for (k, shade) in [(0, 0.55), (1, 0.8)] {
                let p = UIBezierPath()
                let base = size.height * (0.66 + Double(k) * 0.12)
                p.move(to: CGPoint(x: 0, y: base))
                var x: CGFloat = 0
                while x <= size.width {
                    p.addLine(to: CGPoint(x: x, y: base - sin(x / size.width * .pi * (2 + Double(k + seed % 2)) + Double(seed)) * size.height * 0.05))
                    x += 20
                }
                p.addLine(to: CGPoint(x: size.width, y: size.height)); p.addLine(to: CGPoint(x: 0, y: size.height)); p.close()
                UIColor(red: 0.12, green: 0.05, blue: 0.16, alpha: shade).setFill(); p.fill()
            }
        }
    }
}
