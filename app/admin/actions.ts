'use server'

import { cookies } from 'next/headers'
import { getSql } from '@/lib/db'
import { getJoursFeriesAnnee, calculerJoursOuvres } from '@/lib/calcul-jours'

const COOKIE_NAME = 'atls_admin_auth'
const COOKIE_MAX_AGE = 60 * 60 * 8 // 8 heures

// Exécute une écriture et renvoie true/false au lieu de lever une exception
async function tenter(requete: Promise<unknown>): Promise<boolean> {
  try {
    await requete
    return true
  } catch (error) {
    console.error('Erreur base de données:', error)
    return false
  }
}

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

// Premier et dernier jour du mois, ou null si pas de filtre
function bornesMois(mois?: number, annee?: number): { debut: string | null; fin: string | null } {
  if (!annee || !mois) return { debut: null, fin: null }
  const mm = String(mois).padStart(2, '0')
  const dernierJour = new Date(annee, mois, 0).getDate()
  return { debut: `${annee}-${mm}-01`, fin: `${annee}-${mm}-${String(dernierJour).padStart(2, '0')}` }
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
  demi_journee?: 'matin' | 'apres_midi' | null
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
  const { debut, fin } = bornesMois(mois, annee)
  const recherche = salarieSearch ? `%${salarieSearch}%` : null
  try {
    const data = await getSql()`
      select * from absences
      where (${debut}::date is null or date_debut >= ${debut}::date)
        and (${fin}::date is null or date_debut <= ${fin}::date)
        and (${recherche}::text is null or nom ilike ${recherche} or prenom ilike ${recherche})
      order by date_demande desc`
    return data as AbsenceAvecStatut[]
  } catch (error) {
    console.error('Erreur getAbsences:', error)
    return []
  }
}

// Modifie les dates d'une demande (accordée ou non) en plus du statut —
// permet de rectifier une absence déjà validée si la situation change.
export async function updateAbsenceDatesEtStatut(
  id: string,
  date_debut: string,
  date_fin: string,
  statut: 'accorde' | 'refuse' | 'en_attente',
  commentaire_direction: string
): Promise<{ success: boolean; message: string }> {
  if (!date_debut || !date_fin) {
    return { success: false, message: 'Dates de début et fin obligatoires.' }
  }
  if (new Date(date_fin) < new Date(date_debut)) {
    return { success: false, message: 'La date de fin ne peut pas être avant la date de début.' }
  }

  const anneeDebut = Number(date_debut.slice(0, 4))
  const anneeFin = Number(date_fin.slice(0, 4))
  const sql = getSql()
  const overrides = await sql`
    select date, actif from jours_feries_override
    where date >= ${`${anneeDebut}-01-01`} and date <= ${`${anneeFin}-12-31`}`

  // Une demi-journée reste une demi-journée tant que l'absence tient sur un seul jour
  const [existante] = await sql`select demi_journee from absences where id = ${id}`
  const demi = (existante as { demi_journee?: string | null } | undefined)?.demi_journee ?? null
  const garderDemi = !!demi && date_debut === date_fin

  const jours_ouvres = garderDemi
    ? 0.5
    : calculerJoursOuvres(date_debut, date_fin, overrides as { date: string; actif: boolean }[])
  if (jours_ouvres <= 0) {
    return { success: false, message: 'Aucun jour ouvré dans cette période.' }
  }

  try {
    await sql`
      update absences set
        date_debut = ${date_debut},
        date_fin = ${date_fin},
        jours_ouvres = ${jours_ouvres},
        demi_journee = ${garderDemi ? demi : null},
        statut = ${statut},
        commentaire_direction = ${commentaire_direction.trim() || null},
        date_decision = now()
      where id = ${id}`
  } catch (error) {
    console.error('Erreur updateAbsenceDatesEtStatut:', error)
    return { success: false, message: 'Erreur lors de la mise à jour.' }
  }
  return { success: true, message: 'Demande mise à jour.' }
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
  const { debut, fin } = bornesMois(mois, annee)
  const recherche = salarieSearch ? `%${salarieSearch}%` : null
  try {
    const data = await getSql()`
      select f.*,
        coalesce(
          (select json_agg(p) from pointes_bateaux p where p.feuille_temps_id = f.id),
          '[]'::json
        ) as pointes_bateaux
      from feuilles_temps f
      where (${debut}::date is null or f.date_journee >= ${debut}::date)
        and (${fin}::date is null or f.date_journee <= ${fin}::date)
        and (${recherche}::text is null or f.nom ilike ${recherche} or f.prenom ilike ${recherche})
      order by f.date_journee desc`
    return data as FeuilleTempsAvecBateaux[]
  } catch (error) {
    console.error('Erreur getFeuillesTemps:', error)
    return []
  }
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
  date_entree?: string | null
  date_sortie?: string | null
}

export async function getEmployes(): Promise<Employe[]> {
  try {
    const data = await getSql()`select * from employes order by nom asc, prenom asc`
    return data as Employe[]
  } catch (error) {
    console.error('Erreur getEmployes:', error)
    return []
  }
}

