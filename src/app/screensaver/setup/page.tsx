import { redirect } from 'next/navigation';

// Albums are added from Library after connecting; skip straight on.
export default async function ScreensaverSetup({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  redirect(next && next.startsWith('/') ? next : '/screensaver/authorize');
}
