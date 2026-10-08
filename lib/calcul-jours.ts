import { eachDayOfInterval, isWeekend, parseISO, isValid } from 'date-fns'

// ─── Algorithme de Pâques (Meeus / Jones / Butcher) ──────────────────────────
export function getEaster(y: number): Date {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100
  const d = Math.floor(b / 4), e = b % 4
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const ii = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * ii - h - k) % 7
  const mm = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * mm + 114) / 31)
  const day   = ((h + l - 7 * mm + 114) % 31) + 1
  return new Date(y, month - 1, day)
}

const FERIES_FIXES = [
  { mois: 1,  jour: 1,  nom: "Jour de l'An"      },
  { mois: 5,  jour: 1,  nom: "Fête du Travail"    },
  { mois: 5,  jour: 8,  nom: "Victoire 1945"       },
  { mois: 7,  jour: 14, nom: "Fête Nationale"      },
  { mois: 8,  jour: 15, nom: "Assomption"          },
  { mois: 11, jour: 1,  nom: "Toussaint"           },
  { mois: 11, jour: 11, nom: "Armistice"           },
  { mois: 12, jour: 25, nom: "Noël"                },
]

/** Retourne tous les jours fériés français standards pour une année */
export function getJoursFeriesAnnee(annee: number): { date: string; nom: string }[] {
  const pad = (n: number) => String(n).padStart(2, '0')
  const result: { date: string; nom: string }[] = []

  FERIES_FIXES.forEach(f =>
    result.push({ date: `${annee}-${pad(f.mois)}-${pad(f.jour)}`, nom: f.nom })
  )

  const easter = getEaster(annee)
  const addRel = (offset: number, nom: string) => {
    const d = new Date(easter.getTime() + offset * 86400000)
    result.push({
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      nom,
    })
  }
  addRel(1,  'Lundi de Pâques')
  addRel(39, 'Ascension')
  addRel(50, 'Lundi de Pentecôte')

  return result.sort((a, b) => a.date.localeCompare(b.date))
}

/** Vérifie si une date est un jour férié français (algorithme standard) */
export function isJourFerie(date: Date): boolean {
  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  return getJoursFeriesAnnee(date.getFullYear()).some(f => f.date === iso)
}

/**
 * Calcule le nombre de jours ouvrés entre deux dates (lun–ven, hors jours fériés).
 * Les deux dates sont incluses.
 *
 * @param joursFeresOverrides  Overrides admin : actif=true → traité comme férié, false → traité comme ouvré
 */
export function calculerJoursOuvres(
  dateDebut: string,
  dateFin: string,
  joursFeresOverrides?: { date: string; actif: boolean }[]
): number {
  if (!dateDebut || !dateFin) return 0
  const start = parseISO(dateDebut)
  const end   = parseISO(dateFin)
  if (!isValid(start) || !isValid(end) || end < start) return 0

  const pad   = (n: number) => String(n).padStart(2, '0')
  const toISO = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  return eachDayOfInterval({ start, end }).filter(jour => {
    if (isWeekend(jour)) return false
    const iso = toISO(jour)
    if (joursFeresOverrides) {
      const ov = joursFeresOverrides.find(o => o.date === iso)
      if (ov !== undefined) return !ov.actif  // actif=true→férié→exclure
    }
    return !isJourFerie(jour)
  }).length
}

/** Formate une date ISO en format français : "2024-03-15" → "15/03/2024" */
export function formatDateFR(dateISO: string): string {
  if (!dateISO) return ''
  const [annee, mois, jour] = dateISO.split('-')
  return `${jour}/${mois}/${annee}`
}

/** Retourne la date du jour au format YYYY-MM-DD */
export function dateAujourdhui(): string {
  return new Date().toISOString().split('T')[0]
}

// ─── Demi-journées ────────────────────────────────────────────────────────────
// Horaires ATLS : lundi → jeudi matin 8h–12h (4h), après-midi 12h45–16h15 (3,5h)
// Le vendredi (7h30–12h30) ne compte qu'une matinée : pas de demi-journée possible.
export type DemiJournee = 'matin' | 'apres_midi'

export const DEMI_JOURNEES: Record<DemiJournee, { label: string; heures: number }> = {
  matin:      { label: 'Matin (8h – 12h)',            heures: 4   },
  apres_midi: { label: 'Après-midi (12h45 – 16h15)',  heures: 3.5 },
}

/** Demi-journée posable ce jour-là ? (lundi → jeudi uniquement) */
export function demiJourneePossible(dateISO: string): boolean {
  const dow = parseISO(dateISO).getDay()
  return dow >= 1 && dow <= 4
}

/** "½ journée (matin)" ou "3 jours ouvrés" */
export function libelleDuree(joursOuvres: number, demiJournee?: string | null): string {
  if (demiJournee === 'matin') return '½ journée (matin)'
  if (demiJournee === 'apres_midi') return '½ journée (après-midi)'
  return `${joursOuvres} jour${joursOuvres > 1 ? 's' : ''} ouvré${joursOuvres > 1 ? 's' : ''}`
}

// ─── Absences et compteur de récupération ────────────────────────────────────
/**
 * Un jour couvert par une absence accordée en journée entière (congés, maladie, autre…)
 * n'a aucun impact sur le compteur de récupération, même si une saisie existe ce jour-là
 * (ex : « j'ai travaillé moins » saisi avant que l'absence soit validée).
 */
export type AbsencePourRecup = { date_debut: string; date_fin: string; demi_journee?: string | null }

export function estJourAbsenceComplete(absences: AbsencePourRecup[], iso: string): boolean {
  return absences.some(a => !a.demi_journee && a.date_debut <= iso && a.date_fin >= iso)
}

// ─── Arrivées / départs ───────────────────────────────────────────────────────
export type PeriodeEmploi = { date_entree?: string | null; date_sortie?: string | null }

/** Le salarié fait-il partie de l'équipe sur au moins un jour de [debut, fin] ? (dates ISO) */
export function presentSurPeriode(emp: PeriodeEmploi, debut: string, fin: string): boolean {
  return (!emp.date_entree || emp.date_entree <= fin) && (!emp.date_sortie || emp.date_sortie >= debut)
}

/** Bornes ISO d'un mois : ['2026-10-01', '2026-10-31'] */
export function bornesMois(mois: number, annee: number): [string, string] {
  const m = String(mois).padStart(2, '0')
  return [`${annee}-${m}-01`, `${annee}-${m}-${String(new Date(annee, mois, 0).getDate()).padStart(2, '0')}`]
}
