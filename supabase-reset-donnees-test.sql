-- ⚠️  REMISE À ZÉRO — IRRÉVERSIBLE
-- Supprimer toutes les données de test (absences, feuilles de temps, pointes bateaux)
-- Exécuter dans Supabase > SQL Editor

DELETE FROM pointes_bateaux;
DELETE FROM feuilles_temps;
DELETE FROM absences;

-- Optionnel : remettre les soldes de départ à zéro
-- UPDATE employes SET solde_depart_recuperation = 0;
