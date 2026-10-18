'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  AppleLogo, Television, DeviceTabletSpeaker, GoogleDriveLogo, FilmStrip, Key, Question, ShieldCheck,
} from '@phosphor-icons/react';
import BrandMark from '@/components/BrandMark';
import { IconTile, type TileTone } from '@/components/m/List';
import { Toaster } from '@/components/m/Toast';
import { AskAI, Command, MacInstallSteps } from '@/components/help/MacInstallSteps';

function Topic({ id, icon, tone, title, children }: { id: string; icon: ReactNode; tone: TileTone; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 rounded-[24px] bg-cell p-6 shadow-cell sm:p-8">
      <div className="mb-5 flex items-center gap-3">
        <IconTile tone={tone} size={40}>{icon}</IconTile>
        <h2 className="text-[24px] font-bold tracking-tight">{title}</h2>
      </div>
      <div className="space-y-3 text-[16px] leading-relaxed text-label-2 [&_b]:text-label">{children}</div>
    </section>
  );
}

const TOC = [
  ['mac', 'Mac screensaver'],
  ['tv', 'TV'],
  ['ipad', 'iPad & other screens'],
  ['photos', 'Adding photos'],
  ['videos', 'Videos'],
  ['account', 'Your account'],
  ['trouble', 'Troubleshooting'],
];

export default function HelpPage() {
  return (
    <main className="min-h-dvh bg-grouped text-label">
      <header className="sticky top-0 z-30 border-b border-separator/60 bg-glass backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark size={28} className="rounded-[7px]" />
            <span className="text-[18px] font-bold tracking-tight">Mantel Help</span>
          </Link>
          <Link href="/admin" className="ml-auto text-[15px] font-semibold text-tint">Open Mantel</Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-6 px-5 pb-24 pt-8">
        <h1 className="text-[clamp(34px,5vw,48px)] font-bold tracking-[-0.03em]">How can we help?</h1>
        <nav className="flex flex-wrap gap-2">
          {TOC.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="pressable rounded-full bg-cell px-3.5 py-1.5 text-[15px] font-medium shadow-cell">{label}</a>
          ))}
        </nav>

        <AskAI />

        <Topic id="mac" icon={<AppleLogo size={22} weight="fill" />} tone="gray" title="Set up the Mac screensaver">
          <p>
            Mantel isn’t on the Mac App Store yet. Apple charges developers to review apps, so macOS asks you to confirm before
            opening it. These steps are just Apple’s security check. You only do them once.
          </p>
          <div className="pt-2"><MacInstallSteps /></div>
        </Topic>

        <Topic id="tv" icon={<Television size={22} weight="fill" />} tone="blue" title="Show it on a TV">
          <p>Most smart TVs (Samsung, LG, Android/Google TV, Fire TV) have a web browser.</p>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>On the TV, open the browser and go to <b>{typeof window !== 'undefined' ? window.location.host : 'mantel'}/display</b>.</li>
            <li>The TV shows a 6-letter code.</li>
            <li>On your phone, open Mantel → <b>Devices</b> → <b>A TV</b>, and type the code.</li>
            <li>Check the device name is your TV, then tap <b>Connect this TV</b>.</li>
          </ol>
          <p>Older TVs automatically get a lighter version. Looks marked “works on older smart TVs” play best there.</p>
        </Topic>

        <Topic id="ipad" icon={<DeviceTabletSpeaker size={22} weight="fill" />} tone="green" title="iPad, spare monitor or any browser">
          <p>
            In Mantel → <b>Devices</b> → <b>Any browser</b>, create a viewing link and open it on the other screen. On an iPad, tap Share →{' '}
            <b>Add to Home Screen</b>, and turn on <b>Guided Access</b> (Settings → Accessibility) to keep it on display.
          </p>
          <p>Your Mac doesn’t need to be on for these. They load your photos straight from the internet.</p>
        </Topic>

        <Topic id="photos" icon={<GoogleDriveLogo size={22} weight="fill" />} tone="blue" title="Adding photos from Google Drive">
          <p>
            Google Drive is the best home for your photos. They stay in your own account, backed up, and you can add more from your phone’s
            Drive app any time. Mantel just displays them.
          </p>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>In Google Drive, make a folder (e.g. “Mantel – Family”) and put photos in it.</li>
            <li>Tap <b>Share</b> → under General access choose <b>Anyone with the link</b> → <b>Viewer</b>.</li>
            <li>Tap <b>Copy link</b>, then in Mantel → <b>Library</b> → <b>+</b> → <b>Photos from Google Drive</b>, paste it.</li>
          </ol>
          <p className="flex gap-2"><ShieldCheck size={20} weight="fill" className="mt-0.5 shrink-0 text-ok" /> “Anyone with the link” doesn’t make the folder public or searchable. Only people who have the exact link can open it.</p>
          <p>New photos you add to the folder appear in Mantel automatically.</p>
        </Topic>

        <Topic id="videos" icon={<FilmStrip size={22} weight="fill" />} tone="purple" title="Videos">
          <p>
            Create a video album in Library and upload clips. They’re compressed on your device before uploading, and play silently on loop. Each
            account has a video storage allowance, shown at the bottom of Library.
          </p>
        </Topic>

        <Topic id="account" icon={<Key size={22} weight="fill" />} tone="orange" title="Your account & recovery key">
          <p>
            When you create an account you get a <b>recovery key</b> (it starts with MNTL). It’s the only way to reset a forgotten password. There are no
            reset emails. Keep it in your Photos, a password manager, or printed out.
          </p>
          <p>
            Forgot your password? On the sign-in page tap <b>Forgot password?</b>, or scan the QR code on your recovery key image. Lost the key?
            Sign in and make a new one in <b>Settings → Recovery key</b>.
          </p>
          <p>See every device signed in to your account, and sign any of them out, in <b>Devices</b>.</p>
        </Topic>

        <Topic id="trouble" icon={<Question size={22} weight="bold" />} tone="red" title="Troubleshooting">
          <p><b>“Mantel is damaged and can’t be opened.”</b> This is the same Apple check. Run this in Terminal, then open Mantel again:</p>
          <Command cmd="xattr -dr com.apple.quarantine /Applications/Mantel.app" />
          <p><b>The screensaver is black or says it can’t connect.</b> Open the Mantel app and click <b>Reconnect</b>, or check your Wi-Fi.</p>
          <p><b>Mantel doesn’t appear under Screen Saver.</b> Open the Mantel app → <b>Install screensaver</b>, then quit and reopen System Settings.</p>
          <p><b>Photos aren’t showing.</b> Check the Drive folder is still shared as “Anyone with the link”, then Library → the album → <b>Sync from Drive now</b>.</p>
        </Topic>
      </div>
      <Toaster />
    </main>
  );
}
