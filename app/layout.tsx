import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import { NotificationProvider } from '@/components/notification-provider'

export const metadata: Metadata = {
  title: 'MediaMTX Dashboard',
  description: 'Created by SIPVY Thân Thiện',
  generator: 'thanthienhai.github.io',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <style>{`
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
}
        `}</style>
      </head>
      <body>
        <NotificationProvider>{children}</NotificationProvider>
      </body>
    </html>
  )
}
