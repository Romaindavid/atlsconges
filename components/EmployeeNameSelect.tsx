'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { selectEmployee, selectEmployeeWithPin } from '@/app/actions'

type EmployeeItem = {
  id: string
  nom: string
  prenom: string
  hasPin: boolean
}

type Props = { employes: EmployeeItem[] }

export default function EmployeeNameSelect({ employes }: Props) {
  const [loading, setLoading]   = useState(false)
  const [selected, setSelected] = useState<EmployeeItem | null>(null)
  const [pin, setPin]           = useState('')
  const [erreur, setErreur]     = useState('')
  const pinRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (selected?.hasPin) pinRef.current?.focus()
  }, [selected])

  async function handleSelectName(emp: EmployeeItem) {
    if (!emp.hasPin) {
      // Pas de PIN → connexion directe
      setLoading(true)
      await selectEmployee(emp.id, emp.nom, emp.prenom)
      router.refresh()
    } else {
      setSelected(emp)
      setPin('')
      setErreur('')
    }
  }

  async function handleConfirmPin() {
    if (!selected) return
    setLoading(true)
    setErreur('')
    const res = await selectEmployeeWithPin(selected.id, selected.nom, selected.prenom, pin)
    if (res.success) {
      router.refresh()
    } else {
      setErreur(res.message ?? 'Code PIN incorrect.')
      setPin('')
      setLoading(false)
      pinRef.current?.focus()
    }
  }

  return (
    <div className="min-h-screen bg-marine-50 flex flex-col">
      {/* Header */}
      <header className="bg-marine-800 py-5 px-4 text-center">
        <img src="/logo.png" alt="ATLS" className="h-14 w-14 mx-auto rounded-xl object-contain" />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">

          {/* ── Étape 1 : sélection du nom ── */}
          {!selected && (
            <>
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
                    onClick={() => handleSelectName(emp)}
                    disabled={loading}
                    className="w-full bg-white hover:bg-orange-50 border-2 border-marine-100 hover:border-orange-400 rounded-2xl px-6 py-4 text-left flex items-center justify-between group transition-all duration-150 shadow-sm hover:shadow-md disabled:opacity-60"
                  >
                    <span className="text-marine-800 text-xl font-semibold group-hover:text-orange-600 transition-colors">
                      {emp.prenom} <span className="font-bold">{emp.nom}</span>
                    </span>
                    <svg className="w-5 h-5 text-marine-300 group-hover:text-orange-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ── Étape 2 : saisie du PIN ── */}
          {selected && (
            <>
              <button
                onClick={() => { setSelected(null); setPin(''); setErreur('') }}
                className="flex items-center gap-2 text-marine-500 hover:text-marine-800 mb-6 text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Retour
              </button>

              <div className="text-center mb-8">
                <p className="text-marine-800 text-2xl font-bold">
                  {selected.prenom} {selected.nom}
                </p>
                <p className="text-marine-500 mt-1">Entrez votre code PIN</p>
              </div>

              {erreur && (
                <div className="mb-4 p-3 bg-danger-100 text-danger-600 rounded-xl text-sm font-medium text-center">
                  ⚠️ {erreur}
                </div>
              )}

              <input
                ref={pinRef}
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                onKeyDown={e => e.key === 'Enter' && pin.length === 4 && handleConfirmPin()}
                placeholder="• • • •"
                className="w-full text-center text-4xl tracking-[1rem] border-2 border-marine-200 rounded-2xl px-4 py-5 text-marine-900 focus:border-orange-500 focus:outline-none bg-white mb-5"
              />

              <button
                onClick={handleConfirmPin}
                disabled={loading || pin.length < 4}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold py-4 rounded-2xl text-lg transition-colors shadow-md"
              >
                {loading ? 'Connexion...' : 'Confirmer'}
              </button>
            </>
          )}

        </div>
      </main>
    </div>
  )
}
