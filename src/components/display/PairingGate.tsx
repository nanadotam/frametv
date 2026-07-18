'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

type PairState = 'loading' | 'waiting' | 'approved' | 'error';

async function startPairing(): Promise<{ code: string; expires_at: string }> {
  const res = await fetch('/api/auth/pair/start', { method: 'POST' });
  if (!res.ok) throw new Error('Unable to start pairing.');
  return res.json();
}

export default function PairingGate({ onUnlock, onUsePin }: { onUnlock: () => void; onUsePin: () => void }) {
  const [state, setState] = useState<PairState>('loading');
  const [code, setCode] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const consumingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const clearTimers = () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };

    const begin = async () => {
      clearTimers();
      setState('loading');
      try {
        const { code: newCode, expires_at } = await startPairing();
        if (cancelled) return;
        setCode(newCode);
        setState('waiting');

        const url = `${window.location.origin}/pair/${newCode}`;
        QRCode.toDataURL(url, { margin: 1, width: 320, color: { dark: '#000000', light: '#ffffff' } })
          .then((dataUrl) => { if (!cancelled) setQrDataUrl(dataUrl); })
          .catch(() => {});

        const expiresAt = new Date(expires_at).getTime();
        setSecondsLeft(Math.max(0, Math.round((expiresAt - Date.now()) / 1000)));
        tickRef.current = setInterval(() => {
          setSecondsLeft(Math.max(0, Math.round((expiresAt - Date.now()) / 1000)));
        }, 1000);

        pollRef.current = setInterval(async () => {
          if (consumingRef.current) return;
          try {
            const res = await fetch(`/api/auth/pair/status?code=${newCode}`);
            const json = await res.json();
            if (cancelled) return;

            if (json.status === 'approved') {
              consumingRef.current = true;
              clearTimers();
              const consumeRes = await fetch('/api/auth/pair/consume', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: newCode }),
              });
              if (consumeRes.ok) {
                setState('approved');
                onUnlock();
              } else {
                begin();
              }
            } else if (json.status === 'expired' || json.status === 'invalid') {
              begin();
            }
          } catch {
            // Transient network error — keep polling.
          }
        }, 2000);
      } catch {
        if (!cancelled) setState('error');
      }
    };

    begin();

    return () => {
      cancelled = true;
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <div className="w-screen h-screen bg-black text-white flex items-center justify-center px-8">
      <div className="w-full max-w-2xl flex flex-col items-center text-center gap-6">
        <div className="w-20 h-20 rounded-3xl bg-white/10 flex items-center justify-center text-4xl">📺</div>
        <h1 className="text-5xl font-bold tracking-tight">FrameTV</h1>
        <p className="text-xl text-white/50">Go to your phone, sign in, and enter this code — or scan the QR code</p>

        {state === 'error' ? (
          <p className="text-lg text-red-300">Could not reach the server. Retrying…</p>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-8 mt-2">
            <div
              className="font-mono font-bold tracking-[0.3em] text-6xl bg-white/10 border border-white/15 rounded-2xl px-8 py-6 min-w-[280px]"
              style={{ letterSpacing: '0.25em' }}
            >
              {code || '——————'}
            </div>
            {qrDataUrl && (
              <div className="bg-white rounded-2xl p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="Scan to pair" width={160} height={160} />
              </div>
            )}
          </div>
        )}

        {state === 'waiting' && (
          <p className="text-sm text-white/35">
            Code expires in {minutes}:{seconds.toString().padStart(2, '0')}
          </p>
        )}

        <button
          type="button"
          onClick={onUsePin}
          className="mt-4 text-sm font-medium uppercase tracking-[0.1em] text-white/45 hover:text-white transition-colors"
        >
          Sign in with PIN instead
        </button>
      </div>
    </div>
  );
}
