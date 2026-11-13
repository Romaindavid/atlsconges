'use server'

import { getSql } from '@/lib/db'
import { estJourAbsenceComplete } from '@/lib/calcul-jours'
import type { AbsencePourRecup } from '@/lib/calcul-jours'

export type PointeBateauInput = {
  nom_bateau: string
  panier_repas: boolean
}

export type JourneeData = {
  nom: string
  prenom: string
  date_journee: string
  heures_travaillees: number | null
  heures_a_recuperer: number
  commentaire: string | null
  pointes_bateaux: PointeBateauInput[]
}

export type JourneeEntry = {
  id: string
  date_journee: string
  heures_travaillees: number | null
  heures_a_recuperer: number
  commentaire: string | null
  pointes_bateaux: {
    id: string
    nom_bateau: string
    panier_repas: boolean
  }[]
}

export async function getFeuillesMois(
  nom: string,
  prenom: string,
  mois: number,
  annee: number
): Promise<JourneeEntry[]> {
  const dateDebut = `${annee}-${String(mois).padStart(2, '0')}-01`
  const dernierJour = new Date(annee, mois, 0).getDate()
  const dateFin = `${annee}-${String(mois).padStart(2, '0')}-${String(dernierJour).padStart(2, '0')}`

  try {
    const data = await getSql()`
      select f.id, f.date_journee, f.heures_travaillees, f.heures_a_recuperer, f.commentaire,
        coalesce(
          (select json_agg(json_build_object('id', p.id, 'nom_bateau', p.nom_bateau, 'panier_repas', p.panier_repas))
           from pointes_bateaux p where p.feuille_temps_id = f.id),
          '[]'::json
        ) as pointes_bateaux
      from feuilles_temps f
      where f.nom = ${nom} and f.prenom = ${prenom}
        and f.date_journee >= ${dateDebut} and f.date_journee <= ${dateFin}
      order by f.date_journee asc`
    return data as JourneeEntry[]
  } catch (error) {
    console.error('Erreur getFeuillesMois:', error)
    return []
  }
}

export async function sauvegarderJournee(
  data: JourneeData
): Promise<{ success: boolean; message: string }> {
  if (!data.nom?.trim() || !data.prenom?.trim()) {
    return { success: false, message: 'Nom et prénom sont obligatoires.' }
  }
  if (!data.date_journee) {
    return { success: false, message: 'La date est obligatoire.' }
  }

  const sql = getSql()
  const nom = data.nom.trim()
  const prenom = data.prenom.trim()
  const pointes = data.pointes_bateaux.filter((p) => p.nom_bateau.trim())

  try {
    const [existing] = await sql`
      select id from feuilles_temps
      where nom = ${nom} and prenom = ${prenom} and date_journee = ${data.date_journee}
      limit 1`

    let feuilleId: string
    if (existing) {
      feuilleId = existing.id as string
      // Mise à jour + remplacement des pointes en une seule transaction
      await sql.transaction([
        sql`
          update feuilles_temps set
            heures_travaillees = ${data.heures_travaillees},
            heures_a_recuperer = ${data.heures_a_recuperer},
            commentaire = ${data.commentaire || null}
          where id = ${feuilleId}`,
        sql`delete from pointes_bateaux where feuille_temps_id = ${feuilleId}`,
      ])
    } else {
      const [newFeuille] = await sql`
        insert into feuilles_temps (nom, prenom, date_journee, heures_travaillees, heures_a_recuperer, commentaire)
        values (${nom}, ${prenom}, ${data.date_journee}, ${data.heures_travaillees},
                ${data.heures_a_recuperer}, ${data.commentaire || null})
        returning id`
      feuilleId = newFeuille.id as string
    }

    if (pointes.length > 0) {
      await sql.transaction(
        pointes.map((p) => sql`
          insert into pointes_bateaux (feuille_temps_id, nom_bateau, heures, panier_repas)
          values (${feuilleId}, ${p.nom_bateau.trim()}, 1, ${p.panier_repas})`)
      )
    }
  } catch (error) {
    console.error('Erreur sauvegarderJournee:', error)
    return { success: false, message: 'Erreur lors de l\'enregistrement de la journée.' }
  }

  return { success: true, message: 'Journée enregistrée.' }
}

/**
 * Solde de récupération total sur tout l'historique :
 *   solde_depart_recuperation (DB employes) + somme de tous les heures_a_recuperer
 */
export type VacancePeriode = { date_debut: string; date_fin: string }

export async function getVacancesObligatoires(): Promise<VacancePeriode[]> {
  try {
    return (await getSql()`
      select date_debut, date_fin from vacances_obligatoires order by date_debut asc`) as VacancePeriode[]
  } catch (error) {
    console.error('Erreur getVacancesObligatoires:', error)
    return []
  }
}

export type JourFerieOverride = { date: string; actif: boolean }

export async function getJoursFeriesOverrides(annee: number): Promise<JourFerieOverride[]> {
  try {
    return (await getSql()`
      select date, actif from jours_feries_override
      where date >= ${`${annee}-01-01`} and date <= ${`${annee}-12-31`}`) as JourFerieOverride[]
  } catch (error) {
    console.error('Erreur getJoursFeriesOverrides:', error)
    return []
  }
}

export async function getSoldeRecupComplet(
  nom: string,
  prenom: string,
  employeId: string
): Promise<number> {
  const sql = getSql()
  const [feuilles, emp, absencesRows] = await Promise.all([
    sql`select date_journee, heures_a_recuperer from feuilles_temps where nom = ${nom} and prenom = ${prenom}`,
    sql`select solde_depart_recuperation from employes where id = ${employeId}`,
    sql`select * from absences where nom = ${nom} and prenom = ${prenom} and statut = 'accorde'`,
  ])
  const absences = absencesRows as AbsencePourRecup[]
  const totalRecup = (feuilles as { date_journee: string; heures_a_recuperer: number | null }[])
    .filter((e) => !estJourAbsenceComplete(absences, e.date_journee))
    .reduce((s, e) => s + (e.heures_a_recuperer ?? 0), 0)
  const soldeDepart = (emp[0] as { solde_depart_recuperation?: number | null } | undefined)?.solde_depart_recuperation ?? 0
  return Number((soldeDepart + totalRecup).toFixed(2))
}
