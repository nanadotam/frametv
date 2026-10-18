'use client';

import { FormEvent, Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Check } from '@phosphor-icons/react';
import AuthShell, { PasswordField } from '@/components/auth/AuthShell';
import { Button, TextInput } from '@/components/m/Controls';
import { RecoveryKeyCard } from '@/components/m/RecoveryKeyCard';
import { toast } from '@/components/m/Toast';
import { guessDeviceName } from '@/lib/deviceName';
import { cn } from '@/lib/utils';

/** Usernames aren't shown anywhere anymore, so derive one from the email. */
function usernameFrom(email: string) {
  const base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `${base.slice(0, 20) || 'user'}-${Math.random().toString(36).slice(2, 6)}`;
}

function SignupForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/welcome';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, username: usernameFrom(email), password, device_name: guessDeviceName() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Couldn’t create your account.');
      setRecoveryKey(json.recoveryKey);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t create your account.');
    } finally {
      setLoading(false);
    }
  };

  if (recoveryKey) {
    return (
      <AuthShell title="Save your recovery key" description="If you ever forget your password, this key gets you back in. There’s no email reset.">
        <RecoveryKeyCard recoveryKey={recoveryKey} email={email} />
        <button
          type="button"
          onClick={() => setSaved((s) => !s)}
          className="flex w-full items-center gap-3 rounded-[14px] bg-cell px-4 py-3.5 text-left text-[15px] shadow-cell"
        >
          <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2', saved ? 'border-tint bg-tint text-white' : 'border-label-3')}>
            {saved && <Check size={14} weight="bold" />}
          </span>
          I’ve saved my recovery key somewhere safe
        </button>
        <Button block size="xl" disabled={!saved} onClick={() => (window.location.href = next)}>
          Continue
        </Button>
      </AuthShell>
    );
  }

  const passwordOk = password.length >= 8;

  return (
    <AuthShell
      title="Create your account"
      description="Free, and takes a minute."
      footer={
        <>
          Already have an account?{' '}
          <Link className="font-semibold text-tint" href={`/login${searchParams.get('next') ? `?next=${encodeURIComponent(next)}` : ''}`}>
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <TextInput placeholder="Your name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        <TextInput type="email" placeholder="Email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <PasswordField placeholder="Password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <p className={cn('px-1 text-[13px]', password && !passwordOk ? 'text-bad' : 'text-label-2')}>
          At least 8 characters.
        </p>
        <Button type="submit" block size="xl" loading={loading} disabled={!name || !email || !passwordOk}>
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
