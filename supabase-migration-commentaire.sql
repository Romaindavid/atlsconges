-- Migration : ajout du commentaire journalier sur les feuilles de temps
-- À exécuter dans l'éditeur SQL de Supabase

ALTER TABLE feuilles_temps
  ADD COLUMN IF NOT EXISTS commentaire TEXT;
