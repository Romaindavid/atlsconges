-- Migration : correction des policies RLS manquantes sur feuilles_temps et pointes_bateaux
-- Bug corrigé : ces deux tables n'avaient ni policy UPDATE ni DELETE, ce qui bloquait
-- silencieusement (sans erreur remontée) toute modification/suppression après la 1ère saisie :
--   - feuilles_temps.update() (heures à récupérer) ne s'appliquait jamais après la création
--   - pointes_bateaux.delete() (nettoyage avant réenregistrement) ne s'appliquait jamais,
--     donc chaque nouvel enregistrement dupliquait les pointes/paniers existants
-- À exécuter dans l'éditeur SQL de Supabase

create policy "Mise à jour publique feuilles_temps" on feuilles_temps
  for update using (true) with check (true);

create policy "Mise à jour publique pointes_bateaux" on pointes_bateaux
  for update using (true) with check (true);

create policy "Suppression publique pointes_bateaux" on pointes_bateaux
  for delete using (true);
