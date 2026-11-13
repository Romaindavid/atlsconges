-- ============================================================
-- Atlantique Sellerie — schéma Postgres (Neon)
-- Regroupe l'ancien supabase-schema.sql et toutes ses migrations.
-- Rejouable sans risque (create table if not exists).
-- Pas de RLS : seule l'app (côté serveur) accède à la base.
-- ============================================================

create table if not exists employes (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  prenom text not null,
  actif boolean default true,
  created_at timestamptz default now(),
  solde_depart_recuperation numeric(6,2) default 0,
  code_pin varchar(4),
  date_naissance date,
  jour_anniversaire_pris date,
  date_entree date, -- à partir de quand le salarié apparaît (null = depuis toujours)
  date_sortie date  -- dernier jour dans l'équipe (null = toujours présent)
);

create table if not exists absences (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  prenom text not null,
  type_absence text not null,
  type_absence_detail text,
  date_debut date not null,
  date_fin date not null,
  jours_ouvres numeric(5,1) not null, -- 0.5 pour une demi-journée
  demi_journee text check (demi_journee in ('matin', 'apres_midi')),
  commentaire_salarie text,
  date_demande timestamptz default now(),
  statut text default 'en_attente', -- en_attente | accorde | refuse
  commentaire_direction text,
  date_decision timestamptz
);

create table if not exists feuilles_temps (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  prenom text not null,
  date_journee date not null,
  heures_travaillees numeric(4,2),
  heures_a_recuperer numeric(4,2) default 0,
  commentaire text,
  created_at timestamptz default now()
);

create table if not exists pointes_bateaux (
  id uuid primary key default gen_random_uuid(),
  feuille_temps_id uuid references feuilles_temps(id) on delete cascade,
  nom_bateau text not null,
  heures numeric(4,2) not null,
  panier_repas boolean default false
);

-- Overrides des jours fériés par l'admin
-- actif = true  → jour traité comme férié (même si non standard)
-- actif = false → jour traité comme ouvré (même si férié standard)
create table if not exists jours_feries_override (
  date date primary key,
  actif boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists vacances_obligatoires (
  id uuid primary key default gen_random_uuid(),
  date_debut date not null,
  date_fin date not null,
  nom varchar(255) not null default 'Fermeture',
  created_at timestamptz default now()
);

create index if not exists feuilles_temps_salarie_date on feuilles_temps (nom, prenom, date_journee);
create index if not exists absences_salarie on absences (nom, prenom);
create index if not exists pointes_bateaux_feuille on pointes_bateaux (feuille_temps_id);
