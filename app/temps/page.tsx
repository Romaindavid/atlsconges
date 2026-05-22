import Header from '@/components/Header'
import FormTemps from '@/components/FormTemps'
import { getEmployes } from '@/app/admin/actions'

export const metadata = {
  title: 'Feuille de temps — Atlantique Sellerie',
}

export default async function TempsPage() {
  const employes = await getEmployes()

  return (
    <div className="min-h-screen flex flex-col">
      <Header titre="Feuille de temps" />

      <main className="flex-1 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8 text-center">
            <h1 className="text-marine-800 text-3xl font-bold">
              ⏱️ Feuille de temps
            </h1>
            <p className="text-marine-600 mt-2 text-lg">
              Saisissez vos heures de travail pour la journée
            </p>
          </div>

          <FormTemps employes={employes} />
        </div>
      </main>

      <footer className="bg-marine-900 text-marine-100 text-center py-4 text-sm mt-8">
        © {new Date().getFullYear()} Atlantique Sellerie — Usage interne
      </footer>
    </div>
  )
}
