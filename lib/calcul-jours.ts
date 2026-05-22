import { eachDayOfInterval, isWeekend, parseISO, isValid } from 'date-fns'

/**
 * Calcule le nombre de jours ouvrés entre deux dates (lundi-vendredi).
 * Les deux dates sont incluses dans le calcul.
 */
export function calculerJoursOuvres(dateDebut: string, dateFin: string): number {
  if (!dateDebut || !dateFin) return 0

  const start = parseISO(dateDebut)
  const end = parseISO(dateFin)

  if (!isValid(start) || !isValid(end)) return 0
  if (end < start) return 0

  const jours = eachDayOfInterval({ start, end })
  return jours.filter((jour) => !isWeekend(jour)).length
}

/**
 * Formate une date ISO en format français lisible.
 * Ex: "2024-03-15" → "15/03/2024"
 */
export function formatDateFR(dateISO: string): string {
  if (!dateISO) return ''
  const [annee, mois, jour] = dateISO.split('-')
  return `${jour}/${mois}/${annee}`
}

/**
 * Retourne la date du jour au format YYYY-MM-DD.
 */
export function dateAujourdhui(): string {
  return new Date().toISOString().split('T')[0]
}
