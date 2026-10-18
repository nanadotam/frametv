'use client';

import { useEffect, useState } from 'react';
import AuthShell from '@/components/auth/AuthShell';
import { Button } from '@/components/m/Controls';
import { toast } from '@/components/m/Toast';
import { AppleLogo, Copy } from '@phosphor-icons/react';

// The screensaver's Options panel intercepts `frametvscreensaver://`; the
// Mantel desktop app registers `mantel://` and opens this page with
// ?client=app.
function appScheme() {
  if (typeof window === 'undefined') return 'frametvscreensaver';
  return new URLSearchParams(window.location.search).get('client') === 'app' ? 'mantel' : 'frametvscreensaver';
}

export default function ScreensaverAuthorizePage() {
  const [status, setStatus] = useState<'checking' | 'ready' | 'error'>('checking');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const me = await fetch('/api/auth/me').then((r) => r.json()).catch(() => null);
      if (cancelled) return;

      if (me?.kind !== 'admin') {
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
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
        `${appScheme()}://connect?token=${encodeURIComponent(token)}` +
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
      toast('Link copied');
    } catch {
      // Clipboard API unavailable — the URL is already visible to select manually.
    }
  };

  return (
    <AuthShell
      title="Connect this Mac"
      description="Link your Mantel account to the screensaver on this Mac."
    >
      {status === 'checking' && <p className="py-6 text-center text-[15px] text-label-2">Checking your account…</p>}

      {status === 'error' && (
        <p className="py-6 text-center text-[15px] text-bad">Something went wrong. Refresh the page to try again.</p>
      )}

      {status === 'ready' && deepLink && shareUrl && (
        <>
          <a href={deepLink} className="block">
            <Button block size="xl" icon={<AppleLogo size={22} weight="fill" />}>Connect Mantel</Button>
          </a>
          <p className="px-2 text-center text-[13px] text-label-2">
            If your Mac asks whether to open Mantel, choose Open.
          </p>
          <div className="mt-4 rounded-[14px] bg-cell p-4 shadow-cell">
            <p className="text-[13px] font-medium text-label-2">Nothing happened? Paste this into the screensaver’s Options instead:</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-[10px] bg-fill px-3 py-2 text-[13px]">{shareUrl}</code>
              <button type="button" onClick={copyShareUrl} className="pressable rounded-full bg-fill p-2" aria-label="Copy link">
                <Copy size={18} />
              </button>
            </div>
          </div>
        </>
      )}
    </AuthShell>
  );
}
