'use client';

import { FormEvent, Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import AuthShell, { PasswordField } from '@/components/auth/AuthShell';
import { Button, TextInput } from '@/components/m/Controls';
import { toast } from '@/components/m/Toast';
import { guessDeviceName } from '@/lib/deviceName';

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/admin';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, device_name: guessDeviceName() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Couldn’t sign you in.');
      window.location.href = next;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t sign you in.');
      setLoading(false);
    }
  };

  const signupHref = `/signup${next !== '/admin' ? `?next=${encodeURIComponent(next)}` : ''}`;

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to Mantel."
      footer={
        <>
          New to Mantel?{' '}
          <Link className="font-semibold text-tint" href={signupHref}>
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <TextInput type="email" placeholder="Email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        <PasswordField placeholder="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <div className="flex justify-end px-1">
          <Link href={`/recover${email ? `?email=${encodeURIComponent(email)}` : ''}`} className="text-[15px] font-medium text-tint">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" block size="xl" loading={loading}>Sign in</Button>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
