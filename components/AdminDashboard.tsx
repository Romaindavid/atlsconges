'use client'

import { useState, useTransition, useEffect } from 'react'
import type { AbsenceAvecStatut, FeuilleTempsAvecBateaux, Employe, JourFerieEntry, VacanceObligatoire } from '@/app/admin/actions'
import { updateAbsenceStatut, logoutAdmin, createEmploye, updateEmploye, deleteEmploye, updateSoldeDepart, setJourFerieOverride, setPinEmploye, setAnniversaireEmploye, createVacanceObligatoire, deleteVacanceObligatoire } from '@/app/admin/actions'
import { sauvegarderJournee } from '@/app/temps/actions'
import { isJourFerie, formatDateFR } from '@/lib/calcul-jours'
import { useRouter } from 'next/navigation'

// ─── Helpers calendrier / XLS ────────────────────────────────────────────────
let adminUidSeq = 1
function defaultHoursAdmin(iso: string): number {
  const dow = new Date(iso + 'T12:00:00').getDay()
  if (dow === 5) return 5
  if (dow === 6) return 0
  return 7.5
}
function parseFR(v: string) { return parseFloat(v.replace(',', '.')) || 0 }
function daysInMonth(m: number, a: number) { return new Date(a, m, 0).getDate() }
function isoDay(a: number, m: number, d: number) {
  return `${a}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
}
function isWeekend(a: number, m: number, d: number) {
  const dow = new Date(a, m - 1, d).getDay(); return dow === 0 || dow === 6
}
function absEmoji(type: string) {
  if (type === 'Congés payés') return '🏝️'
  if (type === 'Maladie')      return '🤮'
  return '😶'
}

type Props = {
  absences: AbsenceAvecStatut[]
  absencesCalendrier: AbsenceAvecStatut[]
  feuillesTemps: FeuilleTempsAvecBateaux[]
  feuillesTempsCalendrier: FeuilleTempsAvecBateaux[]
  employes: Employe[]
  joursFeriesInitiaux: JourFerieEntry[]
  vacancesInitiales: VacanceObligatoire[]
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
  joursFeriesInitiaux,
  vacancesInitiales,
  moisSelectionne,
  anneeSelectionnee,
  salarieSearch,
}: Props) {
  const router = useRouter()
  const [onglet, setOnglet] = useState<'absences' | 'temps' | 'feries' | 'employes'>('absences')
  const [joursFeries, setJoursFeries] = useState<JourFerieEntry[]>(joursFeriesInitiaux)
  const [vacances, setVacances] = useState<VacanceObligatoire[]>(vacancesInitiales)
  const [feriesErreur, setFeriesErreur] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // --- État gestion employés ---
  const [empModal, setEmpModal] = useState<{ mode: 'create' | 'edit'; employe?: Employe } | null>(null)
  const [empNom, setEmpNom] = useState('')
  const [empPrenom, setEmpPrenom] = useState('')
  const [empSoldeDepart, setEmpSoldeDepart] = useState('')
  const [empPin, setEmpPin] = useState('')
  const [empDateNaissance, setEmpDateNaissance] = useState('')
  const [empJourAnniv, setEmpJourAnniv] = useState('')
  const [empErreur, setEmpErreur] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // --- État vacances obligatoires ---
  const [vacDebut, setVacDebut] = useState('')
  const [vacFin, setVacFin]     = useState('')
  const [vacNom, setVacNom]     = useState('')
  const [vacMsg, setVacMsg]     = useState<string | null>(null)

  // Modal édition entrée employé (admin)
  type AdminEditPointe = { uid: number; nom: string; panier: boolean }
  type AdminEditState = {
    nom: string; prenom: string; date: string
    heuresEnPlus: string; heuresEnMoins: string; commentaire: string
    pointes: AdminEditPointe[]
  }
  const [adminEdit, setAdminEdit] = useState<AdminEditState | null>(null)
  const [adminSaving, setAdminSaving] = useState(false)
  const [adminMsg, setAdminMsg]     = useState<string | null>(null)

  // Sync state quand les props changent (navigation calendrier via router.push)
  useEffect(() => { setMois(moisSelectionne) }, [moisSelectionne])
  useEffect(() => { setAnnee(anneeSelectionnee) }, [anneeSelectionnee])

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
    setEmpNom(''); setEmpPrenom(''); setEmpSoldeDepart('0')
    setEmpPin(''); setEmpDateNaissance(''); setEmpJourAnniv('')
    setEmpErreur('')
    setEmpModal({ mode: 'create' })
  }

  function ouvrirEditionEmploye(emp: Employe) {
    setEmpNom(emp.nom); setEmpPrenom(emp.prenom)
    setEmpSoldeDepart(String(emp.solde_depart_recuperation ?? 0))
    setEmpPin(emp.code_pin ?? '')
    setEmpDateNaissance(emp.date_naissance ?? '')
    setEmpJourAnniv(emp.jour_anniversaire_pris ?? '')
    setEmpErreur('')
    setEmpModal({ mode: 'edit', employe: emp })
  }

  async function sauvegarderEmploye() {
    setEmpErreur('')
    const solde = parseFloat(empSoldeDepart.replace(',', '.')) || 0
    startTransition(async () => {
      let res
      if (empModal?.mode === 'create') {
        res = await createEmploye(empNom, empPrenom)
        if (res.success && solde !== 0) {
          router.refresh()
        }
      } else if (empModal?.employe) {
        const id = empModal.employe.id
        const pinVal = empPin.trim().replace(/\D/g, '').slice(0, 4) || null
        const [resEmp, resSolde] = await Promise.all([
          updateEmploye(id, empNom, empPrenom),
          updateSoldeDepart(id, solde),
          setPinEmploye(id, pinVal),
          setAnniversaireEmploye(id, empDateNaissance || null, empJourAnniv || null),
        ])
        res = resEmp.success ? resSolde : resEmp
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

  // ── Toggle jour férié ──────────────────────────────────────────────────────
  async function toggleJourFerie(date: string, currentActif: boolean) {
    const newActif = !currentActif
    setFeriesErreur(null)
    // Optimistic update
    setJoursFeries(prev => prev.map(f => f.date === date ? { ...f, actif: newActif, isOverride: true } : f))
    const res = await setJourFerieOverride(date, newActif)
    if (!res.success) {
      // Rollback
      setJoursFeries(prev => prev.map(f => f.date === date ? { ...f, actif: currentActif } : f))
      setFeriesErreur('⚠️ Erreur de sauvegarde. La table jours_feries_override n\'existe peut-être pas encore — exécutez supabase-migration-jours-feries.sql dans Supabase.')
    }
  }

  // ── Édition entrée employé (admin) ────────────────────────────────────────
  function ouvrirAdminEdit(emp: Employe, date: string) {
    const entry = feuillesTempsCalendrier.find(f =>
      f.nom === emp.nom && f.prenom === emp.prenom && f.date_journee === date
    )
    const recup = entry?.heures_a_recuperer ?? 0
    setAdminMsg(null)
    setAdminEdit({
      nom: emp.nom, prenom: emp.prenom, date,
      heuresEnPlus:  recup > 0 ? String(recup)           : '',
      heuresEnMoins: recup < 0 ? String(Math.abs(recup)) : '',
      commentaire: entry?.commentaire ?? '',
      pointes: (entry?.pointes_bateaux ?? []).map(b => ({ uid: adminUidSeq++, nom: b.nom_bateau, panier: b.panier_repas })),
    })
  }

  async function sauvegarderAdminEdit() {
    if (!adminEdit) return
    setAdminSaving(true)
    const enPlus  = parseFR(adminEdit.heuresEnPlus)
    const enMoins = parseFR(adminEdit.heuresEnMoins)
    const defH    = defaultHoursAdmin(adminEdit.date)
    const res = await sauvegarderJournee({
      nom: adminEdit.nom, prenom: adminEdit.prenom,
      date_journee: adminEdit.date,
      heures_travaillees: defH || null,
      heures_a_recuperer: enPlus - enMoins,
      commentaire: adminEdit.commentaire.trim() || null,
      pointes_bateaux: adminEdit.pointes.filter(p => p.nom.trim()).map(p => ({ nom_bateau: p.nom, panier_repas: p.panier })),
    })
    if (res.success) {
      setAdminMsg('✅ Enregistré')
      router.refresh()
      setTimeout(() => { setAdminEdit(null); setAdminMsg(null) }, 900)
    } else {
      setAdminMsg(`⚠️ ${res.message}`)
    }
    setAdminSaving(false)
  }

  // ── Vacances obligatoires ──────────────────────────────────────────────────
  async function ajouterVacance() {
    if (!vacDebut || !vacFin || vacFin < vacDebut) {
      setVacMsg('⚠️ Dates invalides.')
      return
    }
    startTransition(async () => {
      const res = await createVacanceObligatoire(vacDebut, vacFin, vacNom || 'Fermeture')
      if (res.success) {
        setVacances(prev => [...prev, {
          id: Date.now().toString(), date_debut: vacDebut, date_fin: vacFin, nom: vacNom || 'Fermeture',
        }].sort((a, b) => a.date_debut.localeCompare(b.date_debut)))
        setVacDebut(''); setVacFin(''); setVacNom('')
        setVacMsg('✅ Fermeture ajoutée.')
        setTimeout(() => setVacMsg(null), 3000)
      } else {
        setVacMsg('⚠️ Erreur lors de la création.')
      }
    })
  }

  async function supprimerVacance(id: string) {
    startTransition(async () => {
      await deleteVacanceObligatoire(id)
      setVacances(prev => prev.filter(v => v.id !== id))
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
          <button
            onClick={() => setOnglet('feries')}
            className={`px-6 py-3 rounded-xl font-semibold text-base transition-colors ${
              onglet === 'feries'
                ? 'bg-marine-800 text-white shadow-md'
                : 'bg-white text-marine-700 hover:bg-marine-100 border border-marine-200'
            }`}
          >
            🗓️ Jours Fériés
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
              const joursLabel = jours.map(j => {
                const ds = isoDay(annee, mois, j)
                const wd = isWeekend(annee, mois, j)
                const ferieOverride = joursFeries.find(f => f.date === ds)
                const ferie = ferieOverride ? ferieOverride.actif : (!wd && isJourFerie(new Date(annee, mois - 1, j)))
                // Vacances obligatoires
                const enVacance = vacances.some(v => v.date_debut <= ds && v.date_fin >= ds)
                return { j, ds, weekend: wd, ferie, enVacance,
                  dow: new Date(annee, mois - 1, j).toLocaleDateString('fr-FR', { weekday: 'narrow' }) }
              })

              // Anniversaire par employé : jourPris OU date_naissance avec l'année courante
              const anniversaireParEmpId = new Map<string, number>()
              employes.forEach(emp => {
                const jourPrisDate = emp.jour_anniversaire_pris
                  ? new Date(emp.jour_anniversaire_pris + 'T12:00:00')
                  : emp.date_naissance
                  ? new Date(`${annee}-${emp.date_naissance.slice(5, 10)}T12:00:00`)
                  : null
                if (jourPrisDate && jourPrisDate.getMonth() + 1 === mois) {
                  anniversaireParEmpId.set(emp.id, jourPrisDate.getDate())
                }
              })

              function navCalendrier(delta: number) {
                let m = mois + delta, a = annee
                if (m > 12) { m = 1; a++ }
                if (m < 1) { m = 12; a-- }
                const params = new URLSearchParams()
                params.set('mois', String(m))
                params.set('annee', String(a))
                if (recherche) params.set('q', recherche)
                router.push(`/admin?${params.toString()}`)
              }

              return (
                <div className="bg-white rounded-2xl border border-marine-100 overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-marine-100 bg-marine-50 gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <button onClick={() => navCalendrier(-1)} className="p-1.5 rounded-lg bg-white border border-marine-200 hover:bg-marine-100 transition-colors">
                        <svg className="w-3.5 h-3.5 text-marine-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <h3 className="text-marine-700 font-bold text-sm w-44 text-center">
                        📅 Absences équipe — {MOIS[mois - 1]} {annee}
                      </h3>
                      <button onClick={() => navCalendrier(1)} className="p-1.5 rounded-lg bg-white border border-marine-200 hover:bg-marine-100 transition-colors">
                        <svg className="w-3.5 h-3.5 text-marine-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-marine-500">
                      <span>🏝️ CP</span><span>🤮 Maladie</span><span>😶 Autre</span>
                      <span className="border-l border-marine-200 pl-3">🟧 Fermeture</span>
                      <span>🎂 Anniversaire</span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="text-xs border-collapse w-full">
                      <thead>
                        <tr>
                          <th className="sticky left-0 z-10 bg-marine-50 px-3 py-2 text-left text-marine-600 font-semibold min-w-36 border-r border-marine-100">
                            Salarié
                          </th>
                          {joursLabel.map(({ j, weekend, ferie, enVacance, dow }) => (
                            <th key={j} className={`px-0 py-1 text-center w-7 ${weekend || ferie ? 'text-slate-400 bg-slate-50' : enVacance ? 'bg-orange-100 text-marine-600' : 'text-marine-600'}`}>
                              <div className="text-[10px] font-normal">{dow}</div>
                              <div className={`font-bold ${ferie ? 'text-orange-400' : ''}`}>{j}</div>
                              {ferie && <div className="text-[8px] text-orange-400">F</div>}
                              {!ferie && enVacance && <div className="text-[8px] text-orange-500">🏢</div>}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {employes.map(emp => {
                          const anniversaireJour = anniversaireParEmpId.get(emp.id)
                          return (
                          <tr key={emp.id} className="border-t border-marine-100 hover:bg-marine-50/30">
                            <td className="sticky left-0 z-10 bg-white px-3 py-1.5 font-medium text-marine-800 whitespace-nowrap border-r border-marine-100">
                              {emp.prenom} {emp.nom}
                              {anniversaireJour && <span className="ml-1 text-[10px] text-amber-500">🎂</span>}
                            </td>
                            {joursLabel.map(({ j, ds, weekend, ferie, enVacance }) => {
                              const ab = absencesCalendrier.find(a =>
                                a.nom === emp.nom && a.prenom === emp.prenom &&
                                a.statut !== 'refuse' &&
                                a.date_debut <= ds && a.date_fin >= ds
                              )
                              const isAnniv = anniversaireJour === j
                              const clickableDay = !weekend && !ferie
                              return (
                                <td
                                  key={j}
                                  onClick={clickableDay ? () => ouvrirAdminEdit(emp, ds) : undefined}
                                  className={`w-7 h-7 text-center p-0.5 ${clickableDay ? 'cursor-pointer hover:bg-orange-50 transition-colors' : ''} ${weekend || ferie ? 'bg-slate-50/60' : isAnniv ? '!bg-amber-50' : enVacance ? 'bg-orange-100' : ''}`}
                                  title={isAnniv ? `🎂 Anniversaire ${emp.prenom}` : clickableDay ? `Modifier ${emp.prenom} ${emp.nom} — ${ds}` : undefined}
                                >
                                  {ab ? (
                                    <div
                                      className={`w-full h-full flex items-center justify-center text-base leading-none ${ab.statut === 'en_attente' ? 'opacity-50' : ''}`}
                                      title={`${ab.type_absence}${ab.statut === 'en_attente' ? ' (en attente)' : ''}`}
                                    >
                                      {absEmoji(ab.type_absence)}
                                    </div>
                                  ) : isAnniv ? (
                                    <div className="w-full h-full flex items-center justify-center text-base leading-none">🎂</div>
                                  ) : (weekend || ferie) ? (
                                    <div className="w-full h-full bg-slate-100/60 rounded" />
                                  ) : null}
                                </td>
                              )
                            })}
                          </tr>
                          )
                        })}
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
                      <th className="px-4 py-3 text-center text-marine-600 font-semibold text-sm">Solde récup.</th>
                      <th className="px-4 py-3 text-center text-marine-600 font-semibold text-sm">PIN</th>
                      <th className="px-4 py-3 text-center text-marine-600 font-semibold text-sm">🎂 Naissance</th>
                      <th className="px-5 py-3 text-right text-marine-600 font-semibold text-sm">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-marine-100">
                    {employes.map((emp) => {
                      const sd = emp.solde_depart_recuperation ?? 0
                      return (
                      <tr key={emp.id} className="hover:bg-marine-50 transition-colors">
                        <td className="px-5 py-4 text-marine-800 font-semibold">{emp.nom}</td>
                        <td className="px-5 py-4 text-marine-700">{emp.prenom}</td>
                        <td className="px-4 py-4 text-center">
                          <span className={`text-sm font-bold px-2 py-1 rounded-lg ${
                            sd > 0 ? 'bg-success-100 text-success-600' :
                            sd < 0 ? 'bg-danger-100 text-danger-600'   :
                                     'text-marine-400'
                          }`}>
                            {sd > 0 ? '+' : ''}{sd}h
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          {emp.code_pin
                            ? <span className="bg-marine-100 text-marine-600 text-xs font-bold px-2 py-1 rounded-lg tracking-widest">••••</span>
                            : <span className="text-marine-300 text-xs">—</span>
                          }
                        </td>
                        <td className="px-4 py-4 text-center text-marine-600 text-sm">
                          {emp.date_naissance
                            ? <span title={`Anniversaire pris le : ${emp.jour_anniversaire_pris ? formatDateFR(emp.jour_anniversaire_pris) : formatDateFR(emp.date_naissance)}`}>
                                🎂 {formatDateFR(emp.date_naissance)}
                              </span>
                            : <span className="text-marine-300">—</span>
                          }
                        </td>
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
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ====== ONGLET JOURS FÉRIÉS & FERMETURES ====== */}
        {onglet === 'feries' && (
          <div className="space-y-6">

            {feriesErreur && (
              <div className="p-4 bg-danger-100 border border-danger-600/20 rounded-2xl text-danger-600 text-sm font-medium">
                {feriesErreur}
              </div>
            )}

            {/* ── Jours fériés ── */}
            <div className="bg-white rounded-2xl border border-marine-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-marine-100 bg-marine-50 flex items-center justify-between">
                <h3 className="text-marine-700 font-bold">Jours fériés — {annee}</h3>
                <p className="text-marine-400 text-xs">Décochez les jours où l&apos;entreprise travaille</p>
              </div>
              {joursFeries.length === 0 ? (
                <p className="p-8 text-center text-marine-400">Aucun jour férié pour {annee}.</p>
              ) : (
                <ul className="divide-y divide-marine-100">
                  {joursFeries.map(f => (
                    <li key={f.date} className="flex items-center justify-between px-5 py-3.5 hover:bg-marine-50/40">
                      <div>
                        <p className={`font-semibold text-sm ${f.actif ? 'text-marine-800' : 'text-marine-400 line-through'}`}>
                          {f.nom}
                        </p>
                        <p className="text-marine-400 text-xs">
                          {formatDateFR(f.date)}
                          {f.isOverride && <span className="ml-2 text-orange-400 font-medium">modifié</span>}
                        </p>
                      </div>
                      <button
                        onClick={() => toggleJourFerie(f.date, f.actif)}
                        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${f.actif ? 'bg-marine-600' : 'bg-slate-300'}`}
                        title={f.actif ? 'Cliquer pour marquer comme ouvré' : 'Cliquer pour marquer comme férié'}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${f.actif ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* ── Fermetures / Vacances obligatoires ── */}
            <div className="bg-white rounded-2xl border border-marine-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-marine-100 bg-marine-50">
                <h3 className="text-marine-700 font-bold">Fermetures &amp; Vacances obligatoires</h3>
                <p className="text-marine-400 text-xs mt-0.5">Périodes où tout le monde est fermé — apparaît en orange sur le calendrier</p>
              </div>

              {/* Liste */}
              {vacances.length === 0 ? (
                <p className="px-5 py-4 text-marine-400 text-sm">Aucune fermeture saisie.</p>
              ) : (
                <ul className="divide-y divide-marine-100">
                  {vacances.map(v => (
                    <li key={v.id} className="flex items-center justify-between px-5 py-3 hover:bg-marine-50/40">
                      <div>
                        <p className="text-marine-800 font-semibold text-sm">{v.nom}</p>
                        <p className="text-marine-400 text-xs">
                          Du {formatDateFR(v.date_debut)} au {formatDateFR(v.date_fin)}
                        </p>
                      </div>
                      <button
                        onClick={() => supprimerVacance(v.id)}
                        disabled={isPending}
                        className="text-danger-600 hover:bg-danger-100 px-2 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        🗑️ Supprimer
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Formulaire ajout */}
              <div className="px-5 py-4 border-t border-marine-100 bg-marine-50/30">
                {vacMsg && (
                  <p className="mb-3 text-sm font-medium">{vacMsg}</p>
                )}
                <div className="flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="block text-marine-600 text-xs mb-1">Libellé</label>
                    <input
                      type="text"
                      value={vacNom}
                      onChange={e => setVacNom(e.target.value)}
                      placeholder="Fermeture annuelle"
                      className="border-2 border-marine-200 rounded-xl px-3 py-2 text-marine-900 text-sm focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-marine-600 text-xs mb-1">Début</label>
                    <input
                      type="date"
                      value={vacDebut}
                      onChange={e => setVacDebut(e.target.value)}
                      className="border-2 border-marine-200 rounded-xl px-3 py-2 text-marine-900 text-sm focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-marine-600 text-xs mb-1">Fin</label>
                    <input
                      type="date"
                      value={vacFin}
                      onChange={e => setVacFin(e.target.value)}
                      className="border-2 border-marine-200 rounded-xl px-3 py-2 text-marine-900 text-sm focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={ajouterVacance}
                    disabled={isPending || !vacDebut || !vacFin}
                    className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors"
                  >
                    + Ajouter
                  </button>
                </div>
              </div>
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

            <div className="space-y-4 mb-5 max-h-[70vh] overflow-y-auto pr-1">
              <div>
                <label className="block text-marine-700 font-semibold mb-2">
                  Nom <span className="text-danger-600">*</span>
                </label>
                <input type="text" value={empNom} onChange={e => setEmpNom(e.target.value)}
                  placeholder="Ex : DUPONT"
                  className="w-full border-2 border-marine-200 rounded-xl px-4 py-3 text-marine-900 text-lg placeholder:text-marine-300 focus:border-orange-500 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-marine-700 font-semibold mb-2">
                  Prénom <span className="text-danger-600">*</span>
                </label>
                <input type="text" value={empPrenom} onChange={e => setEmpPrenom(e.target.value)}
                  placeholder="Ex : Jean"
                  className="w-full border-2 border-marine-200 rounded-xl px-4 py-3 text-marine-900 text-lg placeholder:text-marine-300 focus:border-orange-500 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-marine-700 font-semibold mb-1">⏱ Solde de départ récup. (h)</label>
                <p className="text-marine-400 text-xs mb-2">Heures avant l&apos;appli. Positif = entreprise doit. Négatif = à rattraper.</p>
                <input type="text" inputMode="decimal" value={empSoldeDepart} onChange={e => setEmpSoldeDepart(e.target.value)}
                  placeholder="0"
                  className="w-full border-2 border-marine-200 rounded-xl px-4 py-2 text-marine-900 placeholder:text-marine-300 focus:border-orange-500 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-marine-700 font-semibold mb-1">🔐 Code PIN (4 chiffres)</label>
                <p className="text-marine-400 text-xs mb-2">Laisser vide pour désactiver le PIN.</p>
                <input type="text" inputMode="numeric" maxLength={4} value={empPin}
                  onChange={e => setEmpPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="ex : 1234"
                  className="w-full border-2 border-marine-200 rounded-xl px-4 py-2 text-marine-900 placeholder:text-marine-300 focus:border-orange-500 focus:outline-none transition-colors tracking-widest text-lg"
                />
              </div>
              <div>
                <label className="block text-marine-700 font-semibold mb-1">🎂 Date de naissance</label>
                <input type="date" value={empDateNaissance} onChange={e => setEmpDateNaissance(e.target.value)}
                  className="w-full border-2 border-marine-200 rounded-xl px-4 py-2 text-marine-900 focus:border-orange-500 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-marine-700 font-semibold mb-1">🕯️ Jour anniversaire pris le</label>
                <p className="text-marine-400 text-xs mb-2">
                  Automatiquement = jour de naissance. À modifier si l&apos;anniversaire tombe un weekend.
                </p>
                <input type="date" value={empJourAnniv} onChange={e => setEmpJourAnniv(e.target.value)}
                  className="w-full border-2 border-marine-200 rounded-xl px-4 py-2 text-marine-900 focus:border-orange-500 focus:outline-none transition-colors"
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

      {/* ====== MODAL ÉDITION ENTRÉE EMPLOYÉ (ADMIN) ====== */}
      {adminEdit && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 px-0 sm:px-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col">

            <div className="flex items-center justify-between px-6 py-4 border-b border-marine-100 flex-shrink-0">
              <div>
                <h2 className="text-marine-800 font-bold text-lg">
                  ✏️ {adminEdit.prenom} {adminEdit.nom}
                </h2>
                <p className="text-marine-500 text-sm capitalize">
                  {new Date(adminEdit.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              </div>
              <button onClick={() => setAdminEdit(null)} className="p-2 text-marine-400 hover:text-marine-800 hover:bg-marine-100 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

              {adminMsg && (
                <div className={`p-3 rounded-xl text-sm font-medium ${adminMsg.startsWith('✅') ? 'bg-success-100 text-success-600' : 'bg-danger-100 text-danger-600'}`}>
                  {adminMsg}
                </div>
              )}

              {/* Journée standard */}
              <div className="flex items-center gap-3 bg-marine-50 rounded-xl px-4 py-3 border border-marine-200">
                <span className="text-2xl">⏱️</span>
                <div>
                  <p className="text-marine-700 font-bold text-sm">Journée standard</p>
                  <p className="text-marine-800 font-black text-xl">{defaultHoursAdmin(adminEdit.date) || '—'}&nbsp;h</p>
                </div>
              </div>

              {/* Récupération */}
              <div className="space-y-3">
                <label className="block text-marine-700 font-bold">📊 Récupération</label>
                <div className="rounded-xl border-2 border-success-600/25 bg-success-100/50 p-3">
                  <p className="text-success-600 font-semibold text-sm mb-2">⏱ A travaillé plus que prévu</p>
                  <div className="flex items-center gap-2">
                    <input type="text" inputMode="decimal"
                      value={adminEdit.heuresEnPlus}
                      onChange={e => setAdminEdit(p => p ? { ...p, heuresEnPlus: e.target.value } : p)}
                      placeholder="0"
                      className="w-24 border-2 border-success-600/40 rounded-lg px-3 py-2 text-marine-900 text-lg text-center focus:border-success-600 focus:outline-none bg-white"
                    />
                    <span className="text-success-600 text-sm">h que l&apos;entreprise doit</span>
                  </div>
                </div>
                <div className="rounded-xl border-2 border-danger-600/25 bg-danger-100/50 p-3">
                  <p className="text-danger-600 font-semibold text-sm mb-2">⏪ A travaillé moins que prévu</p>
                  <div className="flex items-center gap-2">
                    <input type="text" inputMode="decimal"
                      value={adminEdit.heuresEnMoins}
                      onChange={e => setAdminEdit(p => p ? { ...p, heuresEnMoins: e.target.value } : p)}
                      placeholder="0"
                      className="w-24 border-2 border-danger-600/40 rounded-lg px-3 py-2 text-marine-900 text-lg text-center focus:border-danger-600 focus:outline-none bg-white"
                    />
                    <span className="text-danger-600 text-sm">h à rattraper</span>
                  </div>
                </div>
              </div>

              {/* Pointes */}
              <div>
                <label className="block text-marine-700 font-bold mb-2">⛵ Pointes bateau</label>
                {adminEdit.pointes.length > 0 && (
                  <div className="space-y-2 mb-2">
                    {adminEdit.pointes.map(pt => (
                      <div key={pt.uid} className="flex items-center gap-2 bg-marine-50 rounded-xl p-2.5">
                        <input type="text" value={pt.nom}
                          onChange={e => setAdminEdit(p => p ? { ...p, pointes: p.pointes.map(x => x.uid === pt.uid ? { ...x, nom: e.target.value } : x) } : p)}
                          placeholder="Nom du bateau"
                          className="flex-1 border-2 border-marine-200 rounded-lg px-3 py-2 text-marine-900 text-sm focus:border-orange-500 focus:outline-none bg-white"
                        />
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input type="checkbox" checked={pt.panier}
                            onChange={e => setAdminEdit(p => p ? { ...p, pointes: p.pointes.map(x => x.uid === pt.uid ? { ...x, panier: e.target.checked } : x) } : p)}
                            className="w-4 h-4 accent-orange-500"
                          />
                          <span className="text-xs text-marine-700">🧺</span>
                        </label>
                        <button onClick={() => setAdminEdit(p => p ? { ...p, pointes: p.pointes.filter(x => x.uid !== pt.uid) } : p)}
                          className="text-danger-500 hover:text-danger-700 p-1">✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setAdminEdit(p => p ? { ...p, pointes: [...p.pointes, { uid: adminUidSeq++, nom: '', panier: false }] } : p)}
                  className="text-marine-500 hover:text-marine-800 text-sm border border-marine-200 hover:border-marine-400 px-3 py-1.5 rounded-lg transition-colors"
                >
                  + Ajouter un bateau
                </button>
              </div>

              {/* Commentaire */}
              <div>
                <label className="block text-marine-700 font-bold mb-2">💬 Commentaire</label>
                <textarea rows={2} value={adminEdit.commentaire}
                  onChange={e => setAdminEdit(p => p ? { ...p, commentaire: e.target.value } : p)}
                  placeholder="Optionnel..."
                  className="w-full border-2 border-marine-200 rounded-xl px-4 py-2 text-marine-900 text-sm focus:border-orange-500 focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-marine-100 flex-shrink-0">
              <button onClick={() => setAdminEdit(null)}
                className="flex-1 border-2 border-marine-200 text-marine-600 hover:bg-marine-50 py-3 rounded-xl font-medium transition-colors">
                Annuler
              </button>
              <button onClick={sauvegarderAdminEdit} disabled={adminSaving}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white py-3 rounded-xl font-bold transition-colors">
                {adminSaving ? 'Sauvegarde...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
