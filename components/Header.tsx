import Link from 'next/link'
import Image from 'next/image'

interface HeaderProps {
  titre?: string
}

export default function Header({ titre }: HeaderProps) {
  return (
    <header className="bg-marine-800 shadow-lg">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity flex-shrink-0">
          <Image
            src="/logo.png"
            alt="Atlantique Sellerie"
            width={44}
            height={44}
            className="rounded-lg"
          />
          {titre && (
            <h1 className="text-white text-lg font-semibold hidden sm:block">
              {titre}
            </h1>
          )}
        </Link>

        {/* Retour accueil */}
        <Link
          href="/"
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-2.5 rounded-xl transition-colors shadow-md text-sm"
        >
          ← Accueil
        </Link>
      </div>
    </header>
  )
}
