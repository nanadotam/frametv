import SwiftUI

// The pieces of GlamBooth's Clean theme, as native SwiftUI: .btn, .icon-btn, .card, .kicker, .chip, .switch, .toast, .field.

struct CleanButton: ButtonStyle {
    enum Kind { case primary, secondary, outline, ghost, danger }
    var kind: Kind = .primary
    var size: CGFloat = 52
    var block = true

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.figtree(size >= 56 ? 18 : 16, .bold))
            .padding(.horizontal, 20)
            .frame(maxWidth: block ? .infinity : nil, minHeight: size)
            .foregroundStyle(fg)
            .background(RoundedRectangle(cornerRadius: Clean.btnRadius, style: .continuous).fill(bg))
            .overlay(RoundedRectangle(cornerRadius: Clean.btnRadius, style: .continuous)
                .strokeBorder(kind == .outline ? Clean.line : .clear, lineWidth: 1))
            .contentShape(RoundedRectangle(cornerRadius: Clean.btnRadius, style: .continuous))
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .brightness(configuration.isPressed ? -0.03 : 0)
            .animation(Clean.ease(0.25), value: configuration.isPressed)
    }
    private var bg: Color {
        switch kind { case .primary, .danger: Clean.cherry; case .secondary: Clean.butter; case .outline: Clean.paper; case .ghost: .clear }
    }
    private var fg: Color {
        switch kind { case .primary, .danger: .white; default: Clean.ink }
    }
}

/// Round icon button: white disc with a hairline ring (Clean's .icon-btn).
struct IconButton: View {
    let icon: String
    var size: CGFloat = 40
    var tint: Bool = false
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: size * 0.4, weight: .semibold))
                .frame(width: size, height: size)
                .foregroundStyle(tint ? .white : Clean.ink)
                .background(Circle().fill(tint ? Clean.cherry : Clean.paper))
                .overlay(Circle().strokeBorder(tint ? .clear : Clean.line, lineWidth: 1))
                .shadow(color: .black.opacity(0.06), radius: 1, y: 1)
        }
        .buttonStyle(PressScale(scale: 0.92))
    }
}

struct PressScale: ButtonStyle {
    var scale: CGFloat = 0.97
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? scale : 1)
            .animation(Clean.ease(0.25), value: configuration.isPressed)
    }
}

struct CardModifier: ViewModifier {
    var padding: CGFloat = 20
    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(RoundedRectangle(cornerRadius: Clean.radius, style: .continuous).fill(Clean.paper))
            .overlay(RoundedRectangle(cornerRadius: Clean.radius, style: .continuous).strokeBorder(Clean.line, lineWidth: 1))
            .shadow(color: .black.opacity(0.04), radius: 1, y: 1)
            .shadow(color: .black.opacity(0.06), radius: 15, y: 10)
    }
}
extension View {
    func card(padding: CGFloat = 20) -> some View { modifier(CardModifier(padding: padding)) }
}

/// Small spaced-out uppercase label (.kicker).
struct Kicker: View {
    let text: String
    var icon: String?
    init(_ text: String, icon: String? = nil) { self.text = text; self.icon = icon }
    var body: some View {
        HStack(spacing: 6) {
            if let icon { Image(systemName: icon).font(.system(size: 10, weight: .bold)) }
            Text(text.uppercased()).font(.figtree(11.5, .extrabold)).tracking(1.6)
        }
        .foregroundStyle(Clean.label)
    }
}

/// Big Figtree 800 headline; text in *asterisks* turns the app red (Clean's `.display em`).
struct Display: View {
    let text: String
    var size: CGFloat = 34
    init(_ text: String, size: CGFloat = 34) { self.text = text; self.size = size }
    var body: some View {
        let parts = text.split(separator: "*", omittingEmptySubsequences: false)
        var out = AttributedString()
        for (i, p) in parts.enumerated() {
            var s = AttributedString(String(p))
            s.foregroundColor = i % 2 == 1 ? Clean.cherry : Clean.ink
            out += s
        }
        return Text(out).font(.display(size)).tracking(-size * 0.03).lineSpacing(-size * 0.1)
            .fixedSize(horizontal: false, vertical: true)
    }
}

struct Chip: View {
    let title: String
    var icon: String?
    var on: Bool
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let icon { Image(systemName: icon).font(.system(size: 12, weight: .bold)) }
                Text(title).font(.figtree(14, .semibold))
            }
            .padding(.horizontal, 14).frame(height: 36)
            .foregroundStyle(on ? Color.white : Clean.ink)
            .background(Capsule().fill(on ? Clean.cherry : Clean.field))
            .overlay(Capsule().strokeBorder(on ? .clear : Clean.line, lineWidth: 1))
        }
        .buttonStyle(PressScale(scale: 0.95))
        .animation(Clean.ease(0.3), value: on)
    }
}

