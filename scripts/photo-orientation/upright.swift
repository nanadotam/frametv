import Foundation
import Vision
import ImageIO
// usage: upright <img>... → one JSON line per image with each face's roll
// (degrees, in-plane rotation of the face as seen in the image) and confidence.
for path in CommandLine.arguments.dropFirst() {
  guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil),
        let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else { print("{\"file\":\"\(path)\",\"error\":true}"); continue }
  let req = VNDetectFaceRectanglesRequest()
  req.revision = VNDetectFaceRectanglesRequestRevision3
  try? VNImageRequestHandler(cgImage: img, orientation: .up).perform([req])
  let faces: [[String: Double]] = (req.results ?? []).compactMap { f in
    guard f.confidence > 0.5, f.boundingBox.width > 0.04, let roll = f.roll?.doubleValue else { return nil }
    return ["roll": roll * 180 / .pi, "conf": Double(f.confidence), "size": Double(f.boundingBox.width)]
  }
  let data = try! JSONSerialization.data(withJSONObject: ["file": path, "faces": faces])
  print(String(data: data, encoding: .utf8)!)
}
