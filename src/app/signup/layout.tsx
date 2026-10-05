import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign up',
  description: 'Set up FrameTV in a minute and turn any screen into a living picture frame.',
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
