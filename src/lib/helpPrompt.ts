/**
 * A ready-made prompt people can paste into ChatGPT, Claude, Gemini etc.
 * when they get stuck setting Mantel up. It gives the assistant enough
 * context to walk them through it without guessing.
 */
export function helpPrompt(siteUrl: string) {
  return `I'm setting up an app called Mantel on my Mac and need step-by-step help. Please be patient and explain each step simply, one at a time, and ask me what I see on screen before moving on.

About Mantel:
- Mantel turns a Mac screensaver (or a TV/any browser) into a living picture frame showing my photos and videos.
- Website and account: ${siteUrl}
- The Mac app is "Mantel.app", downloaded as Mantel.dmg from the website. It's not from the Mac App Store, so macOS Gatekeeper may say it "can't be opened" or "is damaged" or "Apple could not verify" it. That's only because the developer hasn't paid for Apple notarization. It's not malware.
- The fix for the app: open System Settings → Privacy & Security, scroll down and click "Open Anyway" next to the Mantel message, then enter my Mac password. Alternatively in Terminal: xattr -dr com.apple.quarantine /Applications/Mantel.app
- The app installs a screensaver file called "Mantel.saver" into ~/Library/Screen Savers. If macOS blocks the screensaver, the fix in Terminal is: xattr -dr com.apple.quarantine ~/Library/Screen\\ Savers/Mantel.saver
- Then choose it in System Settings → Screen Saver (on macOS Sonoma or newer it's under "Other"), click Options, and sign in.
- Photos come from Google Drive folders shared as "Anyone with the link", which I paste into Mantel's Library. Videos are uploaded directly.

My Mac's macOS version is: [fill in, e.g. Sequoia 15.3 — Apple menu → About This Mac]

What's going wrong: [describe what you see, or paste the exact error message]`;
}
