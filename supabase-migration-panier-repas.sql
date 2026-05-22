-- Migration : ajout du champ panier_repas sur les pointes bateau
-- À exécuter dans l'éditeur SQL de Supabase

ALTER TABLE pointes_bateaux
  ADD COLUMN IF NOT EXISTS panier_repas BOOLEAN DEFAULT FALSE;
