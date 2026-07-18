'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Tv, CheckCircle2, Loader2 } from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';
import { Button } from '@/components/ui/button';

type Status = 'checking' | 'ready' | 'approving' | 'approved' | 'error';

export default function PairCodePage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = (params.code ?? '').toUpperCase();

  const [status, setStatus] = useState<Status>('checking');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/auth/me')
      .then(async (res) => {
        const json = await res.json();
        if (res.ok && json.kind === 'admin') {
          setStatus('ready');
        } else {
          router.replace(`/login?next=${encodeURIComponent(`/pair/${code}`)}`);
        }
      })
      .catch(() => router.replace(`/login?next=${encodeURIComponent(`/pair/${code}`)}`));
  }, [code, router]);

  const approve = async () => {
    setStatus('approving');
    setError('');
    try {
      const res = await fetch('/api/auth/pair/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Unable to approve this code.');
      setStatus('approved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to approve this code.');
      setStatus('ready');
    }
  };

  return (
    <AuthShell
      title="Pair a TV"
      description="Confirm the code shown on your TV to sign it in."
      footer={<span>Only approve this if you&apos;re looking at your own TV right now.</span>}
    >
      <div className="flex flex-col items-center gap-5 py-2 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          {status === 'approved' ? (
            <CheckCircle2 size={28} className="text-emerald-500" />
          ) : (
            <Tv size={28} className="text-primary" />
          )}
        </div>

        <div className="font-mono font-bold tracking-[0.3em] text-3xl">{code}</div>

        {status === 'approved' ? (
          <p className="text-sm text-emerald-500 font-medium">TV signed in — you can put your phone down.</p>
        ) : (
          <p className="text-sm text-muted-foreground">Is this the code on your TV screen?</p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {status !== 'approved' && (
          <Button
            className="w-full"
            onClick={approve}
            disabled={status === 'checking' || status === 'approving'}
          >
            {status === 'approving' ? <Loader2 size={16} className="animate-spin" /> : 'Confirm & sign in'}
          </Button>
        )}
      </div>
    </AuthShell>
  );
}
