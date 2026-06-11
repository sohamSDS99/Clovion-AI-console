import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'

const saans = localFont({
  src: './fonts/Saans-TRIAL-SemiBold.otf',
  variable: '--font-saans',
  weight: '600',
  style: 'normal',
  display: 'swap',
  preload: true,
})

export const metadata: Metadata = {
  title: 'Clovion Console',
  description: 'Internal admin & monitoring panel — not for customers.',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={saans.variable}>
      <body>{children}</body>
    </html>
  )
}
