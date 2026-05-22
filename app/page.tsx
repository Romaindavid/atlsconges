import { isEmployeeAuthenticated, getEmployeeSession, getAbsencesEmployee } from './actions'
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

  // Étape 3 : tout ok → dashboard personnel
  const absences = await getAbsencesEmployee(employee.nom, employee.prenom)
  return <EmployeeDashboard employee={employee} absences={absences} />
}
