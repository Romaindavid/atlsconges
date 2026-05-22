'use client'

import { useState, useTransition } from 'react'
import type { AbsenceAvecStatut, FeuilleTempsAvecBateaux, Employe } from '@/app/admin/actions'
import { updateAbsenceStatut, logoutAdmin, createEmploye, updateEmploye, deleteEmploye } from '@/app/admin/actions'
import { formatDateFR } from '@/lib/calcul-jours'
import { useRouter } from 'next/navigation'

// ─── Helpers calendrier / XLS ────────────────────────────────────────────────
function daysInMonth(m: number, a: number) { return new Date(a, m, 0).getDate() }
function isoDay(a: number, m: number, d: number) {
  return `${a}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
}
function isWeekend(a: number, m: number, d: number) {
  const dow = new Date(a, m - 1, d).getDay(); return dow === 0 || dow === 6
}
function absColor(type: string) {
  if (type === 'Congés payés') return 'bg-marine-600 text-white'
  if (type === 'Maladie')      return 'bg-warning-600 text-white'
  return                              'bg-orange-500 text-white'
}
function absAbbr(type: string) {
  if (type === 'Congés payés') return 'CP'
  if (type === 'Maladie')      return 'M'
  return 'A'
}

type Props = {
  absences: AbsenceAvecStatut[]
  absencesCalendrier: AbsenceAvecStatut[]
  feuillesTemps: FeuilleTempsAvecBateaux[]
  feuillesTempsCalendrier: FeuilleTempsAvecBateaux[]
  employes: Employe[]
  moisSelectionne: number
  anneeSelectionnee: number
  salarieSearch: string
}

const MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
]

const STATUT_CONFIG = {
  en_attente: { label: 'En attente', bg: 'bg-warning-100', text: 'text-warning-600', dot: 'bg-warning-600' },
  accorde: { label: 'Accordé', bg: 'bg-success-100', text: 'text-success-600', dot: 'bg-success-600' },
  refuse: { label: 'Refusé', bg: 'bg-danger-100', text: 'text-danger-600', dot: 'bg-danger-600' },
}

export default function AdminDashboard({
  absences,
  absencesCalendrier,
  feuillesTemps,
  feuillesTempsCalendrier,
  employes,
  moisSelectionne,
  anneeSelectionnee,
  salarieSearch,
}: Props) {
  const router = useRouter()
  const [onglet, setOnglet] = useState<'absences' | 'temps' | 'employes'>('absences')
  const [isPending, startTransition] = useTransition()

  // --- État gestion employés ---
  const [empModal, setEmpModal] = useState<{ mode: 'create' | 'edit'; employe?: Employe } | null>(null)
  const [empNom, setEmpNom] = useState('')
  const [empPrenom, setEmpPrenom] = useState('')
  const [empErreur, setEmpErreur] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // État local pour les filtres
  const [mois, setMois] = useState(moisSelectionne)
  const [annee, setAnnee] = useState(anneeSelectionnee)
  const [recherche, setRecherche] = useState(salarieSearch)

  // Modal décision absence
  const [absenceEditId, setAbsenceEditId] = useState<string | null>(null)
  const [statutEdit, setStatutEdit] = useState<'accorde' | 'refuse' | 'en_attente'>('en_attente')
  const [commentaireEdit, setCommentaireEdit] = useState('')
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  function appliquerFiltres() {
    const params = new URLSearchParams()
    params.set('mois', String(mois))
    params.set('annee', String(annee))
    if (recherche) params.set('q', recherche)
    router.push(`/admin?${params.toString()}`)
  }

  function ouvrirModal(absence: AbsenceAvecStatut) {
    setAbsenceEditId(absence.id)
    setStatutEdit(absence.statut)
    setCommentaireEdit(absence.commentaire_direction || '')
    setSaveMsg(null)
  }

  async function sauvegarderDecision() {
    if (!absenceEditId) return
    startTransition(async () => {
      const res = await updateAbsenceStatut(absenceEditId, statutEdit, commentaireEdit)
      setSaveMsg(res.message)
      if (res.success) {
        setTimeout(() => {
          setAbsenceEditId(null)
          router.refresh()
        }, 800)
      }
    })
  }

  async function handleLogout() {
    await logoutAdmin()
    router.push('/admin')
    router.refresh()
  }

  // --- Fonctions gestion employés ---
  function ouvrirCreationEmploye() {
    setEmpNom('')
    setEmpPrenom('')
    setEmpErreur('')
    setEmpModal({ mode: 'create' })
  }

  function ouvrirEditionEmploye(emp: Employe) {
    setEmpNom(emp.nom)
    setEmpPrenom(emp.prenom)
    setEmpErreur('')
    setEmpModal({ mode: 'edit', employe: emp })
  }

  async function sauvegarderEmploye() {
    setEmpErreur('')
    startTransition(async () => {
      let res
      if (empModal?.mode === 'create') {
        res = await createEmploye(empNom, empPrenom)
      } else if (empModal?.employe) {
        res = await updateEmploye(empModal.employe.id, empNom, empPrenom)
      } else return

      if (res.success) {
        setEmpModal(null)
        router.refresh()
      } else {
        setEmpErreur(res.message)
      }
    })
  }

  async function confirmerSuppression(id: string) {
    startTransition(async () => {
      await deleteEmploye(id)
      setDeleteConfirmId(null)
      router.refresh()
    })
  }

  // ── Export XLS ──────────────────────────────────────────────────────────────
  async function exporterXLS() {
    const XLSX = await import('xlsx')

    // Grouper feuilles et absences par employé (données non filtrées)
    type FTMap = Map<string, FeuilleTempsAvecBateaux[]>
    const byEmp: FTMap = new Map()
    feuillesTempsCalendrier.forEach(f => {
      const k = `${f.nom}||${f.prenom}`
      if (!byEmp.has(k)) byEmp.set(k, [])
      byEmp.get(k)!.push(f)
    })
    type AMap = Map<string, AbsenceAvecStatut[]>
    const absEmpMap: AMap = new Map()
    absencesCalendrier.forEach(a => {
      const k = `${a.nom}||${a.prenom}`
      if (!absEmpMap.has(k)) absEmpMap.set(k, [])
      absEmpMap.get(k)!.push(a)
    })

    const fmtDate = (iso: string) => {
      if (!iso) return ''
      const [a, m, d] = iso.split('-')
      return `${d}/${m}/${a}`
    }
    const fmtPeriode = (abs: AbsenceAvecStatut[]) =>
      abs.map(a => `${fmtDate(a.date_debut)}→${fmtDate(a.date_fin)}`).join('; ')

    const rows = employes.map(emp => {
      const k = `${emp.nom}||${emp.prenom}`
      const feuilles = byEmp.get(k) || []
      const absEmp   = absEmpMap.get(k) || []

      const pointes = feuilles.reduce((s, f) => s + (f.pointes_bateaux?.length ?? 0), 0)
      const paniers = feuilles.reduce((s, f) =>
        s + (f.pointes_bateaux?.filter(b => b.panier_repas).length ?? 0), 0)

      const cp      = absEmp.filter(a => a.type_absence === 'Congés payés')
      const maladie = absEmp.filter(a => a.type_absence === 'Maladie')
      const autres  = absEmp.filter(a => a.type_absence !== 'Congés payés' && a.type_absence !== 'Maladie')

      const commentaires: string[] = []
      feuilles.filter(f => f.commentaire).forEach(f =>
        commentaires.push(`${fmtDate(f.date_journee)}: ${f.commentaire}`)
      )
      absEmp.forEach(a => {
        if (a.commentaire_salarie)
          commentaires.push(`[${a.type_absence} ${fmtDate(a.date_debut)}→${fmtDate(a.date_fin)}] ${a.commentaire_salarie}`)
      })

      return {
        'NOM':            emp.nom,
        'PRENOM':         emp.prenom,
        'NBRE HEURES':    151.67,
        'TH':             '',
        'H SUP 25':       '',
        'H SUP 50':       '',
        'POINTES AVANT':  pointes || '',
        'PRIMES DIV':     '',
        'REMB TEL':       2,
        'PANIERS':        paniers || '',
        'ACOMPTE':        '',
        'CP (nb j.)':     cp.reduce((s, a) => s + a.jours_ouvres, 0) || '',
        'CP (dates)':     fmtPeriode(cp),
        'MALADIE (nb j.)': maladie.reduce((s, a) => s + a.jours_ouvres, 0) || '',
        'MALADIE (dates)': fmtPeriode(maladie),
        'AUTRES (nb j.)': autres.reduce((s, a) => s + a.jours_ouvres, 0) || '',
        'AUTRES (dates)': fmtPeriode(autres),
        'COMMENTAIRES':   commentaires.join(' | '),
      }
    })

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `Paie ${MOIS[mois - 1]} ${annee}`)
    XLSX.writeFile(wb, `ATLS-Paie-${MOIS[mois - 1]}-${annee}.xlsx`)
  }

  // Calculs récap temps
  const totalHeuresTravaillees = feuillesTemps.reduce(
    (acc, f) => acc + (f.heures_travaillees ?? 0), 0
  )
  const totalHeuresARecuperer = feuillesTemps.reduce(
    (acc, f) => acc + (f.heures_a_recuperer ?? 0), 0
  )

  const anneeOptions = []
  for (let y = anneeSelectionnee - 2; y <= anneeSelectionnee + 1; y++) {
    anneeOptions.push(y)
  }

  return (
    <div className="min-h-screen bg-marine-50">
      {/* Header admin */}
      <header className="bg-marine-800 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="ATLS" className="h-10 w-10 rounded-lg flex-shrink-0" />
            <div>
              <h1 className="text-white text-xl font-bold">🔒 Interface Direction</h1>
              <p className="text-marine-200 text-sm">Atlantique Sellerie</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-marine-200 hover:text-white text-sm border border-marine-600 hover:border-marine-400 px-3 py-2 rounded-lg transition-colors"
          >
            Déconnexion
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* Filtres */}
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-6 border border-marine-100">
          <h2 className="text-marine-700 font-semibold mb-4 text-sm uppercase tracking-wide">Filtres</h2>
          <div className="flex flex-wrap gap-3 items-end">
            {/* Mois */}
            <div>
              <label className="block text-marine-600 text-sm mb-1">Mois</label>
              <select
                value={mois}
                onChange={(e) => setMois(parseInt(e.target.value))}
                className="border-2 border-marine-200 rounded-xl px-3 py-2 text-marine-900 focus:border-orange-500 focus:outline-none"
              >
                {MOIS.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>

            {/* Année */}
            <div>
              <label className="block text-marine-600 text-sm mb-1">Année</label>
              <select
                value={annee}
                onChange={(e) => setAnnee(parseInt(e.target.value))}
                className="border-2 border-marine-200 rounded-xl px-3 py-2 text-marine-900 focus:border-orange-500 focus:outline-none"
              >
                {anneeOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Recherche salarié */}
            <div className="flex-1 min-w-48">
              <label className="block text-marine-600 text-sm mb-1">Nom / Prénom</label>
              <input
                type="text"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && appliquerFiltres()}
                placeholder="Rechercher un salarié..."
                className="w-full border-2 border-marine-200 rounded-xl px-3 py-2 text-marine-900 placeholder:text-marine-300 focus:border-orange-500 focus:outline-none"
              />
            </div>

            <button
              onClick={appliquerFiltres}
              className="bg-marine-700 hover:bg-marine-800 text-white px-5 py-2 rounded-xl font-medium transition-colors"
            >
              Appliquer
            </button>
          </div>
        </div>

        {/* Onglets */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setOnglet('absences')}
            className={`px-6 py-3 rounded-xl font-semibold text-base transition-colors ${
              onglet === 'absences'
                ? 'bg-marine-800 text-white shadow-md'
                : 'bg-white text-marine-700 hover:bg-marine-100 border border-marine-200'
            }`}
          >
            📅 Congés ({absences.length})
          </button>
          <button
            onClick={() => setOnglet('temps')}
            className={`px-6 py-3 rounded-xl font-semibold text-base transition-colors ${
              onglet === 'temps'
                ? 'bg-marine-800 text-white shadow-md'
                : 'bg-white text-marine-700 hover:bg-marine-100 border border-marine-200'
            }`}
          >
            ⏱️ Feuilles de temps ({feuillesTemps.length})
          </button>
          <button
            onClick={() => setOnglet('employes')}
            className={`px-6 py-3 rounded-xl font-semibold text-base transition-colors ${
              onglet === 'employes'
                ? 'bg-marine-800 text-white shadow-md'
                : 'bg-white text-marine-700 hover:bg-marine-100 border border-marine-200'
            }`}
          >
            👥 Employés ({employes.length})
          </button>
        </div>

        {/* ====== ONGLET ABSENCES ====== */}
        {onglet === 'absences' && (
          <div className="space-y-4">
            {absences.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 text-center text-marine-400 border border-marine-100">
                Aucune demande pour cette période.
              </div>
            ) : (
              absences.map((absence) => {
                const statut = STATUT_CONFIG[absence.statut]
                return (
                  <div
                    key={absence.id}
                    className="bg-white rounded-2xl shadow-sm border border-marine-100 overflow-hidden"
                  >
                    <div className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        {/* Info salarié */}
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <span className="text-marine-800 text-lg font-bold">
                              {absence.prenom} {absence.nom}
                            </span>
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${statut.bg} ${statut.text}`}>
                              <span className={`w-2 h-2 rounded-full ${statut.dot}`}></span>
                              {statut.label}
                            </span>
                          </div>
                          <p className="text-marine-600 text-sm">
                            <span className="font-medium">{absence.type_absence}</span>
                            {absence.type_absence_detail && ` — ${absence.type_absence_detail}`}
                          </p>
                        </div>

                        {/* Dates */}
                        <div className="text-right">
                          <p className="text-marine-700 font-semibold">
                            Du {formatDateFR(absence.date_debut)} au {formatDateFR(absence.date_fin)}
                          </p>
                          <p className="text-marine-500 text-sm">
                            {absence.jours_ouvres} jour{absence.jours_ouvres > 1 ? 's' : ''} ouvré{absence.jours_ouvres > 1 ? 's' : ''}
                          </p>
                          <p className="text-marine-400 text-xs mt-0.5">
                            Demande du {formatDateFR(absence.date_demande.split('T')[0])}
                          </p>
                        </div>
                      </div>

                      {/* Commentaire salarié */}
                      {absence.commentaire_salarie && (
                        <div className="mt-3 p-3 bg-marine-50 rounded-lg text-sm text-marine-600">
                          <span className="font-semibold">Commentaire salarié : </span>
                          {absence.commentaire_salarie}
                        </div>
                      )}

                      {/* Commentaire direction */}
                      {absence.commentaire_direction && (
                        <div className="mt-2 p-3 bg-warning-100 rounded-lg text-sm text-warning-600">
                          <span className="font-semibold">Note direction : </span>
                          {absence.commentaire_direction}
                        </div>
                      )}

                      {/* Bouton décision */}
                      <div className="mt-4">
                        <button
                          onClick={() => ouvrirModal(absence)}
                          className="bg-marine-100 hover:bg-marine-200 text-marine-700 font-medium px-4 py-2 rounded-xl text-sm transition-colors"
                        >
                          ✏️ Mettre à jour la décision
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ====== ONGLET FEUILLES DE TEMPS ====== */}
        {onglet === 'temps' && (
          <div className="space-y-4">

            {/* ── Calendrier absences équipe ── */}
            {(() => {
              const nJours = daysInMonth(mois, annee)
              const jours  = Array.from({ length: nJours }, (_, i) => i + 1)
              const joursLabel = jours.map(j => ({
                j,
                weekend: isWeekend(annee, mois, j),
                dow: new Date(annee, mois - 1, j).toLocaleDateString('fr-FR', { weekday: 'narrow' }),
              }))
              return (
                <div className="bg-white rounded-2xl border border-marine-100 overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-marine-100 bg-marine-50 gap-3 flex-wrap">
                    <h3 className="text-marine-700 font-bold text-sm">
                      📅 Absences équipe — {MOIS[mois - 1]} {annee}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-marine-500">
                      <span className="flex items-center gap-1"><span className="inline-block w-4 h-4 rounded bg-marine-600"></span> CP</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-4 h-4 rounded bg-warning-600"></span> Maladie</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-4 h-4 rounded bg-orange-500"></span> Autre</span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="text-xs border-collapse w-full">
                      <thead>
                        <tr>
                          <th className="sticky left-0 z-10 bg-marine-50 px-3 py-2 text-left text-marine-600 font-semibold min-w-36 border-r border-marine-100">
                            Salarié
                          </th>
                          {joursLabel.map(({ j, weekend, dow }) => (
                            <th key={j} className={`px-0 py-1 text-center w-7 ${weekend ? 'text-slate-400 bg-slate-50' : 'text-marine-600'}`}>
                              <div className="text-[10px] font-normal">{dow}</div>
                              <div className="font-bold">{j}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {employes.map(emp => (
                          <tr key={emp.id} className="border-t border-marine-100 hover:bg-marine-50/30">
                            <td className="sticky left-0 z-10 bg-white px-3 py-1.5 font-medium text-marine-800 whitespace-nowrap border-r border-marine-100">
                              {emp.prenom} {emp.nom}
                            </td>
                            {joursLabel.map(({ j, weekend }) => {
                              const ds = isoDay(annee, mois, j)
                              const ab = absencesCalendrier.find(a =>
                                a.nom === emp.nom && a.prenom === emp.prenom &&
                                a.statut !== 'refuse' &&
                                a.date_debut <= ds && a.date_fin >= ds
                              )
                              return (
                                <td key={j} className={`w-7 h-7 text-center p-0.5 ${weekend ? 'bg-slate-50/60' : ''}`}>
                                  {ab ? (
                                    <div
                                      className={`w-full h-full flex items-center justify-center rounded text-[10px] font-bold ${absColor(ab.type_absence)} ${ab.statut === 'en_attente' ? 'opacity-60' : ''}`}
                                      title={`${ab.type_absence}${ab.statut === 'en_attente' ? ' (en attente)' : ''}`}
                                    >
                                      {absAbbr(ab.type_absence)}
                                    </div>
                                  ) : weekend ? (
                                    <div className="w-full h-full bg-slate-100/60 rounded" />
                                  ) : null}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })()}

            {/* ── Bouton export XLS + récap ── */}
            <div className="flex justify-end">
              <button
                onClick={exporterXLS}
                className="flex items-center gap-2 bg-success-600 hover:bg-success-700 text-white font-bold px-5 py-2.5 rounded-xl transition-colors shadow-sm text-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Exporter XLS — {MOIS[mois - 1]} {annee}
              </button>
            </div>

            {/* Récap global */}
            {feuillesTemps.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2">
                <div className="bg-white rounded-2xl p-4 border border-marine-100 text-center">
                  <p className="text-marine-500 text-sm">Feuilles enregistrées</p>
                  <p className="text-marine-800 text-3xl font-bold mt-1">{feuillesTemps.length}</p>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-marine-100 text-center">
                  <p className="text-marine-500 text-sm">Total heures travaillées</p>
                  <p className="text-marine-800 text-3xl font-bold mt-1">{totalHeuresTravaillees.toFixed(2)}h</p>
                </div>
                <div className={`rounded-2xl p-4 border text-center ${totalHeuresARecuperer >= 0 ? 'bg-success-100 border-success-600/20' : 'bg-danger-100 border-danger-600/20'}`}>
                  <p className="text-marine-500 text-sm">Heures à récupérer (total)</p>
                  <p className={`text-3xl font-bold mt-1 ${totalHeuresARecuperer >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                    {totalHeuresARecuperer >= 0 ? '+' : ''}{totalHeuresARecuperer.toFixed(2)}h
                  </p>
                </div>
              </div>
            )}

            {feuillesTemps.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 text-center text-marine-400 border border-marine-100">
                Aucune feuille de temps pour cette période.
              </div>
            ) : (
              feuillesTemps.map((feuille) => (
                <div
                  key={feuille.id}
                  className="bg-white rounded-2xl shadow-sm border border-marine-100 overflow-hidden"
                >
                  <div className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      {/* Info */}
                      <div>
                        <p className="text-marine-800 text-lg font-bold">
                          {feuille.prenom} {feuille.nom}
                        </p>
                        <p className="text-marine-500 text-sm">
                          {formatDateFR(feuille.date_journee)}
                        </p>
                      </div>

                      {/* Heures */}
                      <div className="flex gap-4 text-center">
                        {feuille.heures_travaillees !== null && (
                          <div>
                            <p className="text-marine-500 text-xs">Travaillées</p>
                            <p className="text-marine-800 text-xl font-bold">{feuille.heures_travaillees}h</p>
                          </div>
                        )}
                        <div>
                          <p className="text-marine-500 text-xs">À récupérer</p>
                          <p className={`text-xl font-bold ${(feuille.heures_a_recuperer ?? 0) >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                            {(feuille.heures_a_recuperer ?? 0) >= 0 ? '+' : ''}{feuille.heures_a_recuperer ?? 0}h
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Pointés bateaux */}
                    {feuille.pointes_bateaux && feuille.pointes_bateaux.length > 0 && (
                      <div className="mt-3">
                        <p className="text-marine-600 text-sm font-semibold mb-2">⛵ Bateaux :</p>
                        <div className="flex flex-wrap gap-2">
                          {feuille.pointes_bateaux.map((b) => (
                            <span
                              key={b.id}
                              className="bg-marine-100 text-marine-700 px-3 py-1 rounded-lg text-sm font-medium"
                            >
                              {b.nom_bateau}{b.panier_repas && ' 🧺'}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ====== ONGLET EMPLOYÉS ====== */}
        {onglet === 'employes' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-marine-600 text-sm">{employes.length} employé{employes.length > 1 ? 's' : ''}</p>
              <button
                onClick={ouvrirCreationEmploye}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Ajouter un employé
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-marine-100 overflow-hidden">
              {employes.length === 0 ? (
                <p className="p-10 text-center text-marine-400">Aucun employé enregistré.</p>
              ) : (
                <table className="w-full">
                  <thead className="bg-marine-50 border-b border-marine-100">
                    <tr>
                      <th className="text-left px-5 py-3 text-marine-600 font-semibold text-sm">Nom</th>
                      <th className="text-left px-5 py-3 text-marine-600 font-semibold text-sm">Prénom</th>
                      <th className="px-5 py-3 text-right text-marine-600 font-semibold text-sm">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-marine-100">
                    {employes.map((emp) => (
                      <tr key={emp.id} className="hover:bg-marine-50 transition-colors">
                        <td className="px-5 py-4 text-marine-800 font-semibold">{emp.nom}</td>
                        <td className="px-5 py-4 text-marine-700">{emp.prenom}</td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => ouvrirEditionEmploye(emp)}
                              className="text-marine-600 hover:text-marine-800 hover:bg-marine-100 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                            >
                              ✏️ Modifier
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(emp.id)}
                              className="text-danger-600 hover:text-danger-700 hover:bg-danger-100 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                            >
                              🗑️ Supprimer
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ====== MODAL DÉCISION ABSENCE ====== */}
      {absenceEditId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-marine-800 text-xl font-bold mb-5">
              Décision sur la demande
            </h3>

            {saveMsg && (
              <div className="mb-4 p-3 bg-success-100 text-success-600 rounded-xl text-sm font-medium">
                ✅ {saveMsg}
              </div>
            )}

            {/* Décision */}
            <div className="mb-4">
              <label className="block text-marine-700 font-semibold mb-2">Décision</label>
              <div className="flex gap-2">
                {(['accorde', 'en_attente', 'refuse'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatutEdit(s)}
                    className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors ${
                      statutEdit === s
                        ? s === 'accorde'
                          ? 'bg-success-600 text-white'
                          : s === 'refuse'
                          ? 'bg-danger-600 text-white'
                          : 'bg-warning-600 text-white'
                        : 'bg-marine-100 text-marine-600 hover:bg-marine-200'
                    }`}
                  >
                    {STATUT_CONFIG[s].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Commentaire */}
            <div className="mb-5">
              <label className="block text-marine-700 font-semibold mb-2">
                Commentaire direction <span className="font-normal text-marine-400">(optionnel)</span>
              </label>
              <textarea
                value={commentaireEdit}
                onChange={(e) => setCommentaireEdit(e.target.value)}
                rows={3}
                placeholder="Ajouter une note pour le salarié..."
                className="w-full border-2 border-marine-200 rounded-xl px-4 py-3 text-marine-900 placeholder:text-marine-300 focus:border-orange-500 focus:outline-none transition-colors resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setAbsenceEditId(null)}
                className="flex-1 border-2 border-marine-200 text-marine-600 hover:bg-marine-50 py-3 rounded-xl font-medium transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={sauvegarderDecision}
                disabled={isPending}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white py-3 rounded-xl font-bold transition-colors"
              >
                {isPending ? 'Sauvegarde...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== MODAL EMPLOYÉ (créer / modifier) ====== */}
      {empModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-marine-800 text-xl font-bold mb-5">
              {empModal.mode === 'create' ? '➕ Nouvel employé' : '✏️ Modifier l\'employé'}
            </h3>

            {empErreur && (
              <div className="mb-4 p-3 bg-danger-100 text-danger-600 rounded-xl text-sm font-medium">
                ⚠️ {empErreur}
              </div>
            )}

            <div className="space-y-4 mb-5">
              <div>
                <label className="block text-marine-700 font-semibold mb-2">
                  Nom <span className="text-danger-600">*</span>
                </label>
                <input
                  type="text"
                  value={empNom}
                  onChange={(e) => setEmpNom(e.target.value)}
                  placeholder="Ex : DUPONT"
                  className="w-full border-2 border-marine-200 rounded-xl px-4 py-3 text-marine-900 text-lg placeholder:text-marine-300 focus:border-orange-500 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-marine-700 font-semibold mb-2">
                  Prénom <span className="text-danger-600">*</span>
                </label>
                <input
                  type="text"
                  value={empPrenom}
                  onChange={(e) => setEmpPrenom(e.target.value)}
                  placeholder="Ex : Jean"
                  className="w-full border-2 border-marine-200 rounded-xl px-4 py-3 text-marine-900 text-lg placeholder:text-marine-300 focus:border-orange-500 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setEmpModal(null)}
                className="flex-1 border-2 border-marine-200 text-marine-600 hover:bg-marine-50 py-3 rounded-xl font-medium transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={sauvegarderEmploye}
                disabled={isPending || !empNom.trim() || !empPrenom.trim()}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white py-3 rounded-xl font-bold transition-colors"
              >
                {isPending ? 'Sauvegarde...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== MODAL CONFIRMATION SUPPRESSION ====== */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <h3 className="text-marine-800 text-xl font-bold mb-2">Supprimer cet employé ?</h3>
            <p className="text-marine-500 text-sm mb-6">
              {(() => {
                const emp = employes.find(e => e.id === deleteConfirmId)
                return emp ? `${emp.prenom} ${emp.nom}` : ''
              })()}
              <br />Cette action est irréversible.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 border-2 border-marine-200 text-marine-600 hover:bg-marine-50 py-3 rounded-xl font-medium transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => confirmerSuppression(deleteConfirmId)}
                disabled={isPending}
                className="flex-1 bg-danger-600 hover:bg-danger-700 disabled:opacity-60 text-white py-3 rounded-xl font-bold transition-colors"
              >
                {isPending ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
