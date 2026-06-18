import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Aina Cloud API',
  description: 'Self-hosted plant monitoring backend',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
