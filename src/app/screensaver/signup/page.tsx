import { redirect } from 'next/navigation';

// The screensaver's sign-in panel links here; signup is one page now.
export default async function ScreensaverSignup({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  redirect(`/signup?next=${encodeURIComponent(next || '/screensaver/authorize')}`);
}
