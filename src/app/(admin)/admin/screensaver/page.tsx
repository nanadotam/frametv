'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  AppleLogo, WindowsLogo, Television, DeviceTabletSpeaker, AndroidLogo, Globe, CaretDown, ArrowSquareOut,
} from '@phosphor-icons/react';
import { Page } from '@/components/m/Page';
import { IconTile, type TileTone } from '@/components/m/List';
import { Button } from '@/components/m/Controls';
import { MAC_DOWNLOAD_URL } from '@/lib/links';
import { cn } from '@/lib/utils';

function Guide({
  icon, tone, title, blurb, open, onToggle, children,
}: {
  icon: ReactNode; tone: TileTone; title: string; blurb: string; open: boolean; onToggle: () => void; children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[20px] bg-cell shadow-cell">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-4 p-4 text-left active:bg-fill">
        <IconTile tone={tone} size={48}>{icon}</IconTile>
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-semibold">{title}</p>
          <p className="text-[13px] leading-snug text-label-2">{blurb}</p>
        </div>
        <CaretDown size={18} weight="bold" className={cn('shrink-0 text-label-3 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="space-y-3 border-t border-separator px-5 py-4 text-[15px] leading-relaxed text-label-2 [&_b]:text-label">{children}</div>}
    </div>
  );
}

const Steps = ({ items }: { items: ReactNode[] }) => (
  <ol className="space-y-2">
    {items.map((it, i) => (
      <li key={i} className="flex gap-3">
        <span className="bg-ember mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white">{i + 1}</span>
        <span>{it}</span>
      </li>
    ))}
  </ol>
);

export default function ScreensaverSetupPage() {
  const [open, setOpen] = useState<string | null>('mac');
  const [inApp, setInApp] = useState(false);
  const [host, setHost] = useState('mantelapp.vercel.app');

  useEffect(() => {
    setInApp(!!window.mantel?.isApp);
    setHost(window.location.host);
    const ua = navigator.userAgent;
    if (/Windows/.test(ua)) setOpen('windows');
    else if (/iPad|iPhone/.test(ua)) setOpen('ipad');
    else if (/Android/.test(ua)) setOpen('android');
  }, []);

  const toggle = (id: string) => setOpen((o) => (o === id ? null : id));

  return (
    <Page title="Set up a screensaver" subtitle="Put your memories on any screen. Pick the device you want to use.">
      <div className="space-y-3">
        <Guide icon={<AppleLogo size={28} weight="fill" />} tone="gray" title="Mac" blurb="A real screensaver that starts when your Mac is idle" open={open === 'mac'} onToggle={() => toggle('mac')}>
          {inApp ? (
            <>
              <p>The Mantel app installs and connects the screensaver for you, step by step.</p>
              <Button block onClick={() => window.mantel?.openScreensaverSetup()}>Start screensaver setup</Button>
            </>
          ) : (
            <>
              <Steps
                items={[
                  <>Download the Mantel app and drag it into <b>Applications</b>.</>,
                  <>Open it. If macOS stops you, go to <b>System Settings → Privacy &amp; Security → Open Anyway</b>.</>,
                  <>Click <b>Screensaver</b> in the app’s toolbar and follow the four steps.</>,
                ]}
              />
              <a href={MAC_DOWNLOAD_URL} className="block"><Button block>Download for Mac</Button></a>
              <Link href="/help#mac" className="block text-center text-[15px] font-semibold text-tint">Detailed guide with pictures</Link>
            </>
          )}
        </Guide>

        <Guide icon={<Television size={28} weight="fill" />} tone="blue" title="Smart TV" blurb="Samsung, LG, Android/Google TV, Fire TV" open={open === 'tv'} onToggle={() => toggle('tv')}>
          <Steps
            items={[
              <>On the TV, open its web browser (Samsung: <b>Internet</b>, LG: <b>Web Browser</b>, Android TV: <b>Chrome</b> or <b>TV Bro</b>).</>,
              <>Go to <b>{host}/display</b>. It shows a 6-letter code.</>,
              <>On your phone, open <b>Devices → A TV</b>, type the code and tap <b>Connect</b>.</>,
              <>Leave the browser open. Mantel stays on screen and keeps updating.</>,
            ]}
          />
          <Link href="/admin/devices" className="block"><Button block variant="tinted">Enter a TV code</Button></Link>
        </Guide>

        <Guide icon={<DeviceTabletSpeaker size={28} weight="fill" />} tone="green" title="iPad or iPhone" blurb="Turn a spare iPad into a picture frame" open={open === 'ipad'} onToggle={() => toggle('ipad')}>
          <Steps
            items={[
              <>In <b>Devices → Any browser</b>, create a viewing link and open it on the iPad in Safari.</>,
              <>Tap <b>Share → Add to Home Screen</b> so it opens full screen.</>,
              <>In iPad Settings → <b>Display &amp; Brightness → Auto-Lock</b>, choose <b>Never</b> (while plugged in).</>,
              <>Optional: <b>Settings → Accessibility → Guided Access</b> keeps it locked to Mantel.</>,
            ]}
          />
          <Link href="/admin/devices" className="block"><Button block variant="tinted">Get a viewing link</Button></Link>
        </Guide>

        <Guide icon={<WindowsLogo size={28} weight="fill" />} tone="blue" title="Windows PC" blurb="Show Mantel full screen on a PC or spare monitor" open={open === 'windows'} onToggle={() => toggle('windows')}>
          <Steps
            items={[
              <>Open <b>{host}/display</b> in Chrome or Edge and sign in.</>,
              <>Press <b>F11</b> for full screen.</>,
              <>Optional: in Chrome’s menu choose <b>Cast, save and share → Install page as app</b> for a Mantel window that opens straight to your photos.</>,
            ]}
          />
          <p className="text-[13px]">A true Windows screensaver is on the way.</p>
        </Guide>

        <Guide icon={<AndroidLogo size={28} weight="fill" />} tone="green" title="Android tablet or phone" blurb="Use an old Android device as a frame" open={open === 'android'} onToggle={() => toggle('android')}>
          <Steps
            items={[
              <>Open your viewing link (Devices → Any browser) in Chrome.</>,
              <>Menu → <b>Add to Home screen</b>, then open it from there for full screen.</>,
              <>Settings → Display → <b>Screen timeout</b>: set it as long as possible while charging, or turn on <b>Stay awake</b> in Developer options.</>,
            ]}
          />
        </Guide>

        <Guide icon={<Globe size={28} weight="bold" />} tone="indigo" title="Any other browser" blurb="Chromebook, Linux, a laptop you leave open" open={open === 'other'} onToggle={() => toggle('other')}>
          <p>Open <b>{host}/display</b>, sign in once, and make the window full screen. It remembers you for 90 days.</p>
          <a href="/display" target="_blank" rel="noreferrer" className="block">
            <Button block variant="tinted" icon={<ArrowSquareOut size={18} weight="bold" />}>Open the display here</Button>
          </a>
        </Guide>
      </div>
    </Page>
  );
}
