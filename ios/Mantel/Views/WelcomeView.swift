import SwiftUI

/// First run: sign in to your Mantel, or just use photos from this iPhone.
struct WelcomeView: View {
    @Environment(Library.self) private var library
    @State private var signIn = false
    @State private var appear = false

    var body: some View {
        GeometryReader { geo in
            let wide = geo.size.width > geo.size.height && geo.size.width > 600
            let layout = wide ? AnyLayout(HStackLayout(spacing: 40)) : AnyLayout(VStackLayout(spacing: 0))
            layout {
                collage
                    .frame(maxWidth: wide ? geo.size.width * 0.45 : .infinity, maxHeight: wide ? .infinity : geo.size.height * 0.48)
                VStack(alignment: .leading, spacing: 18) {
                    Image("Mark").resizable().frame(width: 52, height: 52).clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    Display("Your photos,\n*on the mantel.*", size: wide ? 40 : 38)
                    Text("Turn this iPhone into a photo frame. Full screen on the nightstand, in a corner while you work, and in StandBy while it charges — even with no internet.")
                        .font(.figtree(16, .medium)).foregroundStyle(Clean.label).fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 8)
                    Button { signIn = true } label: { Label("Sign in to Mantel", systemImage: "person.crop.circle") }
                        .buttonStyle(CleanButton(kind: .primary, size: 56))
                    Button {
                        library.newDeviceAlbum("On this iPhone")
                        library.onboarded = true
                    } label: { Text("Just use photos on this iPhone") }
                        .buttonStyle(CleanButton(kind: .secondary, size: 56))
                }
                .padding(.horizontal, 24).padding(.bottom, 12).padding(.top, wide ? 24 : 20)
                .frame(maxWidth: 520)
                .opacity(appear ? 1 : 0).offset(y: appear ? 0 : 24)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(Clean.appBg.ignoresSafeArea())
        .sheet(isPresented: $signIn) { SignInSheet() }
        .onAppear { withAnimation(Clean.ease(0.9).delay(0.1)) { appear = true } }
    }

    /// Three tilted frames on a soft wall — hint of what the app does.
    private var collage: some View {
        GeometryReader { g in
            let w = min(g.size.width, g.size.height) * 0.46
            ZStack {
                frame(colors: [0x3B2A6B, 0xE0588A, 0xFFB16B], w: w * 0.8).rotationEffect(.degrees(appear ? -9 : 0)).offset(x: appear ? -w * 0.62 : 0, y: w * 0.08)
                frame(colors: [0x1d4d4f, 0x6fb3a0, 0xf2e5c4], w: w * 0.8).rotationEffect(.degrees(appear ? 8 : 0)).offset(x: appear ? w * 0.62 : 0, y: w * 0.12)
                frame(colors: [0xC92D5C, 0xF2622E, 0xFFB547], w: w).offset(y: appear ? -w * 0.04 : 0)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .animation(.spring(response: 0.8, dampingFraction: 0.75).delay(0.15), value: appear)
        }
    }

    private func frame(colors: [UInt32], w: CGFloat) -> some View {
        RoundedRectangle(cornerRadius: 10, style: .continuous)
            .fill(LinearGradient(colors: colors.map { Color(hex: $0) }, startPoint: .top, endPoint: .bottom))
            .overlay(alignment: .bottom) {
                Circle().fill(Color(hex: 0xFFE3A3)).frame(width: w * 0.28).offset(y: -w * 0.32)
            }
            .frame(width: w, height: w * 1.25)
            .padding(10)
            .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Clean.paper))
            .shadow(color: .black.opacity(0.12), radius: 24, y: 14)
    }
}

struct SignInSheet: View {
    @Environment(Library.self) private var library
    @Environment(\.dismiss) private var dismiss
    @State private var email = ""
    @State private var password = ""
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Kicker("Mantel account", icon: "person.fill")
                Display("Welcome *back*", size: 32)
                Text("Use the email and password you use on mantelapp.vercel.app. Your albums come across and are saved here for offline.")
                    .font(.figtree(15, .medium)).foregroundStyle(Clean.label)
                CleanField(label: "Email", text: $email, keyboard: .emailAddress, content: .username)
                CleanField(label: "Password", text: $password, secure: true, content: .password)
                if let error {
                    Label(error, systemImage: "exclamationmark.circle.fill").font(.figtree(14, .semibold)).foregroundStyle(Clean.cherry)
                }
                Button {
                    Task { await go() }
                } label: {
                    HStack { if busy { ProgressView().tint(.white) }; Text(busy ? "Signing in…" : "Sign in") }
                }
                .buttonStyle(CleanButton(kind: .primary, size: 56))
                .disabled(busy || email.isEmpty || password.isEmpty)
                .opacity(email.isEmpty || password.isEmpty ? 0.5 : 1)
                Link(destination: URL(string: "https://mantelapp.vercel.app/signup")!) {
                    Text("No account yet? Create one on the web").font(.figtree(14, .semibold)).underline()
                        .foregroundStyle(Clean.ink).frame(maxWidth: .infinity)
                }
            }
            .padding(24)
        }
        .background(Clean.appBg.ignoresSafeArea())
        .presentationDetents([.large])
        .presentationCornerRadius(28)
    }

    private func go() async {
        busy = true; error = nil
        do { try await library.signIn(email: email, password: password); dismiss() }
        catch { self.error = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription }
        busy = false
    }
}
