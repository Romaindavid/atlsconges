'use server'

import { supabase } from '@/lib/supabase'

export type PointeBateauInput = {
  nom_bateau: string
  heures: number
}

export type FeuilleTempsFormData = {
  nom: string
  prenom: string
  date_journee: string
  heures_travaillees: number | null
  heures_a_recuperer: number
  pointes_bateaux: PointeBateauInput[]
}

export type ActionResult = {
  success: boolean
  message: string
  id?: string
}

export async function soumettreFeuilleTemps(data: FeuilleTempsFormData): Promise<ActionResult> {
  // Validation
  if (!data.nom?.trim() || !data.prenom?.trim()) {
    return { success: false, message: 'Nom et prénom sont obligatoires.' }
  }
  if (!data.date_journee) {
    return { success: false, message: 'La date est obligatoire.' }
  }

  // Insérer la feuille de temps
  const { data: feuille, error: feuilleError } = await supabase
    .from('feuilles_temps')
    .insert({
      nom: data.nom.trim(),
      prenom: data.prenom.trim(),
      date_journee: data.date_journee,
      heures_travaillees: data.heures_travaillees,
      heures_a_recuperer: data.heures_a_recuperer ?? 0,
    })
    .select('id')
    .single()

  if (feuilleError) {
    console.error('Erreur Supabase feuille:', feuilleError)
    return {
      success: false,
      message: 'Une erreur est survenue lors de l\'enregistrement. Veuillez réessayer.',
    }
  }

  // Insérer les pointés bateaux s'il y en a
  if (data.pointes_bateaux.length > 0) {
    const lignes = data.pointes_bateaux
      .filter((p) => p.nom_bateau.trim() && p.heures > 0)
      .map((p) => ({
        feuille_temps_id: feuille.id,
        nom_bateau: p.nom_bateau.trim(),
        heures: p.heures,
      }))

    if (lignes.length > 0) {
      const { error: bateauxError } = await supabase
        .from('pointes_bateaux')
        .insert(lignes)

      if (bateauxError) {
        console.error('Erreur Supabase bateaux:', bateauxError)
        // On ne retourne pas d'erreur ici car la feuille a été enregistrée
        // On pourrait améliorer en faisant un rollback
      }
    }
  }

  return {
    success: true,
    message: 'Votre feuille de temps a bien été enregistrée.',
    id: feuille.id,
  }
}
