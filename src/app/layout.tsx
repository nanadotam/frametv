import type { Metadata, Viewport } from 'next';
import { DM_Sans, Syne, JetBrains_Mono, Geist, Playfair_Display, Poppins } from 'next/font/google';
import { Providers } from '@/components/providers';
import './globals.css';
import { cn } from "@/lib/utils";
import { SITE_URL } from "@/lib/siteUrl";

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
  'Turn any TV, monitor or Mac into a living picture frame — your photo albums, ' +
  'video loops, clocks, scripture and Spotify, scheduled around your day.';

// Icons (favicon.ico, icon.svg, apple-icon.png) and social images
// (opengraph-image.jpg, twitter-image.jpg) are file conventions in src/app,
// generated from brand/ by brand/generate.sh.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'FrameTV — your screen, as a living picture frame',
    template: '%s · FrameTV',
  },
  description: DESCRIPTION,
  applicationName: 'FrameTV',
  keywords: [
    'digital picture frame',
    'ambient display',
    'TV photo slideshow',
    'Samsung Frame alternative',
    'Google Drive slideshow',
    'screensaver',
    'smart TV',
    'video loop',
  ],
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    siteName: 'FrameTV',
    title: 'FrameTV — your screen, as a living picture frame',
    description: DESCRIPTION,
    url: '/',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FrameTV — your screen, as a living picture frame',
    description: DESCRIPTION,
  },
  appleWebApp: {
    capable: true,
    title: 'FrameTV',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#0B0C0B',
  colorScheme: 'dark',
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