export async function createEmploye(
  nom: string,
  prenom: string,
  options: { solde_depart_recuperation?: number; date_entree?: string | null; date_sortie?: string | null } = {}
): Promise<{ success: boolean; message: string }> {
  if (!nom.trim() || !prenom.trim()) {
    return { success: false, message: 'Nom et prénom sont obligatoires.' }
  }
  if (options.date_entree && options.date_sortie && options.date_sortie < options.date_entree) {
    return { success: false, message: "La date de départ ne peut pas être avant la date d'arrivée." }
  }
  const ok = await tenter(getSql()`
    insert into employes (nom, prenom, solde_depart_recuperation, date_entree, date_sortie)
    values (
      ${nom.trim().toUpperCase()}, ${prenom.trim()}, ${options.solde_depart_recuperation ?? 0},
      ${options.date_entree || null}, ${options.date_sortie || null}
    )`)
  if (!ok) return { success: false, message: 'Erreur lors de la création.' }
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
  const ok = await tenter(getSql()`
    update employes set nom = ${nom.trim().toUpperCase()}, prenom = ${prenom.trim()} where id = ${id}`)
  if (!ok) return { success: false, message: 'Erreur lors de la mise à jour.' }
  return { success: true, message: 'Employé modifié.' }
}

export async function updateSoldeDepart(
  id: string,
  solde: number
): Promise<{ success: boolean; message: string }> {
  const ok = await tenter(getSql()`update employes set solde_depart_recuperation = ${solde} where id = ${id}`)
  if (!ok) return { success: false, message: 'Erreur lors de la mise à jour.' }
  return { success: true, message: 'Solde de départ mis à jour.' }
}

export async function deleteEmploye(
  id: string
): Promise<{ success: boolean; message: string }> {
  const ok = await tenter(getSql()`delete from employes where id = ${id}`)
  if (!ok) return { success: false, message: 'Erreur lors de la suppression.' }
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

  type OverrideRow = { date: string; actif: boolean }
  let overrides: OverrideRow[] = []
  try {
    overrides = (await getSql()`
      select date, actif from jours_feries_override
      where date >= ${`${annee}-01-01`} and date <= ${`${annee}-12-31`}`) as OverrideRow[]
  } catch (error) {
    console.error('Erreur getJoursFeriesAvecOverrides:', error)
  }
  const ovMap = new Map(overrides.map(o => [o.date, o.actif]))

  const result: JourFerieEntry[] = standard.map(f => ({
    date:       f.date,
    nom:        f.nom,
    actif:      ovMap.has(f.date) ? ovMap.get(f.date)! : true,
    isOverride: ovMap.has(f.date),
  }))

  // Jours fériés exceptionnels ajoutés par l'admin (non-standard + actif=true)
  overrides.forEach(o => {
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
  const ok = await tenter(getSql()`
    insert into jours_feries_override (date, actif) values (${date}, ${actif})
    on conflict (date) do update set actif = excluded.actif`)
  return { success: ok }
}

// ─── Arrivée / départ ─────────────────────────────────────────────────────────

export async function setDatesEmploi(
  id: string,
  dateEntree: string | null,
  dateSortie: string | null
): Promise<{ success: boolean; message: string }> {
  if (dateEntree && dateSortie && dateSortie < dateEntree) {
    return { success: false, message: "La date de départ ne peut pas être avant la date d'arrivée." }
  }
  const ok = await tenter(getSql()`
    update employes set date_entree = ${dateEntree || null}, date_sortie = ${dateSortie || null} where id = ${id}`)
  if (!ok) return { success: false, message: "Erreur lors de l'enregistrement des dates d'arrivée/départ." }
  return { success: true, message: 'Dates enregistrées.' }
}

// ─── PIN employé ──────────────────────────────────────────────────────────────

export async function setPinEmploye(
  id: string,
  pin: string | null
): Promise<{ success: boolean }> {
  const ok = await tenter(getSql()`update employes set code_pin = ${pin || null} where id = ${id}`)
  return { success: ok }
}

// ─── Anniversaire employé ─────────────────────────────────────────────────────

export async function setAnniversaireEmploye(
  id: string,
  dateNaissance: string | null,
  jourPris: string | null
): Promise<{ success: boolean }> {
  const ok = await tenter(getSql()`
    update employes set
      date_naissance = ${dateNaissance || null},
      jour_anniversaire_pris = ${jourPris || null}
    where id = ${id}`)
  return { success: ok }
}

// ─── Vacances obligatoires ────────────────────────────────────────────────────

export type VacanceObligatoire = {
  id: string
  date_debut: string
  date_fin: string
  nom: string
}

export async function getVacancesObligatoires(annee: number): Promise<VacanceObligatoire[]> {
  try {
    return (await getSql()`
      select id, date_debut, date_fin, nom from vacances_obligatoires
      where date_fin >= ${`${annee}-01-01`} and date_debut <= ${`${annee}-12-31`}
      order by date_debut asc`) as VacanceObligatoire[]
  } catch (error) {
    console.error('Erreur getVacancesObligatoires:', error)
    return []
  }
}

export async function createVacanceObligatoire(
  dateDebut: string,
  dateFin: string,
  nom: string
): Promise<{ success: boolean; message: string }> {
  const ok = await tenter(getSql()`
    insert into vacances_obligatoires (date_debut, date_fin, nom)
    values (${dateDebut}, ${dateFin}, ${nom || 'Fermeture'})`)
  return { success: ok, message: ok ? 'Fermeture ajoutée.' : 'Erreur lors de la création.' }
}

export async function deleteVacanceObligatoire(
  id: string
): Promise<{ success: boolean }> {
  const ok = await tenter(getSql()`delete from vacances_obligatoires where id = ${id}`)
  return { success: ok }
}
