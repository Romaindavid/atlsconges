# Atlantique Sellerie — Gestion RH

Application web interne pour la gestion des congés et feuilles de temps.

## Stack

- **Next.js 16** (App Router, Server Actions)
- **Supabase** (PostgreSQL + RLS)
- **Tailwind CSS v4**
- **Vercel** (déploiement)

## Routes

| Route | Description |
|-------|-------------|
| `/` | Page d'accueil avec les deux actions |
| `/absence` | Formulaire de demande de congés |
| `/temps` | Feuille de temps quotidienne |
| `/admin` | Interface direction (protégée par mot de passe) |

## Installation

### 1. Cloner et installer les dépendances

```bash
git clone https://github.com/Romaindavid/atlsconges.git
cd atlsconges
npm install
```

### 2. Configurer Supabase

1. Créer un projet sur [supabase.com](https://supabase.com)
2. Aller dans **SQL Editor** et exécuter le contenu de `supabase-schema.sql`
3. Récupérer les clés API dans **Settings > API**

### 3. Variables d'environnement

Créer `.env.local` à la racine :

```env
NEXT_PUBLIC_SUPABASE_URL=https://VOTRE_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=VOTRE_ANON_KEY
ADMIN_PASSWORD=votre_mot_de_passe_admin
```

### 4. Lancer en développement

```bash
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000)

## Déploiement Vercel

1. Importer le repo GitHub sur [vercel.com](https://vercel.com)
2. Ajouter les 3 variables d'environnement dans les paramètres Vercel
3. Déployer

## Structure des fichiers

```
app/
  page.tsx              ← Accueil
  absence/
    page.tsx            ← Formulaire absence
    actions.ts          ← Server Actions (soumission)
  temps/
    page.tsx            ← Feuille de temps
    actions.ts          ← Server Actions (soumission)
  admin/
    page.tsx            ← Dashboard direction
    actions.ts          ← Server Actions (auth, CRUD)
lib/
  supabase.ts           ← Client Supabase + types
  calcul-jours.ts       ← Calcul jours ouvrés
components/
  Header.tsx            ← Logo + navigation
  FormAbsence.tsx       ← Formulaire congés (client)
  FormTemps.tsx         ← Feuille de temps (client)
  AdminDashboard.tsx    ← Dashboard admin (client)
  AdminLogin.tsx        ← Écran de connexion admin
supabase-schema.sql     ← SQL à exécuter dans Supabase
```
