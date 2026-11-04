import SwiftUI
import WidgetKit

struct SettingsView: View {
    var inTab = false
    @Environment(Library.self) private var library
    @Environment(Prefs.self) private var prefs
    @Environment(\.dismiss) private var dismiss
    @State private var signIn = false
    @State private var confirmSignOut = false

    var body: some View {
        @Bindable var prefs = prefs
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                HStack {
                    Display("Settings", size: 32)
                    Spacer()
                    if !inTab { IconButton(icon: "xmark", size: 38) { dismiss() } }
                }
                account
                section("Frame") { FrameOptions() }
                section("Appearance") {
                    HStack(spacing: 8) {
                        ForEach(Prefs.Appearance.allCases) { a in
                            Chip(title: a.title, icon: a == .auto ? "circle.lefthalf.filled" : a == .light ? "sun.max.fill" : "moon.fill",
                                 on: prefs.appearance == a) { prefs.appearance = a }
                        }
                    }
                }
                section("Widgets & StandBy") { widgets }
                section("Storage") {
                    NavigationLink { StorageView() } label: {
                        Row(icon: "internaldrive.fill", title: "Downloads & storage", subtitle: storageSummary) {
                            Image(systemName: "chevron.right").font(.system(size: 13, weight: .bold)).foregroundStyle(Clean.label)
                        }
                        .card(padding: 14)
                    }
                    .buttonStyle(PressScale())
                }
                section("About") {
                    VStack(spacing: 12) {
                        Row(icon: "globe", title: "Mantel on the web", subtitle: "Albums, Google Drive and Google Photos") {
                            Link(destination: MantelAPI.defaultBase) { Image(systemName: "arrow.up.right").font(.system(size: 13, weight: .bold)) }
                        }
                        Divider().overlay(Clean.line)
                        Row(icon: "info.circle.fill", title: "Version", subtitle: nil) {
                            Text(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0")
                                .font(.figtree(15, .semibold)).foregroundStyle(Clean.label)
                        }
                    }
                    .card(padding: 14)
                }
            }
            .padding(20)
        }
        .background(Clean.appBg.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
        .sheet(isPresented: $signIn) { SignInSheet() }
        .confirmationDialog("Sign out of Mantel?", isPresented: $confirmSignOut, titleVisibility: .visible) {
            Button("Sign out", role: .destructive) { Task { await library.signOut() } }
        } message: { Text("Your Mantel albums and their downloads are removed from this device. Albums made on this device stay.") }
        .onChange(of: prefs.widgetMinutes) { _, _ in library.writeWidgetFeed() }
        .onChange(of: prefs.cacheLimitMB) { _, _ in library.scheduleSync() }
    }

    @State private var storageSummary = "Calculating…"

    private var account: some View {
        HStack(spacing: 14) {
            Group {
                if library.signedIn { Text(initials).font(.figtree(18, .extrabold)) }
                else { Image(systemName: "iphone").font(.system(size: 20, weight: .semibold)) }
            }
            .foregroundStyle(.white)
                .frame(width: 52, height: 52).background(Circle().fill(Clean.cherry))
            VStack(alignment: .leading, spacing: 2) {
                Text(library.user?.name ?? (library.signedIn ? "Mantel" : "Not signed in")).font(.figtree(17, .bold)).foregroundStyle(Clean.ink)
                Text(library.user?.email ?? "Photos on this device only").font(.figtree(14, .medium)).foregroundStyle(Clean.label)
            }
            Spacer()
            if library.signedIn {
                Button("Sign out") { confirmSignOut = true }.buttonStyle(CleanButton(kind: .outline, size: 38, block: false))
            } else {
                Button("Sign in") { signIn = true }.buttonStyle(CleanButton(kind: .primary, size: 38, block: false))
            }
        }
        .card(padding: 16)
        .task {
            let u = await ImageCache.shared.usage().values.reduce(0, +) + ImageCache.deviceUsage()
            storageSummary = "\(u.bytesText) on this device"
        }
    }

