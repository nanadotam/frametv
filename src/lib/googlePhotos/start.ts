'use client';

import { toast } from '@/components/m/Toast';

/**
 * Starts a Google Photos import: Google sign-in opens in the real browser
 * (a new tab on the web; the default browser from the Mac app, where
 * Google blocks embedded sign-in), and this page moves to the importer,
 * which waits for it.
 */
export async function startGooglePhotos(navigate: (href: string) => void) {
  const res = await fetch('/api/google-photos/start?format=json');
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    toast.error(j.error ?? 'Google Photos isn’t available right now.');
    return;
  }
  window.open(j.url, '_blank', 'noopener');
  navigate(`/admin/google-photos?nonce=${j.nonce}`);
}
