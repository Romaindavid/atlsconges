# Atlantique Sellerie — Gestion RH

Application web interne pour la gestion des congés et feuilles de temps.

## Stack

- **Next.js 16** (App Router, Server Actions)
- **Neon** (PostgreSQL, driver `@neondatabase/serverless`, requêtes SQL dans les server actions)
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

### 2. Configurer la base (Neon)

1. Créer une base sur [neon.tech](https://neon.tech), ou depuis Vercel : projet → **Storage** → **Neon**
2. Copier la chaîne de connexion (`postgresql://…`) dans `DATABASE_URL`
3. Créer les tables : exécuter `db/schema.sql` dans l'éditeur SQL de Neon (rejouable sans risque)

`scripts/migrer-supabase-vers-neon.mjs` a servi à la copie unique des données depuis l'ancienne base Supabase (novembre 2026).

### 3. Variables d'environnement

Créer `.env.local` à la racine :

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST/neondb?sslmode=require
ADMIN_PASSWORD=votre_mot_de_passe_admin

# Optionnel : notification par e-mail à la direction à chaque nouvelle demande d'absence
# Créer un compte sur https://resend.com, vérifier un domaine d'envoi, récupérer une clé API
RESEND_API_KEY=re_xxx
RESEND_FROM_EMAIL=notifications@votredomaine.fr
ADMIN_NOTIFICATION_EMAIL=clairemarie@atlantiquesellerie.com
NEXT_PUBLIC_SITE_URL=https://votre-app.vercel.app
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
  db.ts                 ← Connexion Neon + types
  calcul-jours.ts       ← Calcul jours ouvrés
components/
  Header.tsx            ← Logo + navigation
  FormAbsence.tsx       ← Formulaire congés (client)
  FormTemps.tsx         ← Feuille de temps (client)
  AdminDashboard.tsx    ← Dashboard admin (client)
  AdminLogin.tsx        ← Écran de connexion admin
db/schema.sql           ← Schéma Postgres (Neon)
```
