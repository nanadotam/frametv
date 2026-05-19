import type { Metadata } from 'next';
import { DM_Sans, Syne, JetBrains_Mono, Geist } from 'next/font/google';
import { Providers } from '@/components/providers';
import './globals.css';
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  display: 'swap',
});

const syne = Syne({
  variable: '--font-syne',
  subsets: ['latin'],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'FrameTV',
  description: 'Your personal ambient display OS',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", "dark", dmSans.variable, syne.variable, jetbrainsMono.variable, "font-sans", geist.variable)}
    >
      <body className="min-h-full bg-bg text-fg font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
