import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// La feuille de temps est maintenant intégrée directement sur la page d'accueil.
export default async function TempsPage() {
  redirect('/')
}
