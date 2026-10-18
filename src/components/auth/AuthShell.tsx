'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import BrandMark from '@/components/BrandMark';
import { Toaster } from '@/components/m/Toast';
import { useState } from 'react';
import { Eye, EyeSlash } from '@phosphor-icons/react';
import { TextInput } from '@/components/m/Controls';

/** Centered auth layout: app icon, big title, then the form. */
export default function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center bg-grouped px-5 pb-10 pt-[max(3rem,env(safe-area-inset-top))] text-label">
      <div className="w-full max-w-[400px]">
        <Link href="/" className="mx-auto mb-6 block w-fit" aria-label="Mantel home">
          <BrandMark size={72} className="rounded-[18px] shadow-[0_12px_30px_-10px_rgb(242_98_46/0.6)]" />
        </Link>
        <h1 className="text-center text-[30px] font-bold leading-tight tracking-[-0.02em]">{title}</h1>
        {description && <p className="mt-2 text-center text-[16px] leading-snug text-label-2">{description}</p>}
        <div className="mt-7 space-y-3">{children}</div>
        {footer && <div className="mt-6 text-center text-[15px] text-label-2">{footer}</div>}
      </div>
      <Toaster />
    </main>
  );
}

/** Password field with a show/hide button. */
export function PasswordField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <TextInput {...props} type={show ? 'text' : 'password'} className="pr-12" />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-label-2"
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <EyeSlash size={22} /> : <Eye size={22} />}
      </button>
    </div>
  );
}
