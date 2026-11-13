import { neon, types, type NeonQueryFunction } from '@neondatabase/serverless'

// Postgres hébergé sur Neon (remplace Supabase depuis novembre 2026).
// Driver HTTP : pas de connexion persistante à gérer, adapté aux fonctions Vercel.

// Les valeurs sont renvoyées dans le même format que l'ancienne API Supabase,
// pour que le reste de l'app n'ait pas à changer :
//   date        → 'YYYY-MM-DD' (chaîne brute, jamais convertie en Date → pas de décalage de fuseau)
//   timestamptz → chaîne ISO 'YYYY-MM-DDTHH:mm:ss.sssZ' (le code fait .split('T'))
//   numeric     → number (heures, jours ouvrés, soldes)
const DATE = 1082
const TIMESTAMP = 1114
const TIMESTAMPTZ = 1184
const NUMERIC = 1700

// Réglage global : en v1.2, l'option `types` de neon() n'est pas appliquée
// aux requêtes HTTP (seule une option par requête l'est), alors que les parseurs
// globaux le sont toujours.
types.setTypeParser(DATE, (v: string) => v)
types.setTypeParser(TIMESTAMP, (v: string) => new Date(v.replace(' ', 'T') + 'Z').toISOString())
types.setTypeParser(TIMESTAMPTZ, (v: string) => new Date(v).toISOString())
types.setTypeParser(NUMERIC, (v: string) => parseFloat(v))

// Lazy singleton — créé au premier appel (runtime), pas au chargement du module,
// pour que le build Vercel passe sans variables d'environnement.
let _sql: NeonQueryFunction<false, false> | null = null

export function getSql(): NeonQueryFunction<false, false> {
  if (!_sql) {
    const url = process.env.DATABASE_URL
    if (!url) {
      throw new Error('Variable DATABASE_URL manquante (chaîne de connexion Neon).')
    }
    _sql = neon(url)
  }
  return _sql
}

// Types des tables
export type Absence = {
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

export type FeuilleTemps = {
  id: string
  nom: string
  prenom: string
  date_journee: string
  heures_travaillees: number | null
  heures_a_recuperer: number
  created_at: string
}

export type PointeBateau = {
  id: string
  feuille_temps_id: string
  nom_bateau: string
  heures: number
}

export type Employe = {
  id: string
  nom: string
  prenom: string
  actif: boolean
  created_at: string
}