    private var initials: String {
        let n = library.user?.name ?? library.user?.email ?? "M"
        return n.split(separator: " ").prefix(2).compactMap(\.first).map(String.init).joined().uppercased()
    }

    private var widgets: some View {
        @Bindable var prefs = prefs
        return VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 10) {
                Kicker("Widget photo changes every")
                FlowLayout(spacing: 8) {
                    ForEach([1, 5, 10, 15, 30, 60], id: \.self) { m in
                        Chip(title: m < 60 ? "\(m) min" : "1 hr", on: prefs.widgetMinutes == m) { prefs.widgetMinutes = m }
                    }
                }
            }
            VStack(alignment: .leading, spacing: 14) {
                tip("1", "StandBy", "Turn your iPhone on its side while it charges. Swipe to the widgets page, hold, tap +, and add Mantel. Swipe up on a stack to see a full-screen photo.")
                Divider().overlay(Clean.line)
                tip("2", "Home Screen", "Hold your Home Screen, tap Edit → Add Widget, and pick Mantel: Photo, Photo & Clock, Grid, Pinterest, Scrapbook or Scripture. Hold a widget → Edit Widget to choose its album.")
                Divider().overlay(Clean.line)
                tip("3", "Control Center & Action button", "Add the Play Mantel control to open the frame full screen in one tap. It's in Shortcuts too — say \"Play Mantel\".")
            }
            .card(padding: 16)
            Button {
                library.writeWidgetFeed()
                library.toast = "Widgets refreshed"
            } label: { Label("Refresh widgets now", systemImage: "arrow.clockwise") }
                .buttonStyle(CleanButton(kind: .secondary, size: 46))
        }
    }

    private func tip(_ n: String, _ title: String, _ body: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Text(n).font(.figtree(13, .extrabold)).foregroundStyle(Clean.cherry)
                .frame(width: 26, height: 26).background(Circle().fill(Clean.pink))
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.figtree(15, .bold)).foregroundStyle(Clean.ink)
                Text(body).font(.figtree(14, .medium)).foregroundStyle(Clean.label).fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private func section<C: View>(_ title: String, @ViewBuilder _ c: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 12) { Kicker(title); c() }
    }
}

/// What's saved on this device, per album, with ways to clear it.
struct StorageView: View {
    @Environment(Library.self) private var library
    @Environment(Prefs.self) private var prefs
    @Environment(\.dismiss) private var dismiss
    @State private var usage: [String: Int64] = [:]
    @State private var device: Int64 = 0
    @State private var video: Int64 = 0
    @State private var web: Int64 = 0
    @State private var confirmClear = false

    private var downloads: Int64 { usage.values.reduce(0, +) + video + web }

