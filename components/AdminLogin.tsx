'use client'

import { useState } from 'react'
import { loginAdmin } from '@/app/admin/actions'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function AdminLogin() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await loginAdmin(password)
    setLoading(false)

    if (res.success) {
      router.refresh()
    } else {
      setError(res.message)
      setPassword('')
    }
  }

  return (
    <div className="min-h-screen bg-marine-800 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Image
            src="https://atlantiquesellerie.com/wp-content/uploads/2017/03/logo_horiz-white.png"
            alt="Atlantique Sellerie"
            width={220}
            height={55}
            className="h-12 w-auto mx-auto object-contain mb-4"
            unoptimized
          />
          <p className="text-marine-200 text-sm">Interface Direction</p>
        </div>

        {/* Formulaire */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h1 className="text-marine-800 text-2xl font-bold text-center mb-6">
            🔒 Accès sécurisé
          </h1>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="password" className="block text-marine-700 font-semibold mb-2">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                autoFocus
                className="w-full border-2 border-marine-200 rounded-xl px-4 py-4 text-marine-900 text-lg focus:border-orange-500 focus:outline-none transition-colors"
              />
            </div>

            {error && (
              <div className="p-3 bg-danger-100 text-danger-600 rounded-xl text-sm font-medium">
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-marine-800 hover:bg-marine-900 disabled:opacity-60 text-white font-bold text-lg py-4 rounded-xl transition-colors"
            >
              {loading ? 'Vérification...' : 'Se connecter'}
            </button>
          </form>
        </div>

        <p className="text-marine-400 text-xs text-center mt-6">
          Accès réservé à la direction
        </p>
      </div>
    </div>
  )
}
