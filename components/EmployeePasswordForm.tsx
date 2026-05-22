'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { loginEmployee } from '@/app/actions'
import Image from 'next/image'

export default function EmployeePasswordForm() {
  const [password, setPassword] = useState('')
  const [erreur, setErreur] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErreur('')
    const res = await loginEmployee(password)
    setLoading(false)
    if (res.success) {
      router.refresh()
    } else {
      setErreur(res.message)
      setPassword('')
    }
  }

  return (
    <div className="min-h-screen bg-marine-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo carré centré */}
        <div className="flex justify-center mb-8">
          <Image
            src="/logo.png"
            alt="Atlantique Sellerie"
            width={150}
            height={150}
            className="rounded-2xl shadow-2xl"
            priority
          />
        </div>

        {/* Sous-titre */}
        <p className="text-marine-600 text-center text-base font-medium mb-6">
          Gestion des congés &amp; feuilles de temps
        </p>

        {/* Carte formulaire */}
        <div className="bg-white rounded-2xl shadow-xl border border-marine-100 p-8">
          <h1 className="text-marine-800 text-2xl font-bold text-center mb-6">
            Accès à l&apos;outil
          </h1>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="password" className="block text-marine-700 font-semibold mb-2 text-lg">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                placeholder="••••••••"
                className="w-full border-2 border-marine-200 rounded-xl px-4 py-4 text-marine-900 text-xl focus:border-orange-500 focus:outline-none transition-colors"
              />
            </div>

            {erreur && (
              <div className="p-3 bg-danger-100 text-danger-600 rounded-xl text-sm font-medium">
                ⚠️ {erreur}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-bold text-xl py-4 rounded-xl transition-colors"
            >
              {loading ? 'Vérification...' : 'Entrer'}
            </button>
          </form>
        </div>

        <p className="text-marine-500 text-xs text-center mt-6">
          Accès direction →{' '}
          <a href="/admin" className="underline hover:text-marine-700">
            /admin
          </a>
        </p>
      </div>
    </div>
  )
}
