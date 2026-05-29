'use server'

import { getSupabase } from '@/lib/supabase'

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

  const { data, error } = await getSupabase()
    .from('feuilles_temps')
    .select('id, date_journee, heures_travaillees, heures_a_recuperer, commentaire, pointes_bateaux(id, nom_bateau, panier_repas)')
    .eq('nom', nom)
    .eq('prenom', prenom)
    .gte('date_journee', dateDebut)
    .lte('date_journee', dateFin)
    .order('date_journee', { ascending: true })

  if (error) {
    console.error('Erreur getFeuillesMois:', error)
    return []
  }
  return data as JourneeEntry[]
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

  const supabase = getSupabase()

  const { data: existing } = await supabase
    .from('feuilles_temps')
    .select('id')
    .eq('nom', data.nom.trim())
    .eq('prenom', data.prenom.trim())
    .eq('date_journee', data.date_journee)
    .single()

  let feuilleId: string

  if (existing) {
    feuilleId = existing.id
    const { error } = await supabase
      .from('feuilles_temps')
      .update({
        heures_travaillees: data.heures_travaillees,
        heures_a_recuperer: data.heures_a_recuperer,
        commentaire: data.commentaire || null,
      })
      .eq('id', feuilleId)

    if (error) {
      console.error('Erreur update feuille:', error)
      return { success: false, message: 'Erreur lors de la mise à jour.' }
    }
    await supabase.from('pointes_bateaux').delete().eq('feuille_temps_id', feuilleId)
  } else {
    const { data: newFeuille, error } = await supabase
      .from('feuilles_temps')
      .insert({
        nom: data.nom.trim(),
        prenom: data.prenom.trim(),
        date_journee: data.date_journee,
        heures_travaillees: data.heures_travaillees,
        heures_a_recuperer: data.heures_a_recuperer,
        commentaire: data.commentaire || null,
      })
      .select('id')
      .single()

    if (error || !newFeuille) {
      console.error('Erreur insert feuille:', error)
      return { success: false, message: 'Erreur lors de la création.' }
    }
    feuilleId = newFeuille.id
  }

  const pointes = data.pointes_bateaux.filter((p) => p.nom_bateau.trim())
  if (pointes.length > 0) {
    await supabase.from('pointes_bateaux').insert(
      pointes.map((p) => ({
        feuille_temps_id: feuilleId,
        nom_bateau: p.nom_bateau.trim(),
        heures: 1,
        panier_repas: p.panier_repas,
      }))
    )
  }

  return { success: true, message: 'Journée enregistrée.' }
}

/**
 * Solde de récupération total sur tout l'historique :
 *   solde_depart_recuperation (DB employes) + somme de tous les heures_a_recuperer
 */
export type JourFerieOverride = { date: string; actif: boolean }

export async function getJoursFeriesOverrides(annee: number): Promise<JourFerieOverride[]> {
  const { data } = await getSupabase()
    .from('jours_feries_override')
    .select('date, actif')
    .gte('date', `${annee}-01-01`)
    .lte('date', `${annee}-12-31`)
  return (data ?? []) as JourFerieOverride[]
}

export async function getSoldeRecupComplet(
  nom: string,
  prenom: string,
  employeId: string
): Promise<number> {
  const supabase = getSupabase()
  const [feuillesRes, empRes] = await Promise.all([
    supabase
      .from('feuilles_temps')
      .select('heures_a_recuperer')
      .eq('nom', nom)
      .eq('prenom', prenom),
    supabase
      .from('employes')
      .select('solde_depart_recuperation')
      .eq('id', employeId)
      .single(),
  ])
  const totalRecup = (feuillesRes.data ?? []).reduce(
    (s: number, e: { heures_a_recuperer: number }) => s + (e.heures_a_recuperer ?? 0), 0
  )
  const soldeDepart = (empRes.data as { solde_depart_recuperation?: number } | null)?.solde_depart_recuperation ?? 0
  return Number((soldeDepart + totalRecup).toFixed(2))
}
