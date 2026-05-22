'use client'

import { useState } from 'react'
import Link from 'next/link'
import { getFeuillesMois, sauvegarderJournee, getSoldeRecupComplet } from '@/app/temps/actions'
import type { JourneeEntry } from '@/app/temps/actions'

// ─── Jours fériés France ──────────────────────────────────────────────────────
function getEaster(y: number): Date {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100
  const d = Math.floor(b / 4), e = b % 4
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const ii = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * ii - h - k) % 7
  const mm = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * mm + 114) / 31)
  const day = ((h + l - 7 * mm + 114) % 31) + 1
  return new Date(y, month - 1, day)
}

function isJourFerie(date: Date): boolean {
  const m = date.getMonth() + 1, d = date.getDate(), y = date.getFullYear()
  if (m === 1  && d === 1)  return true
  if (m === 5  && d === 1)  return true
  if (m === 5  && d === 8)  return true
  if (m === 7  && d === 14) return true
  if (m === 8  && d === 15) return true
  if (m === 11 && d === 1)  return true
  if (m === 11 && d === 11) return true
  if (m === 12 && d === 25) return true
  const em = getEaster(y).getTime()
  const same = (ms: number) => { const x = new Date(ms); return x.getMonth() + 1 === m && x.getDate() === d }
  return same(em + 86400000) || same(em + 39 * 86400000) || same(em + 50 * 86400000)
}

// ─── Numéro de semaine ISO ────────────────────────────────────────────────────
function isoWeek(date: Date): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7)
  const w1 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d.getTime() - w1.getTime()) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7)
}

// ─── Semaines du mois (Lun → Sam) ────────────────────────────────────────────
type WeekGroup = { label: string; days: Date[] }

