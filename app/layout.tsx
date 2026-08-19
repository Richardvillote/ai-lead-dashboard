import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI Lead Dashboard',
  description: 'Lead generation and management dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
