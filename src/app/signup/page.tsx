'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthShell from '@/components/auth/AuthShell';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    pin: '',
    device_name: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Unable to create account.');
      router.replace('/onboarding');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create account.');
    } finally {
      setLoading(false);
    }
  };

  const update = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <AuthShell
      title="Create your account"
      description="Create one FrameTV account, then use your six-digit PIN to unlock the display on TV devices."
      footer={<>Already have an account? <Link className="text-primary font-medium" href="/login">Sign in</Link></>}
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
          <Input type="password" value={form.password} onChange={(e) => update('password', e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>Six-digit display PIN</Label>
          <Input
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={form.pin}
            onChange={(e) => update('pin', e.target.value.replace(/\D/g, '').slice(0, 6))}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Device name</Label>
          <Input value={form.device_name} onChange={(e) => update('device_name', e.target.value)} placeholder="MacBook, iPhone…" />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button className="w-full" type="submit" disabled={loading}>
          {loading ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthShell>
  );
}
