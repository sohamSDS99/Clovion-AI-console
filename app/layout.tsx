import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Clovion Console',
  description: 'Internal admin & monitoring panel — not for customers.',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
