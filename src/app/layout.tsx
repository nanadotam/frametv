import type { Metadata } from 'next';
import { DM_Sans, Syne, JetBrains_Mono, Geist, Playfair_Display, Poppins } from 'next/font/google';
import { Providers } from '@/components/providers';
import './globals.css';
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ['latin'], variable: '--font-sans', preload: false });

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  display: 'swap',
});

const syne = Syne({
  variable: '--font-syne',
  subsets: ['latin'],
  display: 'swap',
  preload: false,
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  display: 'swap',
  preload: false,
});

const playfair = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
  display: 'swap',
  style: ['normal', 'italic'],
  preload: false,
});

const poppins = Poppins({
  variable: '--font-poppins',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '600', '700', '800'],
  preload: false,
});

export const metadata: Metadata = {
  title: 'FrameTV',
  description: 'Your personal ambient display OS',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
    shortcut: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", "dark", dmSans.variable, syne.variable, jetbrainsMono.variable, playfair.variable, poppins.variable, "font-sans", geist.variable)}
    >
      <body className="min-h-full bg-bg text-fg font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