function getWeeksOfMonth(annee: number, mois: number): WeekGroup[] {
  const first = new Date(annee, mois - 1, 1)
  const last  = new Date(annee, mois, 0)
  const start = new Date(first)
  const dow = start.getDay() || 7
  start.setDate(start.getDate() - (dow - 1))
  const weeks: WeekGroup[] = []
  const cur = new Date(start)
  while (cur <= last) {
    const days: Date[] = []
    for (let i = 0; i < 6; i++) { days.push(new Date(cur)); cur.setDate(cur.getDate() + 1) }
    cur.setDate(cur.getDate() + 1)
    weeks.push({ label: `S${isoWeek(days[0])}`, days })
  }
  return weeks
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function dateToISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function todayISO() { return dateToISO(new Date()) }
function fmt(n: number) { return n % 1 === 0 ? String(n) : n.toFixed(1) }

// Heures pré-remplies selon le jour de la semaine
function defaultHours(iso: string): string {
  const dow = new Date(iso + 'T12:00:00').getDay()
  if (dow === 5) return '5'   // Vendredi
  if (dow === 6) return ''    // Samedi : pas de pré-remplissage
  return '7.5'                // Lundi → Jeudi
}

const JOURS    = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI']
const MOIS_NOMS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

// ─── Types modal ──────────────────────────────────────────────────────────────
type EditPointe = { uid: number; nom: string; panier: boolean }
type EditState  = {
  date: string
  heuresEnPlus: string   // positif → l'entreprise me doit
  heuresEnMoins: string  // positif → je dois rattraper
  commentaire: string
  pointes: EditPointe[]
}
let uidSeq = 1

// ─── Props ────────────────────────────────────────────────────────────────────
type Employe = { id: string; nom: string; prenom: string }
export type Props = {
  employe: Employe
  entriesInitiales: JourneeEntry[]
  moisInitial: number
  anneeInitiale: number
  soldeRecupInitial: number
}

export default function FeuilleTempsCore({ employe, entriesInitiales, moisInitial, anneeInitiale, soldeRecupInitial }: Props) {
  const [mois,        setMois]        = useState(moisInitial)
  const [annee,       setAnnee]       = useState(anneeInitiale)
  const [entries,     setEntries]     = useState<JourneeEntry[]>(entriesInitiales)
  const [loadingMois, setLoadingMois] = useState(false)
  const [editState,   setEditState]   = useState<EditState | null>(null)
  const [saving,      setSaving]      = useState(false)
  const [saveMsg,     setSaveMsg]     = useState<string | null>(null)
  const [soldeRecup,  setSoldeRecup]  = useState(soldeRecupInitial)

  const today = todayISO()
  const weeks = getWeeksOfMonth(annee, mois)
  const byDate = new Map(entries.map(e => [e.date_journee, e]))

  const totalHeures  = entries.reduce((s, e) => s + (e.heures_travaillees ?? 0) + (e.heures_a_recuperer ?? 0), 0)
  const totalRecup   = entries.reduce((s, e) => s + (e.heures_a_recuperer  ?? 0), 0)
  const totalPointes = entries.reduce((s, e) => s + (e.pointes_bateaux?.length ?? 0), 0)

  async function changerMois(delta: number) {
    let m = mois + delta, a = annee
    if (m > 12) { m = 1;  a++ }
    if (m < 1)  { m = 12; a-- }
    setLoadingMois(true)
    const data = await getFeuillesMois(employe.nom, employe.prenom, m, a)
    setMois(m); setAnnee(a); setEntries(data)
    setLoadingMois(false)
  }

  function ouvrirEdit(iso: string) {
    const e = byDate.get(iso)
    const r = e?.heures_a_recuperer ?? 0
    setEditState({
      date: iso,
      heuresEnPlus:  r > 0 ? String(r)           : '',
      heuresEnMoins: r < 0 ? String(Math.abs(r)) : '',
      commentaire: e?.commentaire ?? '',
      pointes: (e?.pointes_bateaux ?? []).map(b => ({ uid: uidSeq++, nom: b.nom_bateau, panier: b.panier_repas })),
    })
    setSaveMsg(null)
  }

  function addPointe()     { setEditState(p => p ? { ...p, pointes: [...p.pointes, { uid: uidSeq++, nom: '', panier: false }] } : p) }
  function removePointe(u: number) { setEditState(p => p ? { ...p, pointes: p.pointes.filter(x => x.uid !== u) } : p) }
  function updatePointe(u: number, f: 'nom' | 'panier', v: string | boolean) {
    setEditState(p => p ? { ...p, pointes: p.pointes.map(x => x.uid === u ? { ...x, [f]: v } : x) } : p)
  }

  async function handleSave() {
    if (!editState) return
    setSaving(true); setSaveMsg(null)
    const parseFR = (v: string) => parseFloat(v.replace(',', '.')) || 0
    const enPlus  = parseFR(editState.heuresEnPlus)
    const enMoins = parseFR(editState.heuresEnMoins)
    const defaultH = parseFloat(defaultHours(editState.date)) || null
    const res = await sauvegarderJournee({
      nom: employe.nom, prenom: employe.prenom,
      date_journee: editState.date,
      heures_travaillees: defaultH,
      heures_a_recuperer: enPlus - enMoins,
      commentaire: editState.commentaire.trim() || null,
      pointes_bateaux: editState.pointes.filter(p => p.nom.trim()).map(p => ({ nom_bateau: p.nom, panier_repas: p.panier })),
    })
    if (res.success) {
      const [data, nouveauSolde] = await Promise.all([
        getFeuillesMois(employe.nom, employe.prenom, mois, annee),
        getSoldeRecupComplet(employe.nom, employe.prenom, employe.id),
      ])
      setEntries(data); setSoldeRecup(nouveauSolde); setSaveMsg('✅ Enregistré')
      setTimeout(() => setEditState(null), 700)
    } else {
      setSaveMsg(`⚠️ ${res.message}`)
    }
    setSaving(false)
  }

  return (
    <div className="space-y-5">

      {/* ── Barre navigation mois + bouton absence ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => changerMois(-1)} disabled={loadingMois}
            className="p-2.5 rounded-xl bg-white border-2 border-marine-200 hover:bg-marine-100 disabled:opacity-50 transition-colors">
            <svg className="w-4 h-4 text-marine-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-marine-800 font-bold text-lg w-40 text-center">
            {MOIS_NOMS[mois - 1]} {annee}
          </span>
          <button onClick={() => changerMois(1)} disabled={loadingMois}
            className="p-2.5 rounded-xl bg-white border-2 border-marine-200 hover:bg-marine-100 disabled:opacity-50 transition-colors">
            <svg className="w-4 h-4 text-marine-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <Link href="/absence"
          className="flex items-center gap-2 bg-white border-2 border-marine-200 hover:border-orange-500 hover:text-orange-600 text-marine-700 font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm whitespace-nowrap">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Demander une absence
        </Link>
      </div>

      {/* ── Tableau principal ── */}
      {loadingMois ? (
        <div className="bg-white rounded-2xl p-12 text-center text-marine-400 border border-marine-100 shadow-sm">Chargement…</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl shadow-sm border border-marine-200">
          <table className="w-full border-collapse bg-white text-sm" style={{ minWidth: '820px' }}>
            <thead>
              <tr className="bg-marine-800 text-white text-xs uppercase tracking-wide">
                <th className="px-3 py-3 text-center font-bold border-r border-marine-700 w-14">Sem.</th>
                {JOURS.map((j, i) => (
                  <th key={j} className={`px-2 py-3 text-center font-bold border-r border-marine-700 w-20 ${i === 5 ? 'text-marine-300' : ''}`}>{j}</th>
                ))}
                <th className="px-3 py-3 text-center font-bold border-r border-marine-600 w-14 bg-marine-700">Total</th>
                <th className="px-3 py-3 text-center font-bold border-r border-marine-700">
                  Pointes bateaux
                </th>
                <th className="px-3 py-3 text-center font-bold w-24">Récup.</th>
              </tr>
            </thead>

            <tbody>
              {weeks.map((week, wi) => {
                const inMonthDays = week.days.filter(d => d.getMonth() + 1 === mois)
                const weekEntries = inMonthDays.map(d => byDate.get(dateToISO(d))).filter(Boolean) as JourneeEntry[]
                const weekHeures  = weekEntries.reduce((s, e) => s + (e.heures_travaillees ?? 0) + (e.heures_a_recuperer ?? 0), 0)
                const weekRecup   = weekEntries.reduce((s, e) => s + (e.heures_a_recuperer  ?? 0), 0)
                const weekPointes = weekEntries.flatMap(e => e.pointes_bateaux ?? [])

                return (
                  <tr key={week.label} className={wi % 2 === 0 ? 'bg-white' : 'bg-marine-50/30'}>
                    <td className="px-2 py-0 text-center font-bold text-marine-600 bg-marine-50 border-r border-marine-200 text-xs">
                      {week.label}
                    </td>

                    {week.days.map((jour, i) => {
                      const iso      = dateToISO(jour)
                      const inMonth  = jour.getMonth() + 1 === mois
                      const ferie    = inMonth && isJourFerie(jour)
                      const isSam    = i === 5
                      const isToday  = iso === today
                      const isFutur  = iso > today
                      const entry    = byDate.get(iso)
                      const clickable = inMonth && !ferie && !isFutur
                      const defH     = parseFloat(defaultHours(iso)) || 0
                      const effectif = entry
                        ? (entry.heures_travaillees ?? defH) + (entry.heures_a_recuperer ?? 0)
                        : null

                      return (
                        <td key={iso}
                          onClick={clickable ? () => ouvrirEdit(iso) : undefined}
                          style={{ height: '52px' }}
                          className={[
                            'border-r border-marine-100 text-center align-middle relative px-1',
                            !inMonth              ? 'bg-slate-50/50' : '',
                            isSam && inMonth      ? 'bg-slate-100/60' : '',
                            isToday               ? '!bg-orange-50 border-l-2 !border-l-orange-400' : '',
                            ferie                 ? '!bg-slate-100' : '',
                            clickable             ? 'cursor-pointer hover:bg-orange-50/60 transition-colors' : '',
                          ].filter(Boolean).join(' ')}
                        >
                          {ferie ? (
                            <span className="text-xs text-slate-400 italic">férié</span>
                          ) : inMonth && entry ? (
                            <div className="flex flex-col items-center justify-center h-full">
                              <span className={`font-bold text-base ${
                                (entry.heures_a_recuperer ?? 0) !== 0
                                  ? (entry.heures_a_recuperer! > 0 ? 'text-success-600' : 'text-danger-600')
                                  : isToday ? 'text-orange-600' : 'text-marine-800'
                              }`}>
                                {fmt(effectif!)}
                              </span>
                              {entry.commentaire && (
                                <span className="text-xs leading-none" title={entry.commentaire}>💬</span>
                              )}
                            </div>
                          ) : inMonth && !isFutur && defH > 0 ? (
                            /* Journée passée non saisie — affiche le défaut en gris */
                            <span className={`text-sm italic select-none ${isSam ? 'text-slate-300' : 'text-marine-300'}`}>
                              {fmt(defH)}
                            </span>
                          ) : inMonth && !isFutur ? (
                            <span className="text-marine-200 text-lg select-none">·</span>
                          ) : null}
                          {isToday && !ferie && (
                            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-orange-500" />
                          )}
                        </td>
                      )
                    })}

                    <td className="px-3 py-0 text-center font-bold border-x border-marine-200 bg-marine-50">
                      {weekHeures > 0
                        ? <span className="text-marine-800 text-base">{fmt(weekHeures)}</span>
                        : <span className="text-marine-300 font-normal">0</span>
                      }
                    </td>

                    <td className="px-3 py-2 border-r border-marine-100">
                      <div className="flex flex-wrap gap-1">
                        {weekPointes.map((b, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1 bg-marine-100 text-marine-700 px-2 py-0.5 rounded text-xs font-medium">
                            ⛵ {b.nom_bateau}{b.panier_repas ? ' 🧺' : ''}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="px-3 py-0 text-center font-bold">
                      {weekRecup !== 0 ? (
                        <span className={`text-base ${weekRecup > 0 ? 'text-success-600' : 'text-danger-600'}`}>
                          {weekRecup > 0 ? '+' : ''}{fmt(weekRecup)}
                        </span>
                      ) : weekEntries.length > 0 ? (
                        <span className="text-marine-300 font-normal">—</span>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>

            <tfoot>
              <tr className="border-t-2 border-marine-300 bg-marine-100 font-bold">
                <td colSpan={8} className="px-4 py-3 text-right text-marine-500 text-xs uppercase tracking-wide">
                  Total du mois
                </td>
                <td className="px-3 py-3 text-center border-x border-marine-200 bg-marine-200/50">
                  <div className="text-marine-600 text-xs">Total pointes</div>
                  <div className="text-marine-800 font-black">{totalPointes}</div>
                </td>
                <td className="px-3 py-3 text-center">
                  <div className="text-marine-600 text-xs">Total récupération</div>
                  <div className={`font-black ${totalRecup > 0 ? 'text-success-600' : totalRecup < 0 ? 'text-danger-600' : 'text-marine-400'}`}>
                    {totalRecup !== 0 ? `${totalRecup > 0 ? '+' : ''}${fmt(totalRecup)}h` : '0'}
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── Récap : heures du mois + solde total historique ── */}
      <div className="grid grid-cols-2 gap-3">
        {/* Heures travaillées ce mois */}
        <div className="bg-white rounded-2xl p-4 border border-marine-100 text-center shadow-sm">
          <p className="text-marine-500 text-xs uppercase tracking-wide mb-1">
            Heures — {MOIS_NOMS[mois - 1]}
          </p>
          <p className="text-marine-800 text-2xl font-bold">
            {entries.length > 0 ? `${fmt(totalHeures)}h` : '—'}
          </p>
        </div>

        {/* Solde récup total (historique) */}
        <div className={`rounded-2xl p-5 border shadow-sm ${
          soldeRecup > 0 ? 'bg-success-100 border-success-600/20' :
          soldeRecup < 0 ? 'bg-danger-100  border-danger-600/20'  :
                           'bg-marine-50   border-marine-200'
        }`}>
          <p className="text-marine-500 text-xs uppercase tracking-wide mb-1">
            Solde récupération (total)
          </p>
          <p className={`text-2xl font-black mb-0.5 ${
            soldeRecup > 0 ? 'text-success-600' :
            soldeRecup < 0 ? 'text-danger-600'  : 'text-marine-400'
          }`}>
            {soldeRecup > 0 ? '+' : ''}{fmt(soldeRecup)}h
          </p>
          <p className={`text-xs font-medium ${
            soldeRecup > 0 ? 'text-success-600' :
            soldeRecup < 0 ? 'text-danger-600'  : 'text-marine-500'
          }`}>
            {soldeRecup > 0
              ? "✅ L'entreprise vous doit ces heures"
              : soldeRecup < 0
              ? `⚠️ ${fmt(Math.abs(soldeRecup))}h à rattraper`
              : '✅ Tout est à jour'}
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          MODAL SAISIE JOURNÉE
      ══════════════════════════════════════════════════════════════════ */}
      {editState && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 px-0 sm:px-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[92vh] flex flex-col">

            {/* En-tête */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-marine-100 flex-shrink-0">
              <h2 className="text-marine-800 font-bold text-lg capitalize">
                {new Date(editState.date + 'T12:00:00').toLocaleDateString('fr-FR', {
                  weekday: 'long', day: 'numeric', month: 'long',
                })}
              </h2>
              <button onClick={() => setEditState(null)}
                className="p-2 text-marine-400 hover:text-marine-800 hover:bg-marine-100 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Corps scrollable */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

              {/* ── Heures travaillées (non éditable, standard) ── */}
              <div className="flex items-center gap-3 bg-marine-50 rounded-xl px-4 py-3 border border-marine-200">
                <span className="text-2xl">⏱️</span>
                <div>
                  <p className="text-marine-700 font-bold text-sm">Journée standard</p>
                  <p className="text-marine-800 font-black text-xl">
                    {defaultHours(editState.date) || '—'}&nbsp;h
                  </p>
                </div>
                <p className="text-marine-400 text-xs ml-auto text-right">
                  Pré-rempli<br/>automatiquement
                </p>
              </div>

              {/* ── Récupération (2 champs séparés, libellés à la 1ère personne) ── */}
              <div>
                <label className="block text-marine-700 font-bold mb-3">📊 Récupération d&apos;heures</label>
                <div className="space-y-3">

                  {/* J'ai travaillé plus */}
                  <div className="rounded-xl border-2 border-success-600/25 bg-success-100/50 p-4">
                    <p className="text-success-600 font-semibold text-sm">
                      ⏱ J&apos;ai travaillé plus que prévu
                    </p>
                    <p className="text-success-600/70 text-xs mt-0.5 mb-3">
                      ex : je pars 30 min plus tard
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <input type="text" inputMode="decimal"
                        value={editState.heuresEnPlus}
                        onChange={e => setEditState(p => p ? { ...p, heuresEnPlus: e.target.value } : p)}
                        placeholder="0"
                        className="w-28 border-2 border-success-600/40 rounded-lg px-3 py-2.5 text-marine-900 text-lg text-center focus:border-success-600 focus:outline-none bg-white"
                      />
                      <span className="text-success-600 text-sm font-medium">h → ce que l&apos;entreprise me doit</span>
                    </div>
                  </div>

                  {/* J'ai travaillé moins */}
                  <div className="rounded-xl border-2 border-danger-600/25 bg-danger-100/50 p-4">
                    <p className="text-danger-600 font-semibold text-sm">
                      ⏪ J&apos;ai travaillé moins que prévu
                    </p>
                    <p className="text-danger-600/70 text-xs mt-0.5 mb-3">
                      ex : je suis parti 30 min plus tôt
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <input type="text" inputMode="decimal"
                        value={editState.heuresEnMoins}
                        onChange={e => setEditState(p => p ? { ...p, heuresEnMoins: e.target.value } : p)}
                        placeholder="0"
                        className="w-28 border-2 border-danger-600/40 rounded-lg px-3 py-2.5 text-marine-900 text-lg text-center focus:border-danger-600 focus:outline-none bg-white"
                      />
                      <span className="text-danger-600 text-sm font-medium">h → ce que je dois rattraper</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Pointes bateau ── */}
              <div>
                <label className="block text-marine-700 font-bold mb-3">⛵ Pointes bateau</label>
                {editState.pointes.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {editState.pointes.map(pt => (
                      <div key={pt.uid} className="flex items-center gap-2 bg-marine-50 rounded-xl p-3">
                        <input type="text" value={pt.nom}
                          onChange={e => updatePointe(pt.uid, 'nom', e.target.value)}
                          placeholder="Nom du bateau"
                          className="flex-1 border-2 border-marine-200 rounded-lg px-3 py-2 text-marine-900 text-base placeholder:text-marine-300 focus:border-orange-500 focus:outline-none bg-white"
                        />
                        <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0">
                          <input type="checkbox" checked={pt.panier}
                            onChange={e => updatePointe(pt.uid, 'panier', e.target.checked)}
                            className="w-4 h-4 accent-orange-500"
                          />
                          <span className="text-sm font-medium text-marine-700 whitespace-nowrap">🧺 Panier</span>
                        </label>
                        <button type="button" onClick={() => removePointe(pt.uid)}
                          className="p-1.5 text-danger-600 hover:bg-danger-100 rounded-lg flex-shrink-0 transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button type="button" onClick={addPointe}
                  className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-marine-300 hover:border-orange-400 hover:text-orange-600 text-marine-600 font-medium px-4 py-3 rounded-xl transition-colors text-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Ajouter une pointe
                </button>
              </div>

              {/* ── Commentaire optionnel ── */}
              <div>
                <label className="block text-marine-700 font-semibold mb-2">
                  💬 Commentaire <span className="text-marine-400 font-normal text-sm">(optionnel)</span>
                </label>
                <textarea
                  value={editState.commentaire}
                  onChange={e => setEditState(p => p ? { ...p, commentaire: e.target.value } : p)}
                  rows={2}
                  placeholder="Information utile pour la direction..."
                  className="w-full border-2 border-marine-200 rounded-xl px-3 py-2.5 text-marine-900 text-sm placeholder:text-marine-300 focus:border-orange-500 focus:outline-none resize-none"
                />
              </div>

              {saveMsg && (
                <div className={`p-3 rounded-xl text-sm font-medium text-center ${saveMsg.startsWith('✅') ? 'bg-success-100 text-success-600' : 'bg-danger-100 text-danger-600'}`}>
                  {saveMsg}
                </div>
              )}
            </div>

            {/* Pied fixe */}
            <div className="flex gap-3 px-6 py-4 border-t border-marine-100 flex-shrink-0">
              <button onClick={() => setEditState(null)}
                className="flex-1 border-2 border-marine-200 text-marine-600 hover:bg-marine-50 py-3 rounded-xl font-semibold transition-colors">
                Annuler
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white py-3 rounded-xl font-bold transition-colors">
                {saving ? 'Enregistrement…' : '✓ Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
