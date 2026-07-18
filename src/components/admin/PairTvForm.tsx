'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function PairTvForm() {
  const [code, setCode]       = useState('');
  const [saving, setSaving]   = useState(false);
  const [result, setResult]   = useState<{ ok: boolean; msg: string } | null>(null);

  const approve = async () => {
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch('/api/auth/pair/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Unable to pair.');
      setResult({ ok: true, msg: 'TV signed in.' });
      setCode('');
      setTimeout(() => setResult(null), 4000);
    } catch (err) {
      setResult({ ok: false, msg: err instanceof Error ? err.message : 'Unable to pair.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">
        Enter the 6-character code shown on your TV screen — or open{' '}
        <span className="font-mono">frametv.app/pair/CODE</span> directly by scanning its QR code.
      </p>
      <div className="flex items-center gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          placeholder="ABC123"
          className="font-mono tracking-[0.3em] uppercase"
          maxLength={6}
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && code.length === 6 && approve()}
        />
        <Button size="sm" onClick={approve} disabled={saving || code.length < 6}>
          {saving ? 'Pairing…' : result?.ok ? <><CheckCircle2 size={14} /> Paired</> : 'Pair'}
        </Button>
      </div>
      {result && (
        <p className={cn('text-sm mt-2', result.ok ? 'text-green-400' : 'text-red-400')}>
          {result.msg}
        </p>
      )}
    </div>
  );
}
