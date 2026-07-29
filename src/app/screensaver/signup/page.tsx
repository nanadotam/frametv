'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import AuthShell from '@/components/auth/AuthShell';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { guessDeviceName } from '@/lib/deviceName';

// Signup specifically for the macOS screensaver connect flow — no display
// PIN (the screensaver never uses it; it authenticates via the /s/<token>
// share link instead) and no manual device-name entry (auto-derived from
// the browser, since this page is only ever opened from inside the
// screensaver's embedded sign-in view or its browser-based fallback).
function ScreensaverSignupForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/screensaver/authorize';

  const [form, setForm] = useState({ name: '', username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [deviceName, setDeviceName] = useState('');

  useEffect(() => {
    setDeviceName(guessDeviceName());
  }, []);

  const update = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, device_name: deviceName }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Unable to create account.');
      window.location.href = `/screensaver/setup?next=${encodeURIComponent(next)}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create your FrameTV account"
      description="Just enough to get your screensaver connected — no PIN, no setup wizard."
      footer={
        <>
          Already have an account?{' '}
          <Link className="text-primary font-medium" href={`/login?next=${encodeURIComponent(next)}`}>
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => update('name', e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Username</Label>
            <Input value={form.username} onChange={(e) => update('username', e.target.value)} required />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>Password</Label>
          <PasswordInput value={form.password} onChange={(e) => update('password', e.target.value)} required />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button className="w-full" type="submit" disabled={loading}>
          {loading ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthShell>
  );
}

export default function ScreensaverSignupPage() {
  return (
    <Suspense fallback={null}>
      <ScreensaverSignupForm />
    </Suspense>
  );
}
