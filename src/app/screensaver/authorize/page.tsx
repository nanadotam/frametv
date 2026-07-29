'use client';

import { useEffect, useState } from 'react';
import AuthShell from '@/components/auth/AuthShell';
import { Button } from '@/components/ui/button';
import { Laptop2, Copy, Check } from 'lucide-react';

const APP_SCHEME = 'frametvscreensaver';

export default function ScreensaverAuthorizePage() {
  const [status, setStatus] = useState<'checking' | 'ready' | 'error'>('checking');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const me = await fetch('/api/auth/me').then((r) => r.json()).catch(() => null);
      if (cancelled) return;

      if (me?.kind !== 'admin') {
        window.location.href = `/login?next=${encodeURIComponent('/screensaver/authorize')}`;
        return;
      }

      const res = await fetch('/api/screensaver/authorize', { method: 'POST' });
      if (!res.ok) {
        if (!cancelled) setStatus('error');
        return;
      }
      const { token, deviceToken } = await res.json();
      if (cancelled) return;

      const origin = window.location.origin;
      setShareUrl(`${origin}/s/${token}`);
      setDeepLink(
        `${APP_SCHEME}://connect?token=${encodeURIComponent(token)}` +
        `&origin=${encodeURIComponent(origin)}` +
        `&deviceToken=${encodeURIComponent(deviceToken)}`
      );
      setStatus('ready');
    })();

    return () => { cancelled = true; };
  }, []);

  const copyShareUrl = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API unavailable — the URL is already visible to select manually.
    }
  };

  return (
    <AuthShell
      title="Connect Mac Screensaver"
      description="Hand your FrameTV display off to the FrameTVScreenSaver app on this Mac."
      footer={<span>Don&apos;t have the app yet? Build it from the <code>macos-screensaver</code> folder first.</span>}
    >
      {status === 'checking' && (
        <p className="text-sm text-muted-foreground text-center py-4">Checking your session…</p>
      )}

      {status === 'error' && (
        <p className="text-sm text-destructive text-center py-4">
          Couldn&apos;t generate a share link. Try refreshing the page.
        </p>
      )}

      {status === 'ready' && deepLink && shareUrl && (
        <div className="space-y-4">
          <a href={deepLink} className="block">
            <Button className="w-full h-12 text-base gap-2" type="button">
              <Laptop2 size={18} />
              Open in FrameTVScreenSaver
            </Button>
          </a>
          <p className="text-xs text-muted-foreground text-center">
            This opens the FrameTVScreenSaver settings app installed on this Mac and configures it automatically.
          </p>

          <div className="pt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              App not installed, or nothing happened? Paste this link manually into the screensaver&apos;s Options:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 min-w-0 truncate rounded-md bg-muted px-3 py-2 text-xs">{shareUrl}</code>
              <Button variant="outline" size="icon" type="button" onClick={copyShareUrl} title="Copy">
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AuthShell>
  );
}
