import type { Metadata, Viewport } from 'next';
import './globals.css';
import { GoogleAnalytics } from '../components/GoogleAnalytics';
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_ORIGIN || 'http://localhost:3000'),
  title: '토끼고스톱 · 마주 앉은 것처럼',
  description: '화투패 없이, 스마트폰 세 대로. 가족과 친구가 함께 즐기는 느긋한 고스톱.',
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    siteName: '토끼고스톱',
    title: '토끼고스톱 · 마주 앉은 것처럼',
    description: '화투패 없이, 스마트폰 세 대로. 가족과 친구가 함께 즐기는 느긋한 고스톱.',
    images: [
      {
        url: '/social/toki-gostop-3657d2dda547.jpg',
        width: 1200,
        height: 630,
        type: 'image/jpeg',
        alt: '토끼고스톱 · 마주 앉은 것처럼 — 화투패를 든 귀여운 동양화풍 토끼',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '토끼고스톱 · 마주 앉은 것처럼',
    description: '화투패 없이, 스마트폰 세 대로. 가족과 친구가 함께 즐기는 느긋한 고스톱.',
    images: ['/social/toki-gostop-3657d2dda547.jpg'],
  },
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon-192.png' },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: '토끼고스톱' },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#254d3e',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        {children}
        <GoogleAnalytics />
      </body>
    </html>
  );
}
