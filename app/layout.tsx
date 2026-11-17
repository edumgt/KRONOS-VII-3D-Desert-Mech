import type { Metadata } from 'next';
import { Chakra_Petch, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const chakraPetch = Chakra_Petch({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
});

const jakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'KRONOS-VII — 3D Desert Mech',
  description:
    'Interactive Three.js 3D scene of a massive weathered alien robot mech in a desert canyon with continuous 360-degree cinematic drone orbit.',
  openGraph: {
    title: 'KRONOS-VII — 3D Desert Mech',
    description:
      'Interactive Three.js 3D scene of a massive weathered alien robot mech in a desert canyon with continuous 360-degree cinematic drone orbit.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KRONOS-VII — 3D Desert Mech',
    description:
      'Interactive Three.js 3D scene of a massive weathered alien robot mech in a desert canyon with continuous 360-degree cinematic drone orbit.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${chakraPetch.variable} ${jakartaSans.variable} ${jetbrainsMono.variable}`}
    >
      <body
        className="bg-[#181411] text-stone-100 antialiased overflow-hidden select-none"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
