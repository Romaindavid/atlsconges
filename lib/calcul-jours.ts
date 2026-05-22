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
