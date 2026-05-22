-- ============================================================
-- Atlantique Sellerie — Schéma Supabase
-- Copier-coller ce SQL dans l'éditeur SQL de Supabase
-- ============================================================

-- Demandes d'absence
create table if not exists absences (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  prenom text not null,
  type_absence text not null,
  type_absence_detail text,
  date_debut date not null,
  date_fin date not null,
  jours_ouvres integer not null,
  commentaire_salarie text,
  date_demande timestamptz default now(),
  statut text default 'en_attente', -- en_attente | accorde | refuse
  commentaire_direction text,
  date_decision timestamptz
);

-- Feuilles de temps
create table if not exists feuilles_temps (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  prenom text not null,
  date_journee date not null,
  heures_travaillees numeric(4,2),
  heures_a_recuperer numeric(4,2) default 0,
  created_at timestamptz default now()
);

-- Pointés bateaux (liés à une feuille de temps)
create table if not exists pointes_bateaux (
  id uuid primary key default gen_random_uuid(),
  feuille_temps_id uuid references feuilles_temps(id) on delete cascade,
  nom_bateau text not null,
  heures numeric(4,2) not null
);

-- Politiques RLS (Row Level Security)
-- Permettre l'accès public (anon) en lecture/écriture depuis l'app
-- (pas de comptes individuels dans cette app)

alter table absences enable row level security;
alter table feuilles_temps enable row level security;
alter table pointes_bateaux enable row level security;

-- Politique : tout le monde peut insérer et lire
create policy "Lecture publique absences" on absences
  for select using (true);

create policy "Insertion publique absences" on absences
  for insert with check (true);

create policy "Mise à jour publique absences" on absences
  for update using (true);

create policy "Lecture publique feuilles_temps" on feuilles_temps
  for select using (true);

create policy "Insertion publique feuilles_temps" on feuilles_temps
  for insert with check (true);

create policy "Lecture publique pointes_bateaux" on pointes_bateaux
  for select using (true);

create policy "Insertion publique pointes_bateaux" on pointes_bateaux
  for insert with check (true);
