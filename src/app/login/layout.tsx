import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Log in',
  description: 'Log in to manage your Mantel albums, looks and schedules.',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
