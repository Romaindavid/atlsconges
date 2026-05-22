import { redirect } from 'next/navigation'
import { getEmployeeSession } from '@/app/actions'
import { getFeuillesMois } from '@/app/temps/actions'
import FeuilleTemps from '@/components/FeuilleTemps'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Feuille de temps — Atlantique Sellerie',
}

export default async function TempsPage() {
  const employee = await getEmployeeSession()
  if (!employee) redirect('/')

  const now = new Date()
  const mois = now.getMonth() + 1
  const annee = now.getFullYear()

  const entries = await getFeuillesMois(employee.nom, employee.prenom, mois, annee)

  return (
    <FeuilleTemps
      employe={employee}
      entriesInitiales={entries}
      moisInitial={mois}
      anneeInitiale={annee}
    />
  )
}