/// Clean's switch: iOS green when on.
struct CleanToggleStyle: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        Button { configuration.isOn.toggle() } label: {
            HStack(spacing: 12) {
                configuration.label.frame(maxWidth: .infinity, alignment: .leading)
                Capsule().fill(configuration.isOn ? Clean.green : Clean.line.opacity(2.2))
                    .frame(width: 51, height: 31)
                    .overlay(alignment: configuration.isOn ? .trailing : .leading) {
                        Circle().fill(.white).padding(2.5).shadow(color: .black.opacity(0.2), radius: 3, y: 2)
                    }
                    .animation(Clean.spring, value: configuration.isOn)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.selection, trigger: configuration.isOn)
    }
}

/// A settings row inside a card.
struct Row<Trailing: View>: View {
    let icon: String
    let title: String
    var subtitle: String?
    @ViewBuilder var trailing: Trailing
    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: icon).font(.system(size: 15, weight: .semibold)).foregroundStyle(Clean.cherry)
                .frame(width: 34, height: 34).background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Clean.pink))
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.figtree(16, .semibold)).foregroundStyle(Clean.ink)
                if let subtitle { Text(subtitle).font(.figtree(13, .medium)).foregroundStyle(Clean.label) }
            }
            Spacer(minLength: 8)
            trailing
        }
        .frame(minHeight: 44)
    }
}

struct CleanField: View {
    let label: String
    @Binding var text: String
    var secure = false
    var keyboard: UIKeyboardType = .default
    var content: UITextContentType?
    @FocusState private var focused: Bool
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.figtree(13.5, .bold)).foregroundStyle(Clean.ink)
            Group {
                if secure { SecureField("", text: $text) } else { TextField("", text: $text) }
            }
            .font(.figtree(17, .medium))
            .keyboardType(keyboard).textContentType(content)
            .textInputAutocapitalization(.never).autocorrectionDisabled()
            .focused($focused)
            .padding(.horizontal, 14).frame(height: 50)
            .background(RoundedRectangle(cornerRadius: Clean.fieldRadius, style: .continuous).fill(Clean.field))
            .overlay(RoundedRectangle(cornerRadius: Clean.fieldRadius, style: .continuous)
                .strokeBorder(focused ? Clean.cherry : Clean.line, lineWidth: 1))
            .shadow(color: focused ? Clean.cherry.opacity(0.14) : .clear, radius: 0, x: 0, y: 0)
            .background(RoundedRectangle(cornerRadius: Clean.fieldRadius + 4, style: .continuous)
                .fill(focused ? Clean.cherry.opacity(0.14) : .clear).padding(-4))
            .animation(Clean.ease(0.25), value: focused)
        }
    }
}

/// Dark rounded toast at the bottom (.toast).
struct ToastView: View {
    let text: String
    var body: some View {
        Text(text).font(.figtree(15, .semibold)).foregroundStyle(Clean.toastInk)
            .multilineTextAlignment(.center)
            .padding(.horizontal, 18).padding(.vertical, 13)
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Clean.toast))
            .shadow(color: .black.opacity(0.2), radius: 20, y: 10)
            .padding(.horizontal, 24)
    }
}

struct ToastHost: ViewModifier {
    @Binding var text: String?
    func body(content: Content) -> some View {
        content.overlay(alignment: .bottom) {
            if let t = text {
                ToastView(text: t).padding(.bottom, 100)   // above the floating tab bar
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .task(id: t) {
                        try? await Task.sleep(for: .seconds(2.8))
                        withAnimation(Clean.ease()) { text = nil }
                    }
                    .onTapGesture { withAnimation(Clean.ease()) { text = nil } }
            }
        }
        .animation(Clean.ease(), value: text)
    }
}
extension View { func toast(_ text: Binding<String?>) -> some View { modifier(ToastHost(text: text)) } }

/// Thin progress ring (Clean's countdown ring).
struct Ring: View {
    var value: Double
    var lineWidth: CGFloat = 3
    var color: Color = Clean.cherry
    var body: some View {
        ZStack {
            Circle().stroke(color.opacity(0.18), lineWidth: lineWidth)
            Circle().trim(from: 0, to: max(0.001, min(1, value))).stroke(color, style: .init(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
        .animation(Clean.ease(), value: value)
    }
}
