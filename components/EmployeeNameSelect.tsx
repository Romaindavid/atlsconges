'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { selectEmployee } from '@/app/actions'
import type { Employe } from '@/lib/supabase'
type Props = { employes: Employe[] }

export default function EmployeeNameSelect({ employes }: Props) {
  const [loading, setLoading] = useState<string | null>(null)
  const router = useRouter()

  async function handleSelect(emp: Employe) {
    setLoading(emp.id)
    await selectEmployee(emp.id, emp.nom, emp.prenom)
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-marine-50 flex flex-col">
      {/* Header */}
      <header className="bg-marine-800 py-5 px-4 text-center">
        <img
          src="/logo.png"
          alt="ATLS"
          className="h-14 w-14 mx-auto rounded-xl object-contain"
        />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <h1 className="text-marine-800 text-3xl font-bold text-center mb-2">
            Qui êtes-vous ?
          </h1>
          <p className="text-marine-500 text-center mb-8 text-lg">
            Sélectionnez votre nom dans la liste
          </p>

          <div className="space-y-3">
            {employes.map((emp) => (
              <button
                key={emp.id}
                onClick={() => handleSelect(emp)}
                disabled={loading !== null}
                className="w-full bg-white hover:bg-orange-50 border-2 border-marine-100 hover:border-orange-400 rounded-2xl px-6 py-4 text-left flex items-center justify-between group transition-all duration-150 shadow-sm hover:shadow-md disabled:opacity-60"
              >
                <span className="text-marine-800 text-xl font-semibold group-hover:text-orange-600 transition-colors">
                  {emp.prenom} <span className="font-bold">{emp.nom}</span>
                </span>
                {loading === emp.id ? (
                  <svg className="animate-spin w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-marine-300 group-hover:text-orange-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
