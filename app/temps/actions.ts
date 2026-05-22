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
  pointes_bateaux: PointeBateauInput[]
}

export type JourneeEntry = {
  id: string
  date_journee: string
  heures_travaillees: number | null
  heures_a_recuperer: number
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
    .select('id, date_journee, heures_travaillees, heures_a_recuperer, pointes_bateaux(id, nom_bateau, panier_repas)')
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

  // Chercher si une entrée existe déjà pour ce jour
  const { data: existing } = await supabase
    .from('feuilles_temps')
    .select('id')
    .eq('nom', data.nom.trim())
    .eq('prenom', data.prenom.trim())
    .eq('date_journee', data.date_journee)
    .single()

  let feuilleId: string

  if (existing) {
    // Mise à jour
    feuilleId = existing.id
    const { error } = await supabase
      .from('feuilles_temps')
      .update({
        heures_travaillees: data.heures_travaillees,
        heures_a_recuperer: data.heures_a_recuperer,
      })
      .eq('id', feuilleId)

    if (error) {
      console.error('Erreur update feuille:', error)
      return { success: false, message: 'Erreur lors de la mise à jour.' }
    }
    // Supprimer les anciennes pointes pour les recréer
    await supabase.from('pointes_bateaux').delete().eq('feuille_temps_id', feuilleId)
  } else {
    // Création
    const { data: newFeuille, error } = await supabase
      .from('feuilles_temps')
      .insert({
        nom: data.nom.trim(),
        prenom: data.prenom.trim(),
        date_journee: data.date_journee,
        heures_travaillees: data.heures_travaillees,
        heures_a_recuperer: data.heures_a_recuperer,
      })
      .select('id')
      .single()

    if (error || !newFeuille) {
      console.error('Erreur insert feuille:', error)
      return { success: false, message: 'Erreur lors de la création.' }
    }
    feuilleId = newFeuille.id
  }

  // Insérer les nouvelles pointes
  const pointes = data.pointes_bateaux.filter((p) => p.nom_bateau.trim())
  if (pointes.length > 0) {
    await supabase.from('pointes_bateaux').insert(
      pointes.map((p) => ({
        feuille_temps_id: feuilleId,
        nom_bateau: p.nom_bateau.trim(),
        heures: 1, // conservé pour la compatibilité schéma
        panier_repas: p.panier_repas,
      }))
    )
  }

  return { success: true, message: 'Journée enregistrée.' }
}
