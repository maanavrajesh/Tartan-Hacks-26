import type { Metadata } from 'next'
import { Space_Grotesk } from 'next/font/google'
import './globals.css'

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Soccer Film Intelligence',
  description: 'Turn soccer match film into tactical intelligence for coaches and analysts',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${spaceGrotesk.className} min-h-screen bg-bg-primary`}>
        <main className="min-h-screen">
          {children}
        </main>
      </body>
    </html>
  )
}
