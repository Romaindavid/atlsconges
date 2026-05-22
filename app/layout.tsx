import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Atlantique Sellerie — Gestion RH',
  description: 'Demandes de congés et feuilles de temps — Atlantique Sellerie',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
