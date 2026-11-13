// Copie unique des données Supabase → Neon.
//
// Usage (depuis la racine du projet) :
//   node --env-file=.env.local scripts/migrer-supabase-vers-neon.mjs
//
// Variables lues :
//   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY  → source (lecture seule)
//   DATABASE_URL                                              → cible Neon
//
// Étapes : crée les tables sur Neon (db/schema.sql), vérifie qu'elles sont vides,
// copie chaque table en gardant les mêmes id, puis compare les nombres de lignes.
// Supabase n'est jamais modifié. Ajouter --force pour vider Neon et recommencer.

import { readFileSync } from 'node:fs'
import { neon } from '@neondatabase/serverless'

// Accepte aussi une URL copiée avec /rest/v1/ à la fin
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/(rest\/v1\/?)?$/, '')
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const DATABASE_URL = process.env.DATABASE_URL
const FORCE = process.argv.includes('--force')

if (!SUPABASE_URL || !SUPABASE_KEY || !DATABASE_URL) {
  console.error('Il manque NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY ou DATABASE_URL.')
  process.exit(1)
}

// Ordre important : les parents avant les enfants (clé étrangère pointes → feuilles)
const TABLES = [
  { name: 'employes', order: 'id' },
  { name: 'absences', order: 'id' },
  { name: 'feuilles_temps', order: 'id' },
  { name: 'pointes_bateaux', order: 'id' },
  { name: 'jours_feries_override', order: 'date' },
  { name: 'vacances_obligatoires', order: 'id' },
]

const sql = neon(DATABASE_URL)

async function lireSupabase(table, order) {
  const lignes = []
  const PAGE = 1000 // limite par requête de l'API Supabase
  for (let offset = 0; ; offset += PAGE) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?select=*&order=${order}.asc&limit=${PAGE}&offset=${offset}`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          // Ancienne clé anon (JWT) : aussi en Bearer. Nouvelle clé sb_publishable_ : apikey seul.
          ...(SUPABASE_KEY.startsWith('eyJ') ? { Authorization: `Bearer ${SUPABASE_KEY}` } : {}),
        },
      }
    )
    if (!res.ok) throw new Error(`Lecture ${table} : ${res.status} ${await res.text()}`)
    const page = await res.json()
    lignes.push(...page)
    if (page.length < PAGE) return lignes
  }
}

// 1. Schéma
const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')
  .split('\n').filter(l => !l.trim().startsWith('--')).join('\n')
for (const instruction of schema.split(';').map(s => s.trim()).filter(Boolean)) {
  await sql.query(instruction)
}
console.log('Schéma créé sur Neon.')

// 2. Cible vide ?
for (const { name } of TABLES) {
  const [{ n }] = await sql.query(`select count(*)::int as n from ${name}`)
  if (n > 0 && !FORCE) {
    console.error(`La table ${name} contient déjà ${n} lignes sur Neon. Relancer avec --force pour tout écraser.`)
    process.exit(1)
  }
}
if (FORCE) {
  await sql.query(`truncate ${TABLES.map(t => t.name).join(', ')} cascade`)
  console.log('Tables Neon vidées (--force).')
}

// 3. Lecture complète de Supabase, puis écriture en une seule transaction
const donnees = {}
for (const { name, order } of TABLES) {
  donnees[name] = await lireSupabase(name, order)
  console.log(`Lu ${String(donnees[name].length).padStart(5)} lignes dans ${name}`)
}

await sql.transaction(
  TABLES.filter(({ name }) => donnees[name].length > 0).map(({ name }) =>
    // json_populate_recordset fait correspondre les colonnes par nom et convertit les types
    sql.query(
      `insert into ${name} select * from json_populate_recordset(null::${name}, $1::json)`,
      [JSON.stringify(donnees[name])]
    )
  )
)

// 4. Vérification
let ok = true
for (const { name } of TABLES) {
  const [{ n }] = await sql.query(`select count(*)::int as n from ${name}`)
  const attendu = donnees[name].length
  const statut = n === attendu ? 'OK' : 'ÉCART'
  if (n !== attendu) ok = false
  console.log(`${statut.padEnd(5)} ${name} : ${n} / ${attendu}`)
}
console.log(ok ? '\nMigration terminée, tout correspond.' : '\n⚠️ Des écarts ont été trouvés.')
process.exit(ok ? 0 : 1)
