-- Overrides des jours fériés par l'admin
-- actif = true  → jour traité comme férié (même si non standard)
-- actif = false → jour traité comme ouvré (même si férié standard)
CREATE TABLE IF NOT EXISTS jours_feries_override (
  date       DATE PRIMARY KEY,
  actif      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ⚠️ IMPORTANT : sans RLS + policy, le role anon ne peut pas écrire dans la table
ALTER TABLE jours_feries_override ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acces_complet" ON jours_feries_override
  FOR ALL USING (true) WITH CHECK (true);
