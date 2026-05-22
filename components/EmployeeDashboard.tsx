'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { changeEmployee } from '@/app/actions'
import type { AbsenceEmploye } from '@/app/actions'
import { formatDateFR } from '@/lib/calcul-jours'

type Props = {
  employee: { id: string; nom: string; prenom: string }
  absences: AbsenceEmploye[]
}

const STATUT_CONFIG = {
  en_attente: {
    label: 'En attente',
    emoji: '🕐',
    bg: 'bg-warning-100',
    text: 'text-warning-600',
    border: 'border-warning-600/20',
  },
  accorde: {
    label: 'Accordé',
    emoji: '✅',
    bg: 'bg-success-100',
    text: 'text-success-600',
    border: 'border-success-600/20',
  },
  refuse: {
    label: 'Refusé',
    emoji: '❌',
    bg: 'bg-danger-100',
    text: 'text-danger-600',
    border: 'border-danger-600/20',
  },
}

export default function EmployeeDashboard({ employee, absences }: Props) {
  const router = useRouter()

  async function handleChange() {
    await changeEmployee()
    router.refresh()
  }

  return (
    <div className="min-h-screen flex flex-col bg-marine-50">
      {/* Header */}
      <header className="bg-marine-800 py-4 px-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Image
            src="https://atlantiquesellerie.com/wp-content/uploads/2017/03/logo_horiz-white.png"
            alt="Atlantique Sellerie"
            width={180}
            height={45}
            className="h-10 w-auto object-contain"
            unoptimized
          />
          <button
            onClick={handleChange}
            className="text-marine-200 hover:text-white text-sm border border-marine-600 hover:border-marine-400 px-3 py-2 rounded-lg transition-colors"
          >
            Changer →
          </button>
        </div>
      </header>

      <main className="flex-1 py-8 px-4">
        <div className="max-w-2xl mx-auto space-y-8">

          {/* Accueil */}
          <div>
            <h1 className="text-marine-800 text-3xl font-bold">
              Bonjour, {employee.prenom}&nbsp;!
            </h1>
            <p className="text-marine-500 mt-1">Que souhaitez-vous faire ?</p>
          </div>

          {/* Actions principales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Link
              href="/absence"
              className="group flex flex-col items-center justify-center gap-3 bg-white rounded-2xl p-7 shadow-sm border-2 border-transparent hover:border-orange-500 hover:shadow-lg transition-all duration-200 text-center"
            >
              <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center group-hover:bg-orange-500 transition-colors">
                <svg className="w-8 h-8 text-orange-500 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-lg font-bold text-marine-800 group-hover:text-orange-600 transition-colors">
                Demande de congés
              </span>
            </Link>

            <Link
              href="/temps"
              className="group flex flex-col items-center justify-center gap-3 bg-white rounded-2xl p-7 shadow-sm border-2 border-transparent hover:border-orange-500 hover:shadow-lg transition-all duration-200 text-center"
            >
              <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center group-hover:bg-orange-500 transition-colors">
                <svg className="w-8 h-8 text-orange-500 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-lg font-bold text-marine-800 group-hover:text-orange-600 transition-colors">
                Feuille de temps
              </span>
            </Link>
          </div>

          {/* Mes demandes d'absence */}
          <section>
            <h2 className="text-marine-800 text-xl font-bold mb-4">
              📋 Mes demandes d&apos;absence
            </h2>

            {absences.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center border border-marine-100 shadow-sm">
                <p className="text-marine-400 text-lg">Aucune demande pour le moment.</p>
                <Link
                  href="/absence"
                  className="inline-block mt-4 text-orange-500 hover:text-orange-600 font-semibold underline underline-offset-2"
                >
                  Faire une première demande →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {absences.map((abs) => {
                  const s = STATUT_CONFIG[abs.statut]
                  return (
                    <div
                      key={abs.id}
                      className="bg-white rounded-2xl border border-marine-100 shadow-sm p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        {/* Type + dates */}
                        <div>
                          <p className="text-marine-800 font-semibold text-base">
                            {abs.type_absence}
                            {abs.type_absence_detail && (
                              <span className="text-marine-500 font-normal"> — {abs.type_absence_detail}</span>
                            )}
                          </p>
                          <p className="text-marine-600 text-sm mt-0.5">
                            Du {formatDateFR(abs.date_debut)} au {formatDateFR(abs.date_fin)}
                            <span className="text-marine-400 ml-2">
                              ({abs.jours_ouvres} j. ouvré{abs.jours_ouvres > 1 ? 's' : ''})
                            </span>
                          </p>
                          <p className="text-marine-400 text-xs mt-0.5">
                            Demandé le {formatDateFR(abs.date_demande.split('T')[0])}
                          </p>
                        </div>

                        {/* Badge statut */}
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${s.bg} ${s.text} border ${s.border}`}>
                          {s.emoji} {s.label}
                        </span>
                      </div>

                      {/* Note direction */}
                      {abs.commentaire_direction && (
                        <div className="mt-3 p-3 bg-marine-50 rounded-lg text-sm text-marine-600">
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
        </div>
      </main>

      <footer className="bg-marine-900 text-marine-100 text-center py-4 text-sm">
        © {new Date().getFullYear()} Atlantique Sellerie — Usage interne
      </footer>
    </div>
  )
}
