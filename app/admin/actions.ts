'use server'

import { cookies } from 'next/headers'
import { getSupabase } from '@/lib/supabase'

const COOKIE_NAME = 'atls_admin_auth'
const COOKIE_MAX_AGE = 60 * 60 * 8 // 8 heures

// --- Auth ---

export async function loginAdmin(password: string): Promise<{ success: boolean; message: string }> {
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) {
    return { success: false, message: 'Configuration incorrecte. Contactez l\'administrateur.' }
  }

  if (password !== adminPassword) {
    return { success: false, message: 'Mot de passe incorrect.' }
  }

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, 'authenticated', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE,
    sameSite: 'lax',
    path: '/',
  })

  return { success: true, message: 'Connexion réussie.' }
}

export async function logoutAdmin(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get(COOKIE_NAME)?.value === 'authenticated'
}

// --- Absences ---

export type AbsenceAvecStatut = {
  id: string
  nom: string
  prenom: string
  type_absence: string
  type_absence_detail: string | null
  date_debut: string
  date_fin: string
  jours_ouvres: number
  commentaire_salarie: string | null
  date_demande: string
  statut: 'en_attente' | 'accorde' | 'refuse'
  commentaire_direction: string | null
  date_decision: string | null
}

export async function getAbsences(
  mois?: number,
  annee?: number,
  salarieSearch?: string
): Promise<AbsenceAvecStatut[]> {
  let query = getSupabase()
    .from('absences')
    .select('*')
    .order('date_demande', { ascending: false })

  if (annee && mois) {
    const dateDebutMois = `${annee}-${String(mois).padStart(2, '0')}-01`
    const dernierJour = new Date(annee, mois, 0).getDate()
    const dateFinMois = `${annee}-${String(mois).padStart(2, '0')}-${dernierJour}`
    query = query
      .gte('date_debut', dateDebutMois)
      .lte('date_debut', dateFinMois)
  }

  if (salarieSearch) {
    query = query.or(
      `nom.ilike.%${salarieSearch}%,prenom.ilike.%${salarieSearch}%`
    )
  }

  const { data, error } = await query
  if (error) {
    console.error('Erreur getAbsences:', error)
    return []
  }
  return data as AbsenceAvecStatut[]
}

export async function updateAbsenceStatut(
  id: string,
  statut: 'accorde' | 'refuse' | 'en_attente',
  commentaire_direction: string
): Promise<{ success: boolean; message: string }> {
  const { error } = await getSupabase()
    .from('absences')
    .update({
      statut,
      commentaire_direction: commentaire_direction.trim() || null,
      date_decision: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('Erreur updateAbsenceStatut:', error)
    return { success: false, message: 'Erreur lors de la mise à jour.' }
  }
  return { success: true, message: 'Statut mis à jour.' }
}

// --- Feuilles de temps ---

export type FeuilleTempsAvecBateaux = {
  id: string
  nom: string
  prenom: string
  date_journee: string
  heures_travaillees: number | null
  heures_a_recuperer: number
  created_at: string
  pointes_bateaux: {
    id: string
    nom_bateau: string
    heures: number
  }[]
}

export async function getFeuillesTemps(
  mois?: number,
  annee?: number,
  salarieSearch?: string
): Promise<FeuilleTempsAvecBateaux[]> {
  let query = getSupabase()
    .from('feuilles_temps')
    .select('*, pointes_bateaux(*)')
    .order('date_journee', { ascending: false })

  if (annee && mois) {
    const dateDebutMois = `${annee}-${String(mois).padStart(2, '0')}-01`
    const dernierJour = new Date(annee, mois, 0).getDate()
    const dateFinMois = `${annee}-${String(mois).padStart(2, '0')}-${dernierJour}`
    query = query
      .gte('date_journee', dateDebutMois)
      .lte('date_journee', dateFinMois)
  }

  if (salarieSearch) {
    query = query.or(
      `nom.ilike.%${salarieSearch}%,prenom.ilike.%${salarieSearch}%`
    )
  }

  const { data, error } = await query
  if (error) {
    console.error('Erreur getFeuillesTemps:', error)
    return []
  }
  return data as FeuilleTempsAvecBateaux[]
}
