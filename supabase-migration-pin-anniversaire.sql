-- Migration : code PIN + date anniversaire sur les employés
-- Exécuter dans Supabase > SQL Editor

ALTER TABLE employes
  ADD COLUMN IF NOT EXISTS code_pin VARCHAR(4),
  ADD COLUMN IF NOT EXISTS date_naissance DATE,
  ADD COLUMN IF NOT EXISTS jour_anniversaire_pris DATE;
