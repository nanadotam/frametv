'use client';

import { FormEvent, Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import AuthShell, { PasswordField } from '@/components/auth/AuthShell';
import { Button, TextInput } from '@/components/m/Controls';
import { RecoveryKeyCard } from '@/components/m/RecoveryKeyCard';
import { toast } from '@/components/m/Toast';

function RecoverForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [key, setKey] = useState(params.get('key') ?? '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, recoveryKey: key, newPassword: password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Couldn’t reset your password.');
      setNewKey(json.recoveryKey);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t reset your password.');
    } finally {
      setLoading(false);
    }
  };

  if (newKey) {
    return (
      <AuthShell title="You’re back in" description="Your old recovery key has been used up. Here’s your new one. Save it like before.">
        <RecoveryKeyCard recoveryKey={newKey} email={email} />
        <Button block size="xl" onClick={() => (window.location.href = '/admin')}>Continue to Mantel</Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      description="Use the recovery key you saved when you made your account. It starts with MNTL."
      footer={<Link href="/login" className="font-semibold text-tint">Back to sign in</Link>}
    >
      <form onSubmit={submit} className="space-y-3">
        <TextInput type="email" placeholder="Email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <TextInput
          placeholder="MNTL-XXXX-XXXX-XXXX-XXXX-XXXX"
          value={key}
          onChange={(e) => setKey(e.target.value.toUpperCase())}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="font-mono text-[16px]"
          required
        />
        <PasswordField placeholder="New password (8+ characters)" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Button type="submit" block size="xl" loading={loading} disabled={!email || key.length < 20 || password.length < 8}>
          Reset password
        </Button>
      </form>
      <p className="px-2 pt-3 text-center text-[13px] leading-snug text-label-2">
        Lost your recovery key too? Ask the person who invited you to Mantel. They can help you start a fresh account.
      </p>
    </AuthShell>
  );
}

export default function RecoverPage() {
  return (
    <Suspense fallback={null}>
      <RecoverForm />
    </Suspense>
  );
}
