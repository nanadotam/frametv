import type { Metadata, Viewport } from 'next';
import { DM_Sans, Syne, JetBrains_Mono, Geist, Playfair_Display, Poppins } from 'next/font/google';
import { Providers } from '@/components/providers';
import './globals.css';
import { cn } from "@/lib/utils";
import { SITE_URL } from "@/lib/siteUrl";
import { THEME_SCRIPT } from "@/lib/theme";

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

const DESCRIPTION =
  'Mantel turns your Mac screensaver, TV or any spare screen into a living ' +
  'picture frame — your photos, video loops, clocks and music, on display.';

// Icons (favicon.ico, icon.svg, apple-icon.png) and social images
// (opengraph-image.jpg, twitter-image.jpg) are file conventions in src/app,
// generated from brand/ by brand/generate.sh.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Mantel — your memories, on display',
    template: '%s · Mantel',
  },
  description: DESCRIPTION,
  applicationName: 'Mantel',
  keywords: [
    'digital picture frame',
    'ambient display',
    'TV photo slideshow',
    'Mac screensaver',
    'Google Drive slideshow',
    'screensaver',
    'smart TV',
    'video loop',
  ],
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    siteName: 'Mantel',
    title: 'Mantel — your memories, on display',
    description: DESCRIPTION,
    url: '/',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mantel — your memories, on display',
    description: DESCRIPTION,
  },
  appleWebApp: {
    capable: true,
    title: 'Mantel',
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f2f2f7' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
  colorScheme: 'light dark',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("h-full", "antialiased", dmSans.variable, syne.variable, jetbrainsMono.variable, playfair.variable, poppins.variable, "font-sans", geist.variable)}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full bg-grouped text-label font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
