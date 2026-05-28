'use server'

import { cookies } from 'next/headers'
import { getSupabase } from '@/lib/supabase'
import { getJoursFeriesAnnee } from '@/lib/calcul-jours'

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
  commentaire: string | null
  created_at: string
  pointes_bateaux: {
    id: string
    nom_bateau: string
    heures: number
    panier_repas: boolean
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

// --- Employés ---

export type Employe = {
  id: string
  nom: string
  prenom: string
  actif: boolean
  created_at: string
  solde_depart_recuperation: number
  code_pin: string | null
  date_naissance: string | null
  jour_anniversaire_pris: string | null
}

export async function getEmployes(): Promise<Employe[]> {
  const { data, error } = await getSupabase()
    .from('employes')
    .select('*')
    .order('nom', { ascending: true })
    .order('prenom', { ascending: true })

  if (error) {
    console.error('Erreur getEmployes:', error)
    return []
  }
  return data as Employe[]
}

export async function createEmploye(
  nom: string,
  prenom: string
): Promise<{ success: boolean; message: string }> {
  if (!nom.trim() || !prenom.trim()) {
    return { success: false, message: 'Nom et prénom sont obligatoires.' }
  }
  const { error } = await getSupabase()
    .from('employes')
    .insert({ nom: nom.trim().toUpperCase(), prenom: prenom.trim() })

  if (error) return { success: false, message: 'Erreur lors de la création.' }
  return { success: true, message: 'Employé ajouté.' }
}

export async function updateEmploye(
  id: string,
  nom: string,
  prenom: string
): Promise<{ success: boolean; message: string }> {
  if (!nom.trim() || !prenom.trim()) {
    return { success: false, message: 'Nom et prénom sont obligatoires.' }
  }
  const { error } = await getSupabase()
    .from('employes')
    .update({ nom: nom.trim().toUpperCase(), prenom: prenom.trim() })
    .eq('id', id)

  if (error) return { success: false, message: 'Erreur lors de la mise à jour.' }
  return { success: true, message: 'Employé modifié.' }
}

export async function updateSoldeDepart(
  id: string,
  solde: number
): Promise<{ success: boolean; message: string }> {
  const { error } = await getSupabase()
    .from('employes')
    .update({ solde_depart_recuperation: solde })
    .eq('id', id)
  if (error) return { success: false, message: 'Erreur lors de la mise à jour.' }
  return { success: true, message: 'Solde de départ mis à jour.' }
}

export async function deleteEmploye(
  id: string
): Promise<{ success: boolean; message: string }> {
  const { error } = await getSupabase()
    .from('employes')
    .delete()
    .eq('id', id)

  if (error) return { success: false, message: 'Erreur lors de la suppression.' }
  return { success: true, message: 'Employé supprimé.' }
}

// ─── Jours Fériés ─────────────────────────────────────────────────────────────

export type JourFerieEntry = {
  date: string
  nom: string
  actif: boolean      // true = férié effectif, false = ouvré (override admin)
  isOverride: boolean // true = modifié par l'admin par rapport au standard
}

export async function getJoursFeriesAvecOverrides(annee: number): Promise<JourFerieEntry[]> {
  const standard = getJoursFeriesAnnee(annee)

  const { data: overrides } = await getSupabase()
    .from('jours_feries_override')
    .select('date, actif')
    .gte('date', `${annee}-01-01`)
    .lte('date', `${annee}-12-31`)

  type OverrideRow = { date: string; actif: boolean }
  const ovMap = new Map((overrides as OverrideRow[] ?? []).map(o => [o.date, o.actif]))

  const result: JourFerieEntry[] = standard.map(f => ({
    date:       f.date,
    nom:        f.nom,
    actif:      ovMap.has(f.date) ? ovMap.get(f.date)! : true,
    isOverride: ovMap.has(f.date),
  }))

  // Jours fériés exceptionnels ajoutés par l'admin (non-standard + actif=true)
  ;(overrides as OverrideRow[] ?? []).forEach(o => {
    if (o.actif && !standard.some(s => s.date === o.date)) {
      result.push({ date: o.date, nom: 'Jour férié exceptionnel', actif: true, isOverride: true })
    }
  })

  return result.sort((a, b) => a.date.localeCompare(b.date))
}

export async function setJourFerieOverride(
  date: string,
  actif: boolean
): Promise<{ success: boolean }> {
  const { error } = await getSupabase()
    .from('jours_feries_override')
    .upsert({ date, actif }, { onConflict: 'date' })
  return { success: !error }
}

// ─── PIN employé ──────────────────────────────────────────────────────────────

export async function setPinEmploye(
  id: string,
  pin: string | null
): Promise<{ success: boolean }> {
  const { error } = await getSupabase()
    .from('employes')
    .update({ code_pin: pin || null })
    .eq('id', id)
  return { success: !error }
}

// ─── Anniversaire employé ─────────────────────────────────────────────────────

export async function setAnniversaireEmploye(
  id: string,
  dateNaissance: string | null,
  jourPris: string | null
): Promise<{ success: boolean }> {
  const { error } = await getSupabase()
    .from('employes')
    .update({
      date_naissance: dateNaissance || null,
      jour_anniversaire_pris: jourPris || null,
    })
    .eq('id', id)
  return { success: !error }
}

// ─── Vacances obligatoires ────────────────────────────────────────────────────

export type VacanceObligatoire = {
  id: string
  date_debut: string
  date_fin: string
  nom: string
}

export async function getVacancesObligatoires(annee: number): Promise<VacanceObligatoire[]> {
  const { data } = await getSupabase()
    .from('vacances_obligatoires')
    .select('id, date_debut, date_fin, nom')
    .gte('date_fin', `${annee}-01-01`)
    .lte('date_debut', `${annee}-12-31`)
    .order('date_debut', { ascending: true })
  return (data ?? []) as VacanceObligatoire[]
}

export async function createVacanceObligatoire(
  dateDebut: string,
  dateFin: string,
  nom: string
): Promise<{ success: boolean; message: string }> {
  const { error } = await getSupabase()
    .from('vacances_obligatoires')
    .insert({ date_debut: dateDebut, date_fin: dateFin, nom: nom || 'Fermeture' })
  return { success: !error, message: error ? 'Erreur lors de la création.' : 'Fermeture ajoutée.' }
}

export async function deleteVacanceObligatoire(
  id: string
): Promise<{ success: boolean }> {
  const { error } = await getSupabase()
    .from('vacances_obligatoires')
    .delete()
    .eq('id', id)
  return { success: !error }
}
