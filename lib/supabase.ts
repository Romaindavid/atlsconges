import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Lazy singleton — créé uniquement au premier appel (runtime), pas au chargement du module.
// Ceci évite l'erreur "supabaseUrl is required" lors du build Vercel sans variables d'env.
let _client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) {
      throw new Error(
        'Variables Supabase manquantes. Configurez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY.'
      )
    }
    _client = createClient(url, key)
  }
  return _client
}

// Types for our tables
export type Absence = {
  id: string
  nom: string
  prenom: string
  type_absence: string
  type_absence_detail: string | null
  date_debut: string
  date_fin: string
  jours_ouvres: number
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
