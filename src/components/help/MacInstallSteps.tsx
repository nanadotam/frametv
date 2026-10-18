'use client';

import type { ReactNode } from 'react';
import { Copy, Sparkle } from '@phosphor-icons/react';
import { toast } from '@/components/m/Toast';
import { helpPrompt } from '@/lib/helpPrompt';

export const UNQUARANTINE_APP = 'xattr -dr com.apple.quarantine /Applications/Mantel.app';
export const UNQUARANTINE_SAVER = 'xattr -dr com.apple.quarantine ~/Library/Screen\\ Savers/Mantel.saver';

/** A Terminal command with a big copy button. */
export function Command({ cmd }: { cmd: string }) {
  return (
    <div className="flex items-center gap-2 rounded-[12px] bg-[#1c1c1e] p-2 pl-3 text-white">
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-[13px]">{cmd}</code>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(cmd);
          toast('Command copied');
        }}
        className="pressable flex shrink-0 items-center gap-1 rounded-[9px] bg-white/15 px-2.5 py-1.5 text-[13px] font-semibold"
      >
        <Copy size={14} weight="bold" /> Copy
      </button>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="bg-ember flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white">{n}</span>
      <div className="min-w-0 flex-1 pb-2">
        <h3 className="text-[18px] font-semibold tracking-tight">{title}</h3>
        <div className="mt-1.5 space-y-3 text-[15px] leading-relaxed text-label-2">{children}</div>
      </div>
    </li>
  );
}

/** Fake macOS alert, so people recognise the real one when it appears. */
function MacAlert({ title, body, buttons }: { title: string; body: string; buttons: string[] }) {
  return (
    <div className="mx-auto max-w-[300px] rounded-[14px] bg-[#ececec] p-4 text-center text-[#1d1d1f] shadow-lg ring-1 ring-black/10 dark:bg-[#2a2a2c] dark:text-white">
      <p className="text-[13px] font-bold leading-snug">{title}</p>
      <p className="mt-1 text-[11px] leading-snug opacity-70">{body}</p>
      <div className="mt-3 flex gap-2">
        {buttons.map((b, i) => (
          <span key={b} className={`flex-1 rounded-[6px] py-1 text-[12px] font-medium ${i === buttons.length - 1 ? 'bg-[#0a84ff] text-white' : 'bg-white dark:bg-[#48484a]'}`}>{b}</span>
        ))}
      </div>
    </div>
  );
}

export function AskAI() {
  return (
    <div className="rounded-[18px] bg-cell p-5 shadow-cell">
      <p className="flex items-center gap-2 text-[17px] font-semibold"><Sparkle size={20} weight="fill" className="text-[#af52de]" /> Stuck? Ask an AI to walk you through it</p>
      <p className="mt-1 text-[15px] leading-relaxed text-label-2">
        Copy this prompt and paste it into ChatGPT, Claude or Gemini. Then describe what you see. It already knows how Mantel installs.
      </p>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(helpPrompt(window.location.origin));
          toast('Prompt copied. Paste it into your AI chat.');
        }}
        className="pressable mt-3 inline-flex h-11 items-center gap-2 rounded-[12px] bg-[#af52de]/15 px-4 text-[15px] font-semibold text-[#af52de]"
      >
        <Copy size={16} weight="bold" /> Copy help prompt
      </button>
    </div>
  );
}

/** The full "install on a Mac" walkthrough, used on /download and /help. */
export function MacInstallSteps() {
  return (
    <ol className="space-y-6">
      <Step n={1} title="Open the download">
        <p>Open <b className="text-label">Mantel.dmg</b> from your Downloads folder, then drag <b className="text-label">Mantel</b> into <b className="text-label">Applications</b>.</p>
      </Step>
      <Step n={2} title="Open Mantel from Applications">
        <p>
          The first time, macOS will stop you with a message like this. <b className="text-label">Don’t worry, this is expected.</b> Mantel isn’t on the
          App Store yet, so Apple hasn’t checked it. Nothing is wrong with your Mac or the app.
        </p>
        <MacAlert title="“Mantel” Not Opened" body="Apple could not verify “Mantel” is free of malware that may harm your Mac or compromise your privacy." buttons={['Move to Trash', 'Done']} />
        <p>Click <b className="text-label">Done</b> (not Move to Trash).</p>
      </Step>
      <Step n={3} title="Allow it in Privacy & Security">
        <p>
          Open <b className="text-label">System Settings</b> → <b className="text-label">Privacy &amp; Security</b>, scroll to the bottom, and
          click <b className="text-label">Open Anyway</b> next to “Mantel was blocked”. Enter your Mac password, then click <b className="text-label">Open Anyway</b> once more.
        </p>
        <p>
          <b className="text-label">Prefer Terminal, or don’t see the button?</b> Open the Terminal app (press ⌘ Space, type “Terminal”), paste this, and press Return:
        </p>
        <Command cmd={UNQUARANTINE_APP} />
      </Step>
      <Step n={4} title="Let Mantel set up your screensaver">
        <p>
          Sign in, then follow the app’s steps. It installs the screensaver for you and opens the right page in System Settings. If macOS blocks the
          screensaver too, the app shows a button for it. Or paste this into Terminal:
        </p>
        <Command cmd={UNQUARANTINE_SAVER} />
      </Step>
      <Step n={5} title="Pick Mantel as your screensaver">
        <p>
          In <b className="text-label">System Settings</b> → <b className="text-label">Screen Saver</b>, scroll to <b className="text-label">Other</b> and choose{' '}
          <b className="text-label">Mantel</b>. Set when it starts under <b className="text-label">Lock Screen</b> → “Start Screen Saver when inactive”.
        </p>
      </Step>
    </ol>
  );
}
