-- Demi-journées d'absence
-- jours_ouvres passe en décimal (0.5 pour une demi-journée)
-- demi_journee : null = journée(s) entière(s), 'matin' (8h–12h) ou 'apres_midi' (12h45–16h15)

alter table absences alter column jours_ouvres type numeric(5,1);

alter table absences add column if not exists demi_journee text
  check (demi_journee in ('matin', 'apres_midi'));