    var body: some View {
        @Bindable var prefs = prefs
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack {
                    IconButton(icon: "chevron.left", size: 40) { dismiss() }
                    Spacer()
                }
                Display("Storage", size: 32)
                summary
                VStack(alignment: .leading, spacing: 10) {
                    Kicker("Keep downloads under")
                    FlowLayout(spacing: 8) {
                        ForEach([512, 1024, 2048, 5120, 10240], id: \.self) { mb in
                            Chip(title: mb < 1024 ? "\(mb) MB" : "\(mb / 1024) GB", on: prefs.cacheLimitMB == mb) { prefs.cacheLimitMB = mb }
                        }
                    }
                    Toggle(isOn: $prefs.wifiOnly) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Download on Wi-Fi only").font(.figtree(16, .semibold)).foregroundStyle(Clean.ink)
                            Text("Saves mobile data").font(.figtree(13, .medium)).foregroundStyle(Clean.label)
                        }
                    }
                    .toggleStyle(CleanToggleStyle()).card(padding: 14).padding(.top, 6)
                }
                VStack(alignment: .leading, spacing: 10) {
                    Kicker("By album")
                    VStack(spacing: 0) {
                        ForEach(library.albums) { a in
                            albumRow(a)
                            if a.id != library.albums.last?.id { Divider().overlay(Clean.line).padding(.leading, 64) }
                        }
                    }
                    .card(padding: 6)
                }
                Button(role: .destructive) { confirmClear = true } label: { Label("Clear all downloads", systemImage: "trash") }
                    .buttonStyle(CleanButton(kind: .danger, size: 52))
                Text("Downloads are copies of your Mantel photos and videos so the frame and widgets work offline. Videos use at most 30% of the limit. Linked iPhone albums take no extra space — they're read from Photos. Clearing them doesn't delete anything from your account — they'll download again when needed. Albums made on this device are kept until you delete them.")
                    .font(.figtree(13, .medium)).foregroundStyle(Clean.label)
            }
            .padding(20)
        }
        .background(Clean.appBg.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
        .navigationBarBackButtonHidden()
        .task { await measure() }
        .onChange(of: library.saved) { _, _ in Task { await measure() } }
        .confirmationDialog("Clear all downloads?", isPresented: $confirmClear, titleVisibility: .visible) {
            Button("Clear \(downloads.bytesText)", role: .destructive) { Task { await library.clearAllDownloads(); await measure() } }
        } message: { Text("Photos stay in your Mantel account. Offline viewing needs them downloaded again.") }
    }

    private var summary: some View {
        let limit = Int64(prefs.cacheLimitMB) * 1024 * 1024
        return VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline) {
                Text((downloads + device).bytesText).font(.display(34)).tracking(-1).foregroundStyle(Clean.ink)
                Text("on this \(UIDevice.current.userInterfaceIdiom == .pad ? "iPad" : "iPhone")").font(.figtree(15, .semibold)).foregroundStyle(Clean.label)
            }
            GeometryReader { g in
                HStack(spacing: 2) {
                    Capsule().fill(Clean.cherry).frame(width: max(4, g.size.width * min(Double(downloads) / Double(max(limit, 1)), 1)))
                    Capsule().fill(Clean.ink.opacity(0.5)).frame(width: device > 0 ? max(4, g.size.width * min(Double(device) / Double(max(limit, 1)), 0.5)) : 0)
                    Spacer(minLength: 0)
                }
                .background(Capsule().fill(Clean.cream))
            }
            .frame(height: 10)
            HStack(spacing: 16) {
                legend(Clean.cherry, "Downloads", downloads.bytesText)
                legend(Clean.ink.opacity(0.5), "Device albums", device.bytesText)
            }
            HStack(spacing: 16) {
                legend(Clean.cherry.opacity(0.6), "Videos", video.bytesText)
                legend(Clean.label, "Backgrounds & art", web.bytesText)
            }
        }
        .card()
    }

    private func legend(_ c: Color, _ t: String, _ v: String) -> some View {
        HStack(spacing: 6) {
            Circle().fill(c).frame(width: 8, height: 8)
            Text(t).font(.figtree(13, .semibold)).foregroundStyle(Clean.label)
            Text(v).font(.figtree(13, .bold)).foregroundStyle(Clean.ink)
        }
    }

    private func albumRow(_ a: AlbumItem) -> some View {
        HStack(spacing: 12) {
            Group {
                if let c = library.cover(a) { PhotoThumb(photo: c) } else { Clean.cream }
            }
            .frame(width: 46, height: 46).clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                Text(a.name).font(.figtree(15, .bold)).foregroundStyle(Clean.ink).lineLimit(1)
                Text(a.isDevice ? "\(library.count(a.id)) photos kept on this device"
                                : "\(library.saved[a.id] ?? 0) of \(library.count(a.id)) saved · \((usage[a.id] ?? 0).bytesText)")
                    .font(.figtree(13, .medium)).foregroundStyle(Clean.label).lineLimit(1)
            }
            Spacer()
            if !a.isDevice && (usage[a.id] ?? 0) > 0 {
                Button("Remove") { Task { await library.removeDownloads(album: a.id); await measure() } }
                    .buttonStyle(CleanButton(kind: .outline, size: 34, block: false))
            }
        }
        .padding(10)
    }

    private func measure() async {
        usage = await ImageCache.shared.usage()
        device = ImageCache.deviceUsage()
        video = VideoCache.usage()
        web = Int64(RemoteImage.cache.currentDiskUsage)
    }
}
