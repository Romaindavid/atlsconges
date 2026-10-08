-- Arrivées / départs des salariés
-- date_entree : à partir de quand le salarié apparaît (null = depuis toujours)
-- date_sortie : dernier jour dans l'équipe (null = toujours présent)
-- L'historique (feuilles de temps, absences) est conservé.

alter table employes add column if not exists date_entree date;
alter table employes add column if not exists date_sortie date;
