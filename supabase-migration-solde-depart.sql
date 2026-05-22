-- Ajouter le solde de départ de récupération par salarié
ALTER TABLE employes
  ADD COLUMN IF NOT EXISTS solde_depart_recuperation DECIMAL(6,2) DEFAULT 0;
