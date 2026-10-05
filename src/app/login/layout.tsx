import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Log in',
  description: 'Log in to manage your FrameTV albums, modes and schedules.',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
