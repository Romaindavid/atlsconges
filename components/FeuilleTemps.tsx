'use client'

import { useState } from 'react'
import Link from 'next/link'
import { getFeuillesMois, sauvegarderJournee } from '@/app/temps/actions'
import type { JourneeEntry } from '@/app/temps/actions'

// ─── Jours fériés France ──────────────────────────────────────────────────────
function getEaster(y: number): Date {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100
  const d = Math.floor(b / 4), e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
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
  if (m === 1  && d === 1)  return true // Jour de l'an
  if (m === 5  && d === 1)  return true // Fête du Travail
  if (m === 5  && d === 8)  return true // Victoire 1945
  if (m === 7  && d === 14) return true // Fête nationale
  if (m === 8  && d === 15) return true // Assomption
  if (m === 11 && d === 1)  return true // Toussaint
  if (m === 11 && d === 11) return true // Armistice
  if (m === 12 && d === 25) return true // Noël
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
  // Recule jusqu'au lundi de la semaine contenant le 1er
  const start = new Date(first)
  const dow = start.getDay() || 7
  start.setDate(start.getDate() - (dow - 1))
  const weeks: WeekGroup[] = []
  const cur = new Date(start)
  while (cur <= last) {
    const days: Date[] = []
    for (let i = 0; i < 6; i++) { days.push(new Date(cur)); cur.setDate(cur.getDate() + 1) }
    cur.setDate(cur.getDate() + 1) // saute le dimanche
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

const JOURS    = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI']
const MOIS_NOMS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

// ─── Types modal ──────────────────────────────────────────────────────────────
type SensRecup  = '+' | '-' | '0'
type EditPointe = { uid: number; nom: string; panier: boolean }
type EditState  = { date: string; heuresTravaillees: string; sensRecup: SensRecup; valeurRecup: string; pointes: EditPointe[] }
let uidSeq = 1

// ─── Props ────────────────────────────────────────────────────────────────────
type Employe = { id: string; nom: string; prenom: string }
type Props = { employe: Employe; entriesInitiales: JourneeEntry[]; moisInitial: number; anneeInitiale: number }

export default function FeuilleTemps({ employe, entriesInitiales, moisInitial, anneeInitiale }: Props) {
  const [mois,        setMois]        = useState(moisInitial)
  const [annee,       setAnnee]       = useState(anneeInitiale)
  const [entries,     setEntries]     = useState<JourneeEntry[]>(entriesInitiales)
  const [loadingMois, setLoadingMois] = useState(false)
  const [editState,   setEditState]   = useState<EditState | null>(null)
  const [saving,      setSaving]      = useState(false)
  const [saveMsg,     setSaveMsg]     = useState<string | null>(null)

  const today = todayISO()
  const weeks = getWeeksOfMonth(annee, mois)
  const byDate = new Map(entries.map(e => [e.date_journee, e]))

  const totalHeures  = entries.reduce((s, e) => s + (e.heures_travaillees ?? 0), 0)
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
      heuresTravaillees: e?.heures_travaillees != null ? String(e.heures_travaillees) : '',
      sensRecup: r > 0 ? '+' : r < 0 ? '-' : '0',
      valeurRecup: r !== 0 ? String(Math.abs(r)) : '',
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
    const val = parseFloat(editState.valeurRecup) || 0
    const rec = editState.sensRecup === '+' ? val : editState.sensRecup === '-' ? -val : 0
    const res = await sauvegarderJournee({
      nom: employe.nom, prenom: employe.prenom,
      date_journee: editState.date,
      heures_travaillees: editState.heuresTravaillees ? parseFloat(editState.heuresTravaillees) : null,
      heures_a_recuperer: rec,
      pointes_bateaux: editState.pointes.filter(p => p.nom.trim()).map(p => ({ nom_bateau: p.nom, panier_repas: p.panier })),
    })
    if (res.success) {
      const data = await getFeuillesMois(employe.nom, employe.prenom, mois, annee)
      setEntries(data); setSaveMsg('✅ Enregistré')
      setTimeout(() => setEditState(null), 700)
    } else {
      setSaveMsg(`⚠️ ${res.message}`)
    }
    setSaving(false)
  }

  return (
    <div className="min-h-screen flex flex-col bg-marine-50">

      {/* ── Header ── */}
      <header className="bg-marine-800 py-3 px-4 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="ATLS" className="h-10 w-10 rounded-lg flex-shrink-0" />
            <div className="hidden sm:block">
              <p className="text-marine-200 text-xs uppercase tracking-wide">Feuille de temps</p>
              <p className="text-white font-bold text-sm">{employe.prenom} {employe.nom}</p>
            </div>
          </div>
          <Link href="/" className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-2.5 rounded-xl transition-colors text-sm shadow-md">
            ← Accueil
          </Link>
        </div>
      </header>

      <main className="flex-1 py-6 px-4">
        <div className="max-w-6xl mx-auto space-y-5">

          {/* ── Nav mois + bouton absence ── */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Navigation */}
            <div className="flex items-center gap-2">
              <button onClick={() => changerMois(-1)} disabled={loadingMois}
                className="p-2.5 rounded-xl bg-white border-2 border-marine-200 hover:bg-marine-100 disabled:opacity-50 transition-colors">
                <svg className="w-4 h-4 text-marine-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-marine-800 font-bold text-lg w-44 text-center">
                FICHE DE TEMPS — {String(mois).padStart(2,'0')}
              </h1>
              <button onClick={() => changerMois(1)} disabled={loadingMois}
                className="p-2.5 rounded-xl bg-white border-2 border-marine-200 hover:bg-marine-100 disabled:opacity-50 transition-colors">
                <svg className="w-4 h-4 text-marine-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <p className="text-marine-500 text-sm font-medium">{MOIS_NOMS[mois - 1]} {annee}</p>
            <Link href="/absence"
              className="flex items-center gap-2 bg-white border-2 border-marine-200 hover:border-orange-500 hover:text-orange-600 text-marine-700 font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm whitespace-nowrap">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Demander une absence
            </Link>
          </div>

          {/* ── Identité ── */}
          <div className="bg-white rounded-2xl border border-marine-100 shadow-sm px-5 py-3 flex flex-wrap gap-x-8 gap-y-1 text-sm">
            <span><span className="font-bold text-marine-700 uppercase tracking-wide">NOM</span>
              <span className="text-marine-500 mx-2">—</span>
              <span className="font-semibold text-marine-900">{employe.nom.toUpperCase()}</span>
            </span>
            <span><span className="font-bold text-marine-700 uppercase tracking-wide">Prénom</span>
              <span className="text-marine-500 mx-2">—</span>
              <span className="font-semibold text-marine-900">{employe.prenom}</span>
            </span>
          </div>

          {/* ── Tableau principal ── */}
          {loadingMois ? (
            <div className="bg-white rounded-2xl p-16 text-center text-marine-400 border border-marine-100 shadow-sm">Chargement…</div>
          ) : (
            <div className="overflow-x-auto rounded-2xl shadow-sm border border-marine-200">
              <table className="w-full border-collapse bg-white text-sm" style={{ minWidth: '820px' }}>

                {/* En-têtes */}
                <thead>
                  <tr className="bg-marine-800 text-white text-xs uppercase tracking-wide">
                    <th className="px-3 py-3 text-center font-bold border-r border-marine-700 w-16">SEMAINES</th>
                    {JOURS.map((j, i) => (
                      <th key={j} className={`px-2 py-3 text-center font-bold border-r border-marine-700 w-20 ${i === 5 ? 'text-marine-300' : ''}`}>
                        {j}
                      </th>
                    ))}
                    <th className="px-3 py-3 text-center font-bold border-r border-marine-600 w-16 bg-marine-700">Total</th>
                    <th className="px-3 py-3 text-center font-bold border-r border-marine-700">
                      Nombre de pointes<br />
                      <span className="font-normal normal-case text-marine-300 text-xs">avec nom de bateau</span>
                    </th>
                    <th className="px-3 py-3 text-center font-bold w-28">Heures à récupérer</th>
                  </tr>
                </thead>

                {/* Corps — une ligne par semaine */}
                <tbody>
                  {weeks.map((week, wi) => {
                    const inMonthDays  = week.days.filter(d => d.getMonth() + 1 === mois)
                    const weekEntries  = inMonthDays.map(d => byDate.get(dateToISO(d))).filter(Boolean) as JourneeEntry[]
                    const weekHeures   = weekEntries.reduce((s, e) => s + (e.heures_travaillees ?? 0), 0)
                    const weekRecup    = weekEntries.reduce((s, e) => s + (e.heures_a_recuperer  ?? 0), 0)
                    const weekPointes  = weekEntries.flatMap(e => e.pointes_bateaux ?? [])

                    return (
                      <tr key={week.label} className={wi % 2 === 0 ? 'bg-white' : 'bg-marine-50/30'}>

                        {/* Numéro semaine */}
                        <td className="px-2 py-0 text-center font-bold text-marine-700 bg-marine-50 border-r border-marine-200 text-xs">
                          {week.label}
                        </td>

                        {/* Jours Lun→Sam */}
                        {week.days.map((jour, i) => {
                          const iso      = dateToISO(jour)
                          const inMonth  = jour.getMonth() + 1 === mois
                          const ferie    = inMonth && isJourFerie(jour)
                          const isSam    = i === 5
                          const isToday  = iso === today
                          const isFutur  = iso > today
                          const entry    = byDate.get(iso)
                          const clickable = inMonth && !ferie && !isFutur

                          return (
                            <td
                              key={iso}
                              onClick={clickable ? () => ouvrirEdit(iso) : undefined}
                              title={clickable && !entry ? 'Cliquer pour saisir' : undefined}
                              style={{ height: '52px' }}
                              className={[
                                'border-r border-marine-100 text-center align-middle relative px-1',
                                !inMonth              ? 'bg-slate-50/50'  : '',
                                isSam && inMonth      ? 'bg-slate-100/70' : '',
                                isToday               ? '!bg-orange-50 border-l-2 !border-l-orange-400' : '',
                                ferie                 ? '!bg-slate-100'   : '',
                                clickable             ? 'cursor-pointer hover:bg-orange-50/60 transition-colors' : '',
                              ].filter(Boolean).join(' ')}
                            >
                              {ferie ? (
                                <span className="text-xs text-slate-400 italic">férié</span>
                              ) : inMonth && entry?.heures_travaillees != null ? (
                                <span className={`font-bold text-base ${isToday ? 'text-orange-600' : 'text-marine-800'}`}>
                                  {fmt(entry.heures_travaillees)}
                                </span>
                              ) : inMonth && !isFutur ? (
                                <span className="text-marine-200 text-lg leading-none select-none">·</span>
                              ) : null}

                              {/* Point indicateur "aujourd'hui" */}
                              {isToday && !ferie && (
                                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-orange-500" />
                              )}
                            </td>
                          )
                        })}

                        {/* Total semaine */}
                        <td className="px-3 py-0 text-center font-bold border-x border-marine-200 bg-marine-50">
                          {weekHeures > 0
                            ? <span className="text-marine-800 text-base">{fmt(weekHeures)}</span>
                            : <span className="text-marine-300 font-normal">0</span>
                          }
                        </td>

                        {/* Pointes bateaux */}
                        <td className="px-3 py-2 border-r border-marine-100 min-w-40">
                          <div className="flex flex-wrap gap-1">
                            {weekPointes.map((b, idx) => (
                              <span key={idx} className="inline-flex items-center gap-1 bg-marine-100 text-marine-700 px-2 py-0.5 rounded text-xs font-medium">
                                ⛵ {b.nom_bateau}{b.panier_repas ? ' 🧺' : ''}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Heures à récupérer */}
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

                {/* Ligne de totaux */}
                <tfoot>
                  <tr className="border-t-2 border-marine-300 bg-marine-100 font-bold">
                    <td colSpan={8} className="px-4 py-3 text-right text-marine-500 text-xs uppercase tracking-wide">
                      Total du mois
                    </td>
                    <td className="px-3 py-3 text-center border-x border-marine-200 bg-marine-200/50">
                      <div className="text-marine-700 text-xs font-semibold">Total pointes</div>
                      <div className="text-marine-800 text-base font-black">{totalPointes}</div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="text-marine-700 text-xs font-semibold">Total heures à récupérer</div>
                      <div className={`text-base font-black ${totalRecup > 0 ? 'text-success-600' : totalRecup < 0 ? 'text-danger-600' : 'text-marine-400'}`}>
                        {totalRecup !== 0 ? `${totalRecup > 0 ? '+' : ''}${fmt(totalRecup)}` : '0'}
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* ── Récap compact ── */}
          {entries.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-2xl p-4 border border-marine-100 text-center shadow-sm">
                <p className="text-marine-500 text-xs uppercase tracking-wide mb-1">Jours saisis</p>
                <p className="text-marine-800 text-2xl font-bold">{entries.length}</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-marine-100 text-center shadow-sm">
                <p className="text-marine-500 text-xs uppercase tracking-wide mb-1">Heures totales</p>
                <p className="text-marine-800 text-2xl font-bold">{fmt(totalHeures)}h</p>
              </div>
              <div className={`rounded-2xl p-4 border text-center shadow-sm ${totalRecup >= 0 ? 'bg-success-100 border-success-600/20' : 'bg-danger-100 border-danger-600/20'}`}>
                <p className="text-marine-500 text-xs uppercase tracking-wide mb-1">Solde récup.</p>
                <p className={`text-2xl font-bold ${totalRecup >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                  {totalRecup > 0 ? '+' : ''}{fmt(totalRecup)}h
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="bg-marine-900 text-marine-100 text-center py-4 text-sm mt-4">
        © {new Date().getFullYear()} Atlantique Sellerie — Usage interne
      </footer>

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

            {/* Corps */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

              {/* Heures travaillées */}
              <div>
                <label className="block text-marine-700 font-bold mb-2">⏱️ Heures travaillées</label>
                <div className="flex items-center gap-3">
                  <input type="number" step="0.25" min="0" max="24"
                    value={editState.heuresTravaillees}
                    onChange={e => setEditState(p => p ? { ...p, heuresTravaillees: e.target.value } : p)}
                    placeholder="Ex : 7.5"
                    className="w-28 border-2 border-marine-200 rounded-xl px-4 py-3 text-marine-900 text-xl text-center focus:border-orange-500 focus:outline-none transition-colors"
                  />
                  <span className="text-marine-600 font-semibold">heures</span>
                </div>
                <p className="text-xs text-marine-400 mt-1">Exemples : 7, 7.5, 8.25</p>
              </div>

              {/* Récupération */}
              <div>
                <label className="block text-marine-700 font-bold mb-3">📊 Récupération d&apos;heures</label>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {([
                    { val: '+' as SensRecup, icon: '+', label: 'À récupérer', sub: 'heures en plus',   active: 'border-success-600 bg-success-100 text-success-600' },
                    { val: '0' as SensRecup, icon: '=', label: 'Normal',       sub: 'journée standard', active: 'border-marine-400 bg-marine-100 text-marine-700'    },
                    { val: '-' as SensRecup, icon: '−', label: 'À rattraper',  sub: 'parti plus tôt',  active: 'border-danger-600 bg-danger-100 text-danger-600'   },
                  ]).map(opt => (
                    <button key={opt.val} type="button"
                      onClick={() => setEditState(p => p ? { ...p, sensRecup: opt.val } : p)}
                      className={`border-2 rounded-xl p-3 text-center transition-all ${editState.sensRecup === opt.val ? opt.active : 'border-marine-200 bg-white text-marine-400 hover:bg-marine-50'}`}>
                      <div className="text-2xl font-black leading-none">{opt.icon}</div>
                      <div className="text-xs font-bold mt-1">{opt.label}</div>
                      <div className="text-xs opacity-60 mt-0.5 leading-tight hidden sm:block">{opt.sub}</div>
                    </button>
                  ))}
                </div>
                {editState.sensRecup !== '0' && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-xl font-black w-6 text-center ${editState.sensRecup === '+' ? 'text-success-600' : 'text-danger-600'}`}>
                      {editState.sensRecup === '+' ? '+' : '−'}
                    </span>
                    <input type="number" step="0.25" min="0"
                      value={editState.valeurRecup}
                      onChange={e => setEditState(p => p ? { ...p, valeurRecup: e.target.value } : p)}
                      placeholder="0"
                      className="w-24 border-2 border-marine-200 rounded-xl px-3 py-2.5 text-marine-900 text-lg text-center focus:border-orange-500 focus:outline-none"
                    />
                    <span className="text-marine-600">heures</span>
                  </div>
                )}
              </div>

              {/* Pointes bateau */}
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
                          <span className="text-sm font-medium whitespace-nowrap text-marine-700">🧺 Panier</span>
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
