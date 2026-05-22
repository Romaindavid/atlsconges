'use client'

import { useState } from 'react'
import Link from 'next/link'
import { getFeuillesMois, sauvegarderJournee } from '@/app/temps/actions'
import type { JourneeEntry } from '@/app/temps/actions'

type Employe = { id: string; nom: string; prenom: string }
type Props = {
  employe: Employe
  entriesInitiales: JourneeEntry[]
  moisInitial: number
  anneeInitiale: number
}

const MOIS_NOMS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]
const JOURS_COURTS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

type SensRecup = '+' | '-' | '0'
type EditPointe = { uid: number; nom: string; panier: boolean }

type EditState = {
  date: string
  heuresTravaillees: string
  sensRecup: SensRecup
  valeurRecup: string
  pointes: EditPointe[]
}

let uidSeq = 1

function getJoursOuvres(annee: number, mois: number): Date[] {
  const days: Date[] = []
  const d = new Date(annee, mois - 1, 1)
  while (d.getMonth() === mois - 1) {
    if (d.getDay() !== 0 && d.getDay() !== 6) days.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return days
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dateToISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function labelDate(d: Date) {
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function FeuilleTemps({ employe, entriesInitiales, moisInitial, anneeInitiale }: Props) {
  const [mois, setMois] = useState(moisInitial)
  const [annee, setAnnee] = useState(anneeInitiale)
  const [entries, setEntries] = useState<JourneeEntry[]>(entriesInitiales)
  const [loadingMois, setLoadingMois] = useState(false)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  const today = todayISO()
  const joursOuvres = getJoursOuvres(annee, mois)

  const totalHeures = entries.reduce((s, e) => s + (e.heures_travaillees ?? 0), 0)
  const totalRecup = entries.reduce((s, e) => s + (e.heures_a_recuperer ?? 0), 0)

  function getEntry(iso: string) {
    return entries.find((e) => e.date_journee === iso)
  }

  async function changerMois(delta: number) {
    let m = mois + delta
    let a = annee
    if (m > 12) { m = 1; a++ }
    if (m < 1) { m = 12; a-- }
    setLoadingMois(true)
    const data = await getFeuillesMois(employe.nom, employe.prenom, m, a)
    setMois(m)
    setAnnee(a)
    setEntries(data)
    setLoadingMois(false)
  }

  function ouvrirEdit(iso: string) {
    const entry = getEntry(iso)
    const recup = entry?.heures_a_recuperer ?? 0
    setEditState({
      date: iso,
      heuresTravaillees: entry?.heures_travaillees != null ? String(entry.heures_travaillees) : '',
      sensRecup: recup > 0 ? '+' : recup < 0 ? '-' : '0',
      valeurRecup: recup !== 0 ? String(Math.abs(recup)) : '',
      pointes: (entry?.pointes_bateaux ?? []).map((b) => ({
        uid: uidSeq++,
        nom: b.nom_bateau,
        panier: b.panier_repas,
      })),
    })
    setSaveMsg(null)
  }

  function addPointe() {
    setEditState((prev) =>
      prev ? { ...prev, pointes: [...prev.pointes, { uid: uidSeq++, nom: '', panier: false }] } : prev
    )
  }

  function removePointe(uid: number) {
    setEditState((prev) =>
      prev ? { ...prev, pointes: prev.pointes.filter((p) => p.uid !== uid) } : prev
    )
  }

  function updatePointe(uid: number, field: 'nom' | 'panier', value: string | boolean) {
    setEditState((prev) =>
      prev
        ? { ...prev, pointes: prev.pointes.map((p) => (p.uid === uid ? { ...p, [field]: value } : p)) }
        : prev
    )
  }

  async function handleSave() {
    if (!editState) return
    setSaving(true)
    setSaveMsg(null)

    const valRaw = parseFloat(editState.valeurRecup) || 0
    const heuresARecuperer =
      editState.sensRecup === '+' ? valRaw : editState.sensRecup === '-' ? -valRaw : 0

    const res = await sauvegarderJournee({
      nom: employe.nom,
      prenom: employe.prenom,
      date_journee: editState.date,
      heures_travaillees: editState.heuresTravaillees ? parseFloat(editState.heuresTravaillees) : null,
      heures_a_recuperer: heuresARecuperer,
      pointes_bateaux: editState.pointes
        .filter((p) => p.nom.trim())
        .map((p) => ({ nom_bateau: p.nom, panier_repas: p.panier })),
    })

    if (res.success) {
      const data = await getFeuillesMois(employe.nom, employe.prenom, mois, annee)
      setEntries(data)
      setSaveMsg('✅ Enregistré')
      setTimeout(() => setEditState(null), 700)
    } else {
      setSaveMsg(`⚠️ ${res.message}`)
    }
    setSaving(false)
  }

  return (
    <div className="min-h-screen flex flex-col bg-marine-50">
      {/* Header */}
      <header className="bg-marine-800 py-3 px-4 shadow-lg">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="ATLS" className="h-10 w-10 rounded-lg flex-shrink-0" />
            <span className="text-marine-100 text-sm font-medium hidden sm:block">
              {employe.prenom} {employe.nom}
            </span>
          </div>
          <Link
            href="/"
            className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-2.5 rounded-xl transition-colors shadow-md text-sm"
          >
            ← Accueil
          </Link>
        </div>
      </header>

      <main className="flex-1 py-6 px-4">
        <div className="max-w-3xl mx-auto space-y-5">

          {/* Navigation mois + bouton absence */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => changerMois(-1)}
                disabled={loadingMois}
                className="p-2.5 rounded-xl bg-white border-2 border-marine-200 hover:bg-marine-100 transition-colors disabled:opacity-50"
                aria-label="Mois précédent"
              >
                <svg className="w-4 h-4 text-marine-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-marine-800 text-lg font-bold w-40 text-center">
                {MOIS_NOMS[mois - 1]} {annee}
              </h1>
              <button
                onClick={() => changerMois(1)}
                disabled={loadingMois}
                className="p-2.5 rounded-xl bg-white border-2 border-marine-200 hover:bg-marine-100 transition-colors disabled:opacity-50"
                aria-label="Mois suivant"
              >
                <svg className="w-4 h-4 text-marine-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <Link
              href="/absence"
              className="flex items-center gap-2 bg-white border-2 border-marine-200 hover:border-orange-500 hover:text-orange-600 text-marine-700 font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm whitespace-nowrap"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Demander une absence
            </Link>
          </div>

          {/* Tableau mensuel */}
          <div className="bg-white rounded-2xl shadow-sm border border-marine-100 overflow-hidden">

            {/* En-tête colonnes */}
            <div className="hidden sm:grid sm:grid-cols-[120px_80px_100px_1fr_100px] gap-2 px-4 py-2 bg-marine-50 border-b border-marine-100 text-marine-500 text-xs font-semibold uppercase tracking-wide">
              <span>Jour</span>
              <span className="text-center">Heures</span>
              <span className="text-center">Récup.</span>
              <span>Bateaux</span>
              <span></span>
            </div>

            {loadingMois ? (
              <div className="py-16 text-center text-marine-400">Chargement…</div>
            ) : (
              <div className="divide-y divide-marine-100">
                {joursOuvres.map((jour) => {
                  const iso = dateToISO(jour)
                  const entry = getEntry(iso)
                  const isToday = iso === today
                  const isFutur = iso > today

                  return (
                    <div
                      key={iso}
                      className={`flex flex-wrap sm:grid sm:grid-cols-[120px_80px_100px_1fr_100px] items-center gap-2 px-4 py-3 ${
                        isToday
                          ? 'bg-orange-50 border-l-4 border-l-orange-500'
                          : isFutur
                          ? 'opacity-40'
                          : ''
                      }`}
                    >
                      {/* Date */}
                      <div className="w-24 sm:w-auto flex-shrink-0">
                        <span className={`text-sm font-semibold ${isToday ? 'text-orange-600' : 'text-marine-800'}`}>
                          {JOURS_COURTS[jour.getDay()]} {jour.getDate()}
                        </span>
                        {isToday && (
                          <div className="text-xs text-orange-500 font-normal leading-none mt-0.5">
                            Aujourd&apos;hui
                          </div>
                        )}
                      </div>

                      {/* Heures travaillées */}
                      <div className="sm:text-center">
                        {entry?.heures_travaillees != null ? (
                          <span className="text-marine-800 font-bold text-sm">
                            {entry.heures_travaillees}h
                          </span>
                        ) : (
                          <span className="text-marine-300 text-sm">—</span>
                        )}
                      </div>

                      {/* Récupération */}
                      <div className="sm:text-center">
                        {entry && entry.heures_a_recuperer !== 0 ? (
                          <span
                            className={`text-sm font-bold ${
                              entry.heures_a_recuperer > 0 ? 'text-success-600' : 'text-danger-600'
                            }`}
                          >
                            {entry.heures_a_recuperer > 0 ? '+' : ''}
                            {entry.heures_a_recuperer}h
                          </span>
                        ) : (
                          <span className="text-marine-300 text-sm">—</span>
                        )}
                      </div>

                      {/* Bateaux */}
                      <div className="flex flex-wrap gap-1.5 min-w-0">
                        {(entry?.pointes_bateaux ?? []).map((b) => (
                          <span
                            key={b.id}
                            className="inline-flex items-center gap-1 bg-marine-100 text-marine-700 px-2 py-0.5 rounded-lg text-xs font-medium"
                          >
                            ⛵ {b.nom_bateau}
                            {b.panier_repas && <span title="Panier repas">🧺</span>}
                          </span>
                        ))}
                      </div>

                      {/* Bouton action */}
                      {!isFutur && (
                        <div className="ml-auto sm:ml-0 flex justify-end">
                          <button
                            onClick={() => ouvrirEdit(iso)}
                            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                              entry
                                ? 'text-marine-600 bg-marine-100 hover:bg-marine-200'
                                : isToday
                                ? 'text-white bg-orange-500 hover:bg-orange-600 shadow-sm'
                                : 'text-marine-500 bg-marine-50 border border-marine-200 hover:bg-marine-100'
                            }`}
                          >
                            {entry ? '✏️ Modifier' : '+ Saisir'}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Récap du mois */}
          {entries.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-2xl p-4 border border-marine-100 text-center shadow-sm">
                <p className="text-marine-500 text-xs uppercase tracking-wide mb-1">Jours saisis</p>
                <p className="text-marine-800 text-2xl font-bold">{entries.length}</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-marine-100 text-center shadow-sm">
                <p className="text-marine-500 text-xs uppercase tracking-wide mb-1">Heures</p>
                <p className="text-marine-800 text-2xl font-bold">{totalHeures.toFixed(1)}h</p>
              </div>
              <div
                className={`rounded-2xl p-4 border text-center shadow-sm ${
                  totalRecup >= 0
                    ? 'bg-success-100 border-success-600/20'
                    : 'bg-danger-100 border-danger-600/20'
                }`}
              >
                <p className="text-marine-500 text-xs uppercase tracking-wide mb-1">Solde</p>
                <p
                  className={`text-2xl font-bold ${
                    totalRecup >= 0 ? 'text-success-600' : 'text-danger-600'
                  }`}
                >
                  {totalRecup > 0 ? '+' : ''}
                  {totalRecup.toFixed(1)}h
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="bg-marine-900 text-marine-100 text-center py-4 text-sm mt-4">
        © {new Date().getFullYear()} Atlantique Sellerie — Usage interne
      </footer>

      {/* ===== MODAL SAISIE JOURNÉE ===== */}
      {editState && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 px-0 sm:px-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[92vh] flex flex-col">

            {/* En-tête */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-marine-100 flex-shrink-0">
              <h2 className="text-marine-800 font-bold text-lg capitalize">
                {labelDate(new Date(editState.date + 'T12:00:00'))}
              </h2>
              <button
                onClick={() => setEditState(null)}
                className="p-2 text-marine-400 hover:text-marine-800 hover:bg-marine-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Corps scrollable */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

              {/* ── Heures travaillées ── */}
              <div>
                <label className="block text-marine-700 font-bold mb-2">
                  ⏱️ Heures travaillées
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    max="24"
                    value={editState.heuresTravaillees}
                    onChange={(e) =>
                      setEditState((p) => p ? { ...p, heuresTravaillees: e.target.value } : p)
                    }
                    placeholder="Ex : 7.5"
                    className="w-28 border-2 border-marine-200 rounded-xl px-4 py-3 text-marine-900 text-xl text-center focus:border-orange-500 focus:outline-none transition-colors"
                  />
                  <span className="text-marine-600 font-semibold">heures</span>
                </div>
                <p className="text-xs text-marine-400 mt-1">Exemples : 7, 7.5, 8.25</p>
              </div>

              {/* ── Récupération d'heures ── */}
              <div>
                <label className="block text-marine-700 font-bold mb-3">
                  📊 Récupération d&apos;heures
                </label>

                {/* 3 boutons +/0/- */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {(
                    [
                      {
                        val: '+' as SensRecup,
                        icon: '+',
                        label: 'À récupérer',
                        sub: "j'ai fait des heures en plus",
                        active: 'border-success-600 bg-success-100 text-success-600',
                      },
                      {
                        val: '0' as SensRecup,
                        icon: '=',
                        label: 'Normal',
                        sub: 'journée standard',
                        active: 'border-marine-500 bg-marine-100 text-marine-700',
                      },
                      {
                        val: '-' as SensRecup,
                        icon: '−',
                        label: 'À rattraper',
                        sub: 'je suis parti plus tôt',
                        active: 'border-danger-600 bg-danger-100 text-danger-600',
                      },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() =>
                        setEditState((p) => p ? { ...p, sensRecup: opt.val } : p)
                      }
                      className={`border-2 rounded-xl p-3 text-center transition-all ${
                        editState.sensRecup === opt.val
                          ? opt.active
                          : 'border-marine-200 bg-white text-marine-400 hover:bg-marine-50'
                      }`}
                    >
                      <div className="text-xl font-black leading-none">{opt.icon}</div>
                      <div className="text-xs font-bold mt-1">{opt.label}</div>
                      <div className="text-xs text-marine-400 mt-0.5 leading-tight hidden sm:block">
                        {opt.sub}
                      </div>
                    </button>
                  ))}
                </div>

                {editState.sensRecup !== '0' && (
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xl font-black w-6 text-center ${
                        editState.sensRecup === '+' ? 'text-success-600' : 'text-danger-600'
                      }`}
                    >
                      {editState.sensRecup === '+' ? '+' : '−'}
                    </span>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      value={editState.valeurRecup}
                      onChange={(e) =>
                        setEditState((p) => p ? { ...p, valeurRecup: e.target.value } : p)
                      }
                      placeholder="0"
                      className="w-24 border-2 border-marine-200 rounded-xl px-3 py-2.5 text-marine-900 text-lg text-center focus:border-orange-500 focus:outline-none transition-colors"
                    />
                    <span className="text-marine-600">heures</span>
                  </div>
                )}
              </div>

              {/* ── Pointes bateau ── */}
              <div>
                <label className="block text-marine-700 font-bold mb-3">
                  ⛵ Pointes bateau
                </label>

                {editState.pointes.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {editState.pointes.map((pointe) => (
                      <div
                        key={pointe.uid}
                        className="flex items-center gap-2 bg-marine-50 rounded-xl p-3"
                      >
                        <input
                          type="text"
                          value={pointe.nom}
                          onChange={(e) => updatePointe(pointe.uid, 'nom', e.target.value)}
                          placeholder="Nom du bateau"
                          className="flex-1 border-2 border-marine-200 rounded-lg px-3 py-2 text-marine-900 text-base placeholder:text-marine-300 focus:border-orange-500 focus:outline-none transition-colors bg-white"
                        />
                        <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0">
                          <input
                            type="checkbox"
                            checked={pointe.panier}
                            onChange={(e) => updatePointe(pointe.uid, 'panier', e.target.checked)}
                            className="w-4 h-4 accent-orange-500 cursor-pointer"
                          />
                          <span className="text-sm text-marine-700 font-medium whitespace-nowrap">
                            🧺 Panier repas
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() => removePointe(pointe.uid)}
                          className="p-1.5 text-danger-600 hover:bg-danger-100 rounded-lg transition-colors flex-shrink-0"
                          aria-label="Supprimer"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={addPointe}
                  className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-marine-300 hover:border-orange-400 hover:text-orange-600 text-marine-600 font-medium px-4 py-3 rounded-xl transition-colors text-sm"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Ajouter une pointe
                </button>
              </div>

              {/* Feedback */}
              {saveMsg && (
                <div
                  className={`p-3 rounded-xl text-sm font-medium text-center ${
                    saveMsg.startsWith('✅')
                      ? 'bg-success-100 text-success-600'
                      : 'bg-danger-100 text-danger-600'
                  }`}
                >
                  {saveMsg}
                </div>
              )}
            </div>

            {/* Boutons en pied fixe */}
            <div className="flex gap-3 px-6 py-4 border-t border-marine-100 flex-shrink-0">
              <button
                onClick={() => setEditState(null)}
                className="flex-1 border-2 border-marine-200 text-marine-600 hover:bg-marine-50 py-3 rounded-xl font-semibold transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white py-3 rounded-xl font-bold transition-colors"
              >
                {saving ? 'Enregistrement…' : '✓ Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
