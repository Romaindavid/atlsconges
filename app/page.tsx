import { isEmployeeAuthenticated, getEmployeeSession, getAbsencesEmployee } from './actions'
import { getFeuillesMois } from './temps/actions'
import { getEmployes } from './admin/actions'
import EmployeePasswordForm from '@/components/EmployeePasswordForm'
import EmployeeNameSelect from '@/components/EmployeeNameSelect'
import EmployeeDashboard from '@/components/EmployeeDashboard'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  // Étape 1 : pas de mot de passe → formulaire de connexion
  const isAuth = await isEmployeeAuthenticated()
  if (!isAuth) {
    return <EmployeePasswordForm />
  }

  // Étape 2 : mot de passe ok mais pas de nom sélectionné → sélection
  const employee = await getEmployeeSession()
  if (!employee) {
    const employes = await getEmployes()
    return <EmployeeNameSelect employes={employes} />
  }

  // Étape 3 : tout ok → dashboard + feuille de temps du mois
  const now = new Date()
  const mois  = now.getMonth() + 1
  const annee = now.getFullYear()

  const [absences, entries] = await Promise.all([
    getAbsencesEmployee(employee.nom, employee.prenom),
    getFeuillesMois(employee.nom, employee.prenom, mois, annee),
  ])

  return (
    <EmployeeDashboard
      employee={employee}
      absences={absences}
      entriesInitiales={entries}
      moisInitial={mois}
      anneeInitiale={annee}
    />
  )
}
