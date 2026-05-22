-- ============================================================
-- Migration : ajout de la table employés
-- À exécuter dans l'éditeur SQL Supabase
-- ============================================================

create table if not exists employes (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  prenom text not null,
  actif boolean default true,
  created_at timestamptz default now()
);

alter table employes enable row level security;

create policy "Lecture publique employes" on employes
  for select using (true);

create policy "Insertion publique employes" on employes
  for insert with check (true);

create policy "Mise à jour publique employes" on employes
  for update using (true);

create policy "Suppression publique employes" on employes
  for delete using (true);

-- Données initiales
insert into employes (nom, prenom) values
  ('BESNIER', 'Lucie'),
  ('CHAIGNEAU', 'Elodie'),
  ('DESSED', 'Myriam'),
  ('GAUCHAT', 'Nathalie'),
  ('LEON', 'Marie'),
  ('LIU', 'Yanxia'),
  ('MACAUD', 'Elodie'),
  ('MACAUD', 'Karine'),
  ('MONANGE', 'Willeme'),
  ('NORMAND', 'Richard'),
  ('PELLE', 'Corinne');
