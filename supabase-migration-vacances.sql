-- Migration : table vacances / fermetures obligatoires
-- Exécuter dans Supabase > SQL Editor

CREATE TABLE IF NOT EXISTS vacances_obligatoires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  nom VARCHAR(255) NOT NULL DEFAULT 'Fermeture',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE vacances_obligatoires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access vacances" ON vacances_obligatoires
  FOR ALL USING (true);
