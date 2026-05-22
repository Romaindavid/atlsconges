'use server'

import { cookies } from 'next/headers'
import { getSupabase } from '@/lib/supabase'

const EMPLOYEE_AUTH_COOKIE = 'atls_employee_auth'
const EMPLOYEE_COOKIE = 'atls_employee'
const COOKIE_MAX_AGE = 60 * 60 * 12 // 12 heures

// --- Auth employé ---

export async function loginEmployee(password: string): Promise<{ success: boolean; message: string }> {
  const employeePassword = process.env.EMPLOYEE_PASSWORD
  if (!employeePassword) {
    return { success: false, message: 'Configuration incorrecte. Contactez l\'administrateur.' }
  }
  if (password !== employeePassword) {
    return { success: false, message: 'Mot de passe incorrect.' }
  }
  const cookieStore = await cookies()
  cookieStore.set(EMPLOYEE_AUTH_COOKIE, 'authenticated', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE,
    sameSite: 'lax',
    path: '/',
  })
  return { success: true, message: 'OK' }
}

export async function selectEmployee(
  id: string, nom: string, prenom: string
): Promise<{ success: boolean }> {
  const cookieStore = await cookies()
  cookieStore.set(EMPLOYEE_COOKIE, JSON.stringify({ id, nom, prenom }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE,
    sameSite: 'lax',
    path: '/',
  })
  return { success: true }
}

export async function changeEmployee(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(EMPLOYEE_COOKIE)
}

export async function logoutEmployee(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(EMPLOYEE_AUTH_COOKIE)
  cookieStore.delete(EMPLOYEE_COOKIE)
}

export type EmployeeSession = {
  id: string
  nom: string
  prenom: string
}

export async function getEmployeeSession(): Promise<EmployeeSession | null> {
  const cookieStore = await cookies()
  const auth = cookieStore.get(EMPLOYEE_AUTH_COOKIE)?.value
  if (auth !== 'authenticated') return null
  const raw = cookieStore.get(EMPLOYEE_COOKIE)?.value
  if (!raw) return null
  try {
    return JSON.parse(raw) as EmployeeSession
  } catch {
    return null
  }
}

export async function isEmployeeAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get(EMPLOYEE_AUTH_COOKIE)?.value === 'authenticated'
}

// --- Données employé ---

export type AbsenceEmploye = {
  id: string
  type_absence: string
  type_absence_detail: string | null
  date_debut: string
  date_fin: string
  jours_ouvres: number
  commentaire_salarie: string | null
  date_demande: string
  statut: 'en_attente' | 'accorde' | 'refuse'
  commentaire_direction: string | null
}

export async function getAbsencesEmployee(
  nom: string,
  prenom: string
): Promise<AbsenceEmploye[]> {
  const { data, error } = await getSupabase()
    .from('absences')
    .select('id, type_absence, type_absence_detail, date_debut, date_fin, jours_ouvres, commentaire_salarie, date_demande, statut, commentaire_direction')
    .eq('nom', nom)
    .eq('prenom', prenom)
    .order('date_demande', { ascending: false })
    .limit(20)

  if (error) {
    console.error('Erreur getAbsencesEmployee:', error)
    return []
  }
  return data as AbsenceEmploye[]
}
