'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import AuthShell from '@/components/auth/AuthShell';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { HardDrive } from 'lucide-react';

// Deliberately the smallest possible "get something on screen" step for a
// screensaver-only signup — just enough to add one photo source, then hand
// off to /screensaver/authorize. Full album/mode management still lives in
// the admin dashboard; this isn't trying to replace it.
function ScreensaverSetupForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/screensaver/authorize';

  const [driveUrl, setDriveUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [synced, setSynced] = useState<number | null>(null);

  const proceed = () => { window.location.href = next; };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!driveUrl.trim()) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderUrl: driveUrl }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Unable to import that folder.');
      setSynced(json.synced ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to import that folder.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Add your photos"
      description="One Google Drive folder is all it takes — you can add more later from the admin dashboard."
      footer={<span>FrameTV streams straight from your Drive link — nothing is copied or stored.</span>}
    >
      {synced !== null ? (
        <div className="space-y-4 text-center py-2">
          <p className="text-sm font-medium text-emerald-500">
            Imported {synced} photo{synced === 1 ? '' : 's'} 🎉
          </p>
          <Button className="w-full" onClick={proceed}>Continue</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><HardDrive size={13} /> Google Drive folder link</Label>
            <Input
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/…"
            />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Open the folder in Drive → Share → change to &ldquo;Anyone with the link&rdquo; can view → paste the link here.
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" type="submit" disabled={loading || !driveUrl.trim()}>
            {loading ? 'Importing…' : 'Import folder'}
          </Button>
          <button
            type="button"
            onClick={proceed}
            className="block w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip for now
          </button>
        </form>
      )}
    </AuthShell>
  );
}

export default function ScreensaverSetupPage() {
  return (
    <Suspense fallback={null}>
      <ScreensaverSetupForm />
    </Suspense>
  );
}
