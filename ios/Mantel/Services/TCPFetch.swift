import Foundation
import Network

/// Last-resort HTTP/1.1 over a plain TCP + TLS connection (Network.framework).
///
/// URLSession picks HTTP/3 (QUIC, over UDP) for hosts that advertise it, and on networks that silently drop
/// UDP it can hang until it times out instead of falling back. This path can't use QUIC, so it always gets through
/// where a browser would. Cookies go through HTTPCookieStorage, same as URLSession; follows up to 4 redirects.
enum TCPFetch {
    static func data(for request: URLRequest, redirects: Int = 4) async throws -> (Data, URLResponse) {
        guard let url = request.url, let host = url.host(), url.scheme == "https" else { throw URLError(.badURL) }
        let port = NWEndpoint.Port(integerLiteral: UInt16(url.port ?? 443))
        var path = url.path(percentEncoded: true)
        if path.isEmpty { path = "/" }
        if let q = url.query(percentEncoded: true) { path += "?" + q }

        var head = "\(request.httpMethod ?? "GET") \(path) HTTP/1.1\r\nHost: \(host)\r\nConnection: close\r\nAccept-Encoding: identity\r\n"
        for (k, v) in request.allHTTPHeaderFields ?? [:] where !["host", "connection", "accept-encoding", "content-length"].contains(k.lowercased()) {
            head += "\(k): \(v)\r\n"
        }
        if let cookies = HTTPCookieStorage.shared.cookies(for: url), !cookies.isEmpty {
            head += "Cookie: " + cookies.map { "\($0.name)=\($0.value)" }.joined(separator: "; ") + "\r\n"
        }
        let body = request.httpBody ?? Data()
        if !body.isEmpty || ["POST", "PUT", "PATCH", "DELETE"].contains(request.httpMethod ?? "") { head += "Content-Length: \(body.count)\r\n" }
        head += "\r\n"
        var out = Data(head.utf8); out.append(body)

        let raw = try await exchange(host: host, port: port, send: out, timeout: request.timeoutInterval > 0 ? min(request.timeoutInterval, 30) : 30)
        let (status, headers, payload) = try parse(raw)

        // Cookies (e.g. the session cookie from /api/auth/login).
        let setCookies = headers.filter { $0.0 == "set-cookie" }.map(\.1)
        if !setCookies.isEmpty {
            for c in HTTPCookie.cookies(withResponseHeaderFields: ["Set-Cookie": setCookies.joined(separator: ", ")], for: url) {
                HTTPCookieStorage.shared.setCookie(c)
            }
        }
        // Redirects (Drive thumbnails go to googleusercontent.com).
        if [301, 302, 303, 307, 308].contains(status), redirects > 0,
           let loc = headers.first(where: { $0.0 == "location" })?.1, let next = URL(string: loc, relativeTo: url)?.absoluteURL {
            var r = URLRequest(url: next, timeoutInterval: request.timeoutInterval)
            if status == 307 || status == 308 { r.httpMethod = request.httpMethod; r.httpBody = request.httpBody }
            r.allHTTPHeaderFields = request.allHTTPHeaderFields
            return try await data(for: r, redirects: redirects - 1)
        }
        var fields: [String: String] = [:]
        for (k, v) in headers { fields[k] = fields[k].map { $0 + ", " + v } ?? v }
        let resp = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: fields)!
        return (payload, resp)
    }

    private static func exchange(host: String, port: NWEndpoint.Port, send: Data, timeout: TimeInterval) async throws -> Data {
        let tls = NWProtocolTLS.Options()
        sec_protocol_options_add_tls_application_protocol(tls.securityProtocolOptions, "http/1.1")
        sec_protocol_options_set_tls_server_name(tls.securityProtocolOptions, host)
        let conn = NWConnection(host: NWEndpoint.Host(host), port: port, using: NWParameters(tls: tls, tcp: .init()))
        let queue = DispatchQueue(label: "mantel.tcpfetch")

        return try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Data, Error>) in
            var buffer = Data()
            var finished = false
            func finish(_ r: Result<Data, Error>) {
                guard !finished else { return }
                finished = true
                conn.cancel()
                cont.resume(with: r)
            }
            func receive() {
                conn.receive(minimumIncompleteLength: 1, maximumLength: 1 << 16) { data, _, done, error in
                    if let data { buffer.append(data) }
                    if let error, buffer.isEmpty { finish(.failure(error)); return }
                    if done || error != nil || complete(buffer) { finish(.success(buffer)) } else { receive() }
                }
            }
            conn.stateUpdateHandler = { state in
                switch state {
                case .ready:
                    conn.send(content: send, completion: .contentProcessed { e in
                        if let e { finish(.failure(e)) } else { receive() }
                    })
                case .failed(let e): finish(.failure(e))
                case .waiting(let e): finish(.failure(e))
                default: break
                }
            }
            queue.asyncAfter(deadline: .now() + timeout) { finish(.failure(URLError(.timedOut))) }
            conn.start(queue: queue)
        }
    }

    /// True once a whole response is in: Content-Length reached, or the last chunk of a chunked body seen.
    /// (Don't wait for the server to close — some keep the socket open despite "Connection: close".)
    private static func complete(_ raw: Data) -> Bool {
        guard let split = raw.range(of: Data("\r\n\r\n".utf8)) else { return false }
        let head = String(decoding: raw[raw.startIndex..<split.lowerBound], as: UTF8.self).lowercased()
        let bodyCount = raw.distance(from: split.upperBound, to: raw.endIndex)
        if let line = head.components(separatedBy: "\r\n").first(where: { $0.hasPrefix("content-length:") }),
           let n = Int(line.dropFirst("content-length:".count).trimmingCharacters(in: .whitespaces)) {
            return bodyCount >= n
        }
        if head.contains("transfer-encoding: chunked") {
            return raw.suffix(5) == Data("0\r\n\r\n".utf8)
        }
        // 204/304 have no body.
        return head.hasPrefix("http/1.1 204") || head.hasPrefix("http/1.1 304")
    }

    /// Splits status line, headers and body; undoes chunked transfer encoding.
    private static func parse(_ raw: Data) throws -> (Int, [(String, String)], Data) {
        guard let split = raw.range(of: Data("\r\n\r\n".utf8)) else { throw URLError(.cannotParseResponse) }
        let headText = String(decoding: raw[raw.startIndex..<split.lowerBound], as: UTF8.self)
        var body = Data(raw[split.upperBound...])
        var lines = headText.components(separatedBy: "\r\n")
        let statusLine = lines.removeFirst().split(separator: " ")
        guard statusLine.count >= 2, let status = Int(statusLine[1]) else { throw URLError(.cannotParseResponse) }
        let headers: [(String, String)] = lines.compactMap { l in
            guard let i = l.firstIndex(of: ":") else { return nil }
            return (l[..<i].lowercased(), l[l.index(after: i)...].trimmingCharacters(in: .whitespaces))
        }
        if headers.contains(where: { $0.0 == "transfer-encoding" && $0.1.lowercased().contains("chunked") }) {
            var out = Data(), rest = body[...]
            while let nl = rest.range(of: Data("\r\n".utf8)) {
                let sizeText = String(decoding: rest[rest.startIndex..<nl.lowerBound], as: UTF8.self).split(separator: ";").first ?? ""
                guard let size = Int(sizeText.trimmingCharacters(in: .whitespaces), radix: 16), size > 0 else { break }
                let start = nl.upperBound
                guard rest.distance(from: start, to: rest.endIndex) >= size else { break }
                let end = rest.index(start, offsetBy: size)
                out.append(rest[start..<end])
                rest = rest[min(rest.index(end, offsetBy: 2, limitedBy: rest.endIndex) ?? rest.endIndex, rest.endIndex)...]
            }
            body = out
        }
        return (status, headers, body)
    }
}
