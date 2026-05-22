'use server'

import { supabase } from '@/lib/supabase'

export type AbsenceFormData = {
  nom: string
  prenom: string
  type_absence: string
  type_absence_detail: string
  date_debut: string
  date_fin: string
  jours_ouvres: number
  commentaire_salarie: string
}

export type ActionResult = {
  success: boolean
  message: string
  id?: string
}

export async function soumettreAbsence(data: AbsenceFormData): Promise<ActionResult> {
  // Validation basique
  if (!data.nom?.trim() || !data.prenom?.trim()) {
    return { success: false, message: 'Nom et prénom sont obligatoires.' }
  }
  if (!data.date_debut || !data.date_fin) {
    return { success: false, message: 'Dates de début et fin sont obligatoires.' }
  }
  if (new Date(data.date_fin) < new Date(data.date_debut)) {
    return { success: false, message: 'La date de fin ne peut pas être avant la date de début.' }
  }
  if (data.jours_ouvres <= 0) {
    return { success: false, message: 'Le nombre de jours ouvrés doit être supérieur à 0.' }
  }
  if (data.type_absence === 'Autre (précisez...)' && !data.type_absence_detail?.trim()) {
    return { success: false, message: 'Veuillez préciser le type d\'absence.' }
  }

  const { data: inserted, error } = await supabase
    .from('absences')
    .insert({
      nom: data.nom.trim(),
      prenom: data.prenom.trim(),
      type_absence: data.type_absence,
      type_absence_detail: data.type_absence_detail?.trim() || null,
      date_debut: data.date_debut,
      date_fin: data.date_fin,
      jours_ouvres: data.jours_ouvres,
      commentaire_salarie: data.commentaire_salarie?.trim() || null,
      statut: 'en_attente',
    })
    .select('id')
    .single()

  if (error) {
    console.error('Erreur Supabase:', error)
    return {
      success: false,
      message: 'Une erreur est survenue lors de l\'enregistrement. Veuillez réessayer.',
    }
  }

  return {
    success: true,
    message: `Votre demande a bien été enregistrée. Elle sera traitée par la direction.`,
    id: inserted?.id,
  }
}
