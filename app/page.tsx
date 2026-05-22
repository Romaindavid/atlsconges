import Link from 'next/link'
import Image from 'next/image'

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header marine avec logo */}
      <header className="bg-marine-800 py-8 px-4 text-center">
        <Image
          src="https://atlantiquesellerie.com/wp-content/uploads/2017/03/logo_horiz-white.png"
          alt="Atlantique Sellerie"
          width={280}
          height={70}
          className="h-16 w-auto mx-auto object-contain"
          unoptimized
          priority
        />
        <p className="text-marine-100 mt-3 text-lg">
          Gestion des congés et feuilles de temps
        </p>
      </header>

      {/* Contenu principal */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          <h2 className="text-marine-800 text-2xl font-bold text-center mb-2">
            Que souhaitez-vous faire ?
          </h2>
          <p className="text-marine-600 text-center mb-10 text-lg">
            Choisissez une action ci-dessous
          </p>

          {/* Deux gros boutons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Demande de congés */}
            <Link
              href="/absence"
              className="group flex flex-col items-center justify-center gap-4 bg-white rounded-2xl p-8 shadow-md border-2 border-transparent hover:border-orange-500 hover:shadow-xl transition-all duration-200 text-center"
            >
              <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center group-hover:bg-orange-500 transition-colors duration-200">
                <svg className="w-10 h-10 text-orange-500 group-hover:text-white transition-colors duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <span className="block text-xl font-bold text-marine-800 group-hover:text-orange-600 transition-colors">
                  Demande de congés
                </span>
                <span className="block text-marine-600 mt-1">
                  Poser des jours d&apos;absence
                </span>
              </div>
            </Link>

            {/* Feuille de temps */}
            <Link
              href="/temps"
              className="group flex flex-col items-center justify-center gap-4 bg-white rounded-2xl p-8 shadow-md border-2 border-transparent hover:border-orange-500 hover:shadow-xl transition-all duration-200 text-center"
            >
              <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center group-hover:bg-orange-500 transition-colors duration-200">
                <svg className="w-10 h-10 text-orange-500 group-hover:text-white transition-colors duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <span className="block text-xl font-bold text-marine-800 group-hover:text-orange-600 transition-colors">
                  Feuille de temps
                </span>
                <span className="block text-marine-600 mt-1">
                  Saisir vos heures du jour
                </span>
              </div>
            </Link>
          </div>

          {/* Lien admin discret */}
          <div className="mt-12 text-center">
            <Link
              href="/admin"
              className="text-marine-500 hover:text-marine-700 text-sm underline underline-offset-2"
            >
              Accès direction →
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-marine-900 text-marine-100 text-center py-4 text-sm">
        © {new Date().getFullYear()} Atlantique Sellerie — Usage interne
      </footer>
    </div>
  )
}
