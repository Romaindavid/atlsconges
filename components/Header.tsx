import Link from 'next/link'
import Image from 'next/image'

interface HeaderProps {
  titre?: string
}

export default function Header({ titre }: HeaderProps) {
  return (
    <header className="bg-marine-800 shadow-lg">
      <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <Image
            src="https://atlantiquesellerie.com/wp-content/uploads/2017/03/logo_horiz-white.png"
            alt="Atlantique Sellerie"
            width={200}
            height={50}
            className="h-10 w-auto object-contain"
            unoptimized
          />
        </Link>

        {/* Titre de page optionnel */}
        {titre && (
          <h1 className="text-white text-lg font-semibold hidden sm:block">
            {titre}
          </h1>
        )}

        {/* Retour accueil */}
        <Link
          href="/"
          className="text-marine-100 hover:text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-marine-700 transition-colors"
        >
          ← Accueil
        </Link>
      </div>
    </header>
  )
}
