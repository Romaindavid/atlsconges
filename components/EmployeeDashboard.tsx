'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { changeEmployee, getAbsencesEquipe } from '@/app/actions'
import type { AbsenceEmploye, AbsenceEquipe, EmployeNom } from '@/app/actions'
import type { JourneeEntry } from '@/app/temps/actions'
import { formatDateFR, isJourFerie } from '@/lib/calcul-jours'
import FeuilleTempsCore from '@/components/FeuilleTempsCore'

// ─── Helpers calendrier ───────────────────────────────────────────────────────
const MOIS_NOMS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

function daysInMonth(m: number, a: number) { return new Date(a, m, 0).getDate() }
function isoDay(a: number, m: number, d: number) {
  return `${a}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
}
function isWeekend(a: number, m: number, d: number) {
  const dow = new Date(a, m - 1, d).getDay(); return dow === 0 || dow === 6
}
function absEmoji(type: string) {
  if (type === 'Congés payés') return '🏝️'
  if (type === 'Maladie') return '🤮'
  return '😶'
}

// ─── Types ────────────────────────────────────────────────────────────────────
const STATUT_CONFIG = {
  en_attente: { label: 'En attente', emoji: '🕐', bg: 'bg-warning-100',  text: 'text-warning-600',  border: 'border-warning-600/20'  },
  accorde:    { label: 'Accordé',    emoji: '✅', bg: 'bg-success-100',  text: 'text-success-600',  border: 'border-success-600/20'  },
  refuse:     { label: 'Refusé',     emoji: '❌', bg: 'bg-danger-100',   text: 'text-danger-600',   border: 'border-danger-600/20'   },
}

type Props = {
  employee: { id: string; nom: string; prenom: string }
  absences: AbsenceEmploye[]
  entriesInitiales: JourneeEntry[]
  moisInitial: number
  anneeInitiale: number
  soldeRecupInitial: number
  absencesEquipeInitiales: AbsenceEquipe[]
  employesNoms: EmployeNom[]
}

export default function EmployeeDashboard({
  employee, absences, entriesInitiales, moisInitial, anneeInitiale,
  soldeRecupInitial, absencesEquipeInitiales, employesNoms,
}: Props) {
  const router = useRouter()
  const [onglet, setOnglet] = useState<'feuille' | 'equipe'>('feuille')

  // Planning équipe
  const [teamMois,    setTeamMois]    = useState(moisInitial)
  const [teamAnnee,   setTeamAnnee]   = useState(anneeInitiale)
  const [teamAbsences, setTeamAbsences] = useState<AbsenceEquipe[]>(absencesEquipeInitiales)
  const [teamLoading, setTeamLoading] = useState(false)

  async function handleChange() {
    await changeEmployee()
    router.refresh()
  }

  async function changerMoisEquipe(delta: number) {
    let m = teamMois + delta, a = teamAnnee
    if (m > 12) { m = 1;  a++ }
    if (m < 1)  { m = 12; a-- }
    setTeamLoading(true)
    const data = await getAbsencesEquipe(m, a)
    setTeamMois(m); setTeamAnnee(a); setTeamAbsences(data)
    setTeamLoading(false)
  }

  const absencesAccordees = absences
    .filter(a => a.statut === 'accorde')
    .map(a => ({ date_debut: a.date_debut, date_fin: a.date_fin, type_absence: a.type_absence }))

  return (
    <div className="min-h-screen flex flex-col bg-marine-50">

      {/* ── Header ── */}
      <header className="bg-marine-800 py-3 px-4 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="ATLS" className="h-10 w-10 rounded-lg flex-shrink-0" />
            <div className="hidden sm:block">
              <p className="text-marine-200 text-xs">Connecté en tant que</p>
              <p className="text-white font-bold text-sm">{employee.prenom} {employee.nom}</p>
            </div>
          </div>
          <button
            onClick={handleChange}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-bold px-5 py-2.5 rounded-xl transition-colors shadow-md text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 3M21 7.5H7.5" />
            </svg>
            Changer de salarié
          </button>
        </div>
      </header>

      <main className="flex-1 py-6 px-4">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* ── Bonjour ── */}
          <div>
            <h1 className="text-marine-800 text-3xl font-bold">
              Bonjour, {employee.prenom}&nbsp;!
            </h1>
            <p className="text-marine-500 mt-1">Voici votre espace de suivi.</p>
          </div>

          {/* ── Onglets ── */}
          <div className="flex gap-2">
            <button
              onClick={() => setOnglet('feuille')}
              className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors ${
                onglet === 'feuille'
                  ? 'bg-marine-800 text-white shadow-md'
                  : 'bg-white text-marine-700 hover:bg-marine-100 border border-marine-200'
              }`}
            >
              📋 Ma feuille de temps
            </button>
            <button
              onClick={() => setOnglet('equipe')}
              className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors ${
                onglet === 'equipe'
                  ? 'bg-marine-800 text-white shadow-md'
                  : 'bg-white text-marine-700 hover:bg-marine-100 border border-marine-200'
              }`}
            >
              👥 Planning équipe
            </button>
          </div>

          {/* ── ONGLET : Feuille de temps ── */}
          {onglet === 'feuille' && (
            <>
              <section>
                <FeuilleTempsCore
                  employe={employee}
                  entriesInitiales={entriesInitiales}
                  moisInitial={moisInitial}
                  anneeInitiale={anneeInitiale}
                  soldeRecupInitial={soldeRecupInitial}
                  absencesAccordees={absencesAccordees}
                />
              </section>

              {/* ── Mes demandes d'absence ── */}
              <section>
                <h2 className="text-marine-800 text-xl font-bold mb-4">
                  📋 Mes demandes d&apos;absence
                </h2>
                {absences.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 text-center border border-marine-100 shadow-sm">
                    <p className="text-marine-500 text-lg">Aucune demande pour le moment.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {absences.map((abs) => {
                      const s = STATUT_CONFIG[abs.statut]
                      return (
                        <div key={abs.id} className="bg-white rounded-2xl border border-marine-100 shadow-sm p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-marine-800 font-semibold text-base">
                                {abs.type_absence}
                                {abs.type_absence_detail && (
                                  <span className="text-marine-500 font-normal"> — {abs.type_absence_detail}</span>
                                )}
                              </p>
                              <p className="text-marine-600 text-sm mt-0.5">
                                Du {formatDateFR(abs.date_debut)} au {formatDateFR(abs.date_fin)}
                                <span className="text-marine-500 ml-2">
                                  ({abs.jours_ouvres} j. ouvré{abs.jours_ouvres > 1 ? 's' : ''})
                                </span>
                              </p>
                              <p className="text-marine-500 text-xs mt-0.5">
                                Demandé le {formatDateFR(abs.date_demande.split('T')[0])}
                              </p>
                            </div>
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${s.bg} ${s.text} border ${s.border}`}>
                              {s.emoji} {s.label}
                            </span>
                          </div>
                          {abs.commentaire_direction && (
                            <div className="mt-3 p-3 bg-marine-50 rounded-lg text-sm text-marine-700">
                              <span className="font-semibold">Note de la direction : </span>
                              {abs.commentaire_direction}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            </>
          )}

          {/* ── ONGLET : Planning équipe ── */}
          {onglet === 'equipe' && (
            <section>
              <div className="bg-white rounded-2xl border border-marine-100 overflow-hidden shadow-sm">
                {/* En-tête avec navigation mois */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-marine-100 bg-marine-50 gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => changerMoisEquipe(-1)}
                      disabled={teamLoading}
                      className="p-2 rounded-lg bg-white border border-marine-200 hover:bg-marine-100 disabled:opacity-50 transition-colors"
                    >
                      <svg className="w-4 h-4 text-marine-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span className="text-marine-800 font-bold text-sm w-36 text-center">
                      {MOIS_NOMS[teamMois - 1]} {teamAnnee}
                    </span>
                    <button
                      onClick={() => changerMoisEquipe(1)}
                      disabled={teamLoading}
                      className="p-2 rounded-lg bg-white border border-marine-200 hover:bg-marine-100 disabled:opacity-50 transition-colors"
                    >
                      <svg className="w-4 h-4 text-marine-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-marine-500">
                    <span>🏝️ CP</span>
                    <span>🤮 Maladie</span>
                    <span>😶 Autre</span>
                  </div>
                </div>

                {teamLoading ? (
                  <div className="p-12 text-center text-marine-400">Chargement…</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="text-xs border-collapse w-full">
                      <thead>
                        <tr>
                          <th className="sticky left-0 z-10 bg-marine-50 px-3 py-2 text-left text-marine-600 font-semibold min-w-36 border-r border-marine-100">
                            Salarié
                          </th>
                          {Array.from({ length: daysInMonth(teamMois, teamAnnee) }, (_, i) => i + 1).map(j => {
                            const ds  = isoDay(teamAnnee, teamMois, j)
                            const wd  = isWeekend(teamAnnee, teamMois, j)
                            const ferie = !wd && isJourFerie(new Date(teamAnnee, teamMois - 1, j))
                            const dow = new Date(teamAnnee, teamMois - 1, j).toLocaleDateString('fr-FR', { weekday: 'narrow' })
                            return (
                              <th key={j} className={`px-0 py-1 text-center w-7 ${wd || ferie ? 'text-slate-400 bg-slate-50' : 'text-marine-600'}`}>
                                <div className="text-[10px] font-normal">{dow}</div>
                                <div className={`font-bold ${ferie ? 'text-orange-400' : ''}`}>{j}</div>
                                {ferie && <div className="text-[8px] text-orange-400">F</div>}
                              </th>
                            )
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {employesNoms.map(emp => (
                          <tr key={emp.id} className={`border-t border-marine-100 hover:bg-marine-50/30 ${emp.nom === employee.nom && emp.prenom === employee.prenom ? 'bg-orange-50/30' : ''}`}>
                            <td className={`sticky left-0 z-10 bg-white px-3 py-1.5 font-medium whitespace-nowrap border-r border-marine-100 ${emp.nom === employee.nom && emp.prenom === employee.prenom ? 'text-orange-600' : 'text-marine-800'}`}>
                              {emp.prenom} {emp.nom}
                              {emp.nom === employee.nom && emp.prenom === employee.prenom && (
                                <span className="ml-1 text-[10px] text-orange-400">(vous)</span>
                              )}
                            </td>
                            {Array.from({ length: daysInMonth(teamMois, teamAnnee) }, (_, i) => i + 1).map(j => {
                              const ds  = isoDay(teamAnnee, teamMois, j)
                              const wd  = isWeekend(teamAnnee, teamMois, j)
                              const ferie = !wd && isJourFerie(new Date(teamAnnee, teamMois - 1, j))
                              const ab = teamAbsences.find(a =>
                                a.nom === emp.nom && a.prenom === emp.prenom &&
                                a.date_debut <= ds && a.date_fin >= ds
                              )
                              return (
                                <td key={j} className={`w-7 h-7 text-center p-0.5 ${wd || ferie ? 'bg-slate-50/60' : ''}`}>
                                  {ab ? (
                                    <div className="w-full h-full flex items-center justify-center text-base leading-none" title={ab.type_absence}>
                                      {absEmoji(ab.type_absence)}
                                    </div>
                                  ) : (wd || ferie) ? (
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
                )}
              </div>
            </section>
          )}

        </div>
      </main>

      <footer className="bg-marine-900 text-marine-100 text-center py-4 text-sm">
        © {new Date().getFullYear()} Atlantique Sellerie — Usage interne
      </footer>
    </div>
  )
}
