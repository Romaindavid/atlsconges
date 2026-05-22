import { isAdminAuthenticated, getAbsences, getFeuillesTemps } from './actions'
import AdminDashboard from '@/components/AdminDashboard'
import AdminLogin from '@/components/AdminLogin'

// Toujours rendu côté serveur à la demande (cookies, données temps réel)
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Interface Direction — Atlantique Sellerie',
}

type SearchParams = Promise<{
  mois?: string
  annee?: string
  q?: string
}>

export default async function AdminPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const authenticated = await isAdminAuthenticated()

  if (!authenticated) {
    return <AdminLogin />
  }

  const now = new Date()
  const mois = parseInt(params.mois ?? String(now.getMonth() + 1))
  const annee = parseInt(params.annee ?? String(now.getFullYear()))
  const q = params.q ?? ''

  const [absences, feuillesTemps] = await Promise.all([
    getAbsences(mois, annee, q),
    getFeuillesTemps(mois, annee, q),
  ])

  return (
    <AdminDashboard
      absences={absences}
      feuillesTemps={feuillesTemps}
      moisSelectionne={mois}
      anneeSelectionnee={annee}
      salarieSearch={q}
    />
  )
}
