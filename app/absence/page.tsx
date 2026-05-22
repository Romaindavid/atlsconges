import Header from '@/components/Header'
import FormAbsence from '@/components/FormAbsence'
import { getEmployes } from '@/app/admin/actions'

export const metadata = {
  title: 'Demande d\'absence — Atlantique Sellerie',
}

export default async function AbsencePage() {
  const employes = await getEmployes()

  return (
    <div className="min-h-screen flex flex-col">
      <Header titre="Demande d'absence" />

      <main className="flex-1 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8 text-center">
            <h1 className="text-marine-800 text-3xl font-bold">
              📅 Demande d&apos;absence
            </h1>
            <p className="text-marine-600 mt-2 text-lg">
              Remplissez ce formulaire pour soumettre votre demande à la direction
            </p>
          </div>

          <FormAbsence employes={employes} />
        </div>
      </main>

      <footer className="bg-marine-900 text-marine-100 text-center py-4 text-sm mt-8">
        © {new Date().getFullYear()} Atlantique Sellerie — Usage interne
      </footer>
    </div>
  )
}
