'use server'

import { getSql } from '@/lib/db'
import { envoyerEmail } from '@/lib/email'
import { formatDateFR, libelleDuree, DEMI_JOURNEES, demiJourneePossible } from '@/lib/calcul-jours'
import type { DemiJournee } from '@/lib/calcul-jours'

export type AbsenceFormData = {
  nom: string
  prenom: string
  type_absence: string
  type_absence_detail: string
  date_debut: string
  date_fin: string
  jours_ouvres: number
  demi_journee: DemiJournee | null
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
  if (data.demi_journee) {
    if (!(data.demi_journee in DEMI_JOURNEES)) {
      return { success: false, message: 'Demi-journée invalide.' }
    }
    if (data.date_debut !== data.date_fin) {
      return { success: false, message: 'Une demi-journée doit commencer et finir le même jour.' }
    }
    if (!demiJourneePossible(data.date_debut)) {
      return { success: false, message: 'Les demi-journées se posent du lundi au jeudi (le vendredi est une matinée).' }
    }
    data.jours_ouvres = 0.5
  }
  if (data.jours_ouvres <= 0) {
    return { success: false, message: 'Le nombre de jours ouvrés doit être supérieur à 0.' }
  }
  if (data.type_absence === 'Autre (précisez...)' && !data.type_absence_detail?.trim()) {
    return { success: false, message: 'Veuillez préciser le type d\'absence.' }
  }

  let inserted: { id: string } | undefined
  try {
    const rows = await getSql()`
      insert into absences (
        nom, prenom, type_absence, type_absence_detail, date_debut, date_fin,
        jours_ouvres, demi_journee, commentaire_salarie, statut
      ) values (
        ${data.nom.trim()}, ${data.prenom.trim()}, ${data.type_absence},
        ${data.type_absence_detail?.trim() || null}, ${data.date_debut}, ${data.date_fin},
        ${data.jours_ouvres}, ${data.demi_journee || null},
        ${data.commentaire_salarie?.trim() || null}, 'en_attente'
      )
      returning id`
    inserted = rows[0] as { id: string }
  } catch (error) {
    console.error('Erreur base de données:', error)
    return {
      success: false,
      message: 'Une erreur est survenue lors de l\'enregistrement. Veuillez réessayer.',
    }
  }

  // Best-effort : ne doit jamais faire échouer la demande du salarié.
  // Awaité pour garantir l'envoi avant la fin de la fonction serverless.
  const destinataire = process.env.ADMIN_NOTIFICATION_EMAIL || 'clairemarie@atlantiquesellerie.com'
  await envoyerEmail({
    to: destinataire,
    subject: `Nouvelle demande d'absence — ${data.prenom} ${data.nom}`,
    html: `
      <p><strong>${data.prenom} ${data.nom}</strong> vient de déposer une demande d'absence.</p>
      <ul>
        <li>Type : ${data.type_absence}${data.type_absence_detail ? ` — ${data.type_absence_detail}` : ''}</li>
        <li>Du ${formatDateFR(data.date_debut)} au ${formatDateFR(data.date_fin)}</li>
        <li>${libelleDuree(data.jours_ouvres, data.demi_journee)}</li>
        ${data.commentaire_salarie ? `<li>Commentaire : ${data.commentaire_salarie}</li>` : ''}
      </ul>
      <p><a href="${process.env.NEXT_PUBLIC_SITE_URL || ''}/admin">Traiter la demande</a></p>
    `,
  })

  return {
    success: true,
    message: `Votre demande a bien été enregistrée. Elle sera traitée par la direction.`,
    id: inserted?.id,
  }
}
