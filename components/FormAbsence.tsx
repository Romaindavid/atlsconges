'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { calculerJoursOuvres, dateAujourdhui } from '@/lib/calcul-jours'
import { soumettreAbsence } from '@/app/absence/actions'

const TYPES_ABSENCE = ['Congés payés', 'Autre (précisez...)']

export default function FormAbsence() {
  const router = useRouter()

  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [typeAbsence, setTypeAbsence] = useState('Congés payés')
  const [typeDetail, setTypeDetail] = useState('')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [joursOuvres, setJoursOuvres] = useState<number>(0)
  const [joursManuel, setJoursManuel] = useState(false)
  const [commentaire, setCommentaire] = useState('')
  const [certifie, setCertifie] = useState(false)
  const [dateAujourdhui_] = useState(dateAujourdhui())

  const [loading, setLoading] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [showSuccessPopup, setShowSuccessPopup] = useState(false)

  // Calcul automatique des jours ouvrés
  useEffect(() => {
    if (!joursManuel && dateDebut && dateFin) {
      const calcul = calculerJoursOuvres(dateDebut, dateFin)
      setJoursOuvres(calcul)
    }
  }, [dateDebut, dateFin, joursManuel])

  const nomComplet = [prenom.trim(), nom.trim()].filter(Boolean).join(' ')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!certifie) {
      setErreur('Vous devez certifier l\'exactitude des informations.')
      return
    }

    setLoading(true)
    setErreur(null)

    const res = await soumettreAbsence({
      nom,
      prenom,
      type_absence: typeAbsence,
      type_absence_detail: typeDetail,
      date_debut: dateDebut,
      date_fin: dateFin,
      jours_ouvres: joursOuvres,
      commentaire_salarie: commentaire,
    })

    setLoading(false)

    if (res.success) {
      setShowSuccessPopup(true)
      setTimeout(() => router.push('/'), 2500)
    } else {
      setErreur(res.message)
    }
  }

  return (
    <>
      {/* Popup succès */}
      {showSuccessPopup && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full shadow-2xl">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-marine-800 text-2xl font-bold mb-2">Demande envoyée !</h2>
            <p className="text-marine-600 mb-4">Elle sera traitée par la direction.</p>
            <p className="text-marine-400 text-sm">Retour à l&apos;accueil dans quelques secondes…</p>
          </div>
        </div>
      )}

    <form onSubmit={handleSubmit} className="space-y-8">

      {/* Message d'erreur */}
      {erreur && (
        <div className="rounded-xl p-5 text-base font-medium bg-danger-100 text-danger-600 border border-danger-600/30">
          ⚠️ {erreur}
        </div>
      )}

      {/* Section : Informations du salarié */}
      <section className="bg-white rounded-2xl shadow-sm p-6 border border-marine-100">
        <h2 className="text-marine-800 text-xl font-bold mb-6 pb-3 border-b border-marine-100">
          👤 Informations du salarié
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Nom */}
          <div>
            <label htmlFor="nom" className="block text-marine-700 font-semibold mb-2">
              Nom <span className="text-danger-600">*</span>
            </label>
            <input
              id="nom"
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              required
              placeholder="Ex : DUPONT"
              className="w-full border-2 border-marine-200 rounded-xl px-4 py-3 text-marine-900 text-lg placeholder:text-marine-300 focus:border-orange-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Prénom */}
          <div>
            <label htmlFor="prenom" className="block text-marine-700 font-semibold mb-2">
              Prénom <span className="text-danger-600">*</span>
            </label>
            <input
              id="prenom"
              type="text"
              value={prenom}
              onChange={(e) => setPrenom(e.target.value)}
              required
              placeholder="Ex : Jean"
              className="w-full border-2 border-marine-200 rounded-xl px-4 py-3 text-marine-900 text-lg placeholder:text-marine-300 focus:border-orange-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Type d'absence */}
          <div className="sm:col-span-2">
            <label htmlFor="typeAbsence" className="block text-marine-700 font-semibold mb-2">
              Type d&apos;absence <span className="text-danger-600">*</span>
            </label>
            <select
              id="typeAbsence"
              value={typeAbsence}
              onChange={(e) => setTypeAbsence(e.target.value)}
              className="w-full border-2 border-marine-200 rounded-xl px-4 py-3 text-marine-900 text-lg bg-white focus:border-orange-500 focus:outline-none transition-colors"
            >
              {TYPES_ABSENCE.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Champ "Autre" conditionnel */}
          {typeAbsence === 'Autre (précisez...)' && (
            <div className="sm:col-span-2">
              <label htmlFor="typeDetail" className="block text-marine-700 font-semibold mb-2">
                Précisez le motif <span className="text-danger-600">*</span>
              </label>
              <input
                id="typeDetail"
                type="text"
                value={typeDetail}
                onChange={(e) => setTypeDetail(e.target.value)}
                required
                placeholder="Ex : Maladie, Événement familial..."
                className="w-full border-2 border-marine-200 rounded-xl px-4 py-3 text-marine-900 text-lg placeholder:text-marine-300 focus:border-orange-500 focus:outline-none transition-colors"
              />
            </div>
          )}

          {/* Date début */}
          <div>
            <label htmlFor="dateDebut" className="block text-marine-700 font-semibold mb-2">
              Date de début <span className="text-danger-600">*</span>
            </label>
            <input
              id="dateDebut"
              type="date"
              value={dateDebut}
              onChange={(e) => {
                setDateDebut(e.target.value)
                setJoursManuel(false)
              }}
              required
              className="w-full border-2 border-marine-200 rounded-xl px-4 py-3 text-marine-900 text-lg focus:border-orange-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Date fin */}
          <div>
            <label htmlFor="dateFin" className="block text-marine-700 font-semibold mb-2">
              Date de fin <span className="text-danger-600">*</span>
            </label>
            <input
              id="dateFin"
              type="date"
              value={dateFin}
              onChange={(e) => {
                setDateFin(e.target.value)
                setJoursManuel(false)
              }}
              min={dateDebut || undefined}
              required
              className="w-full border-2 border-marine-200 rounded-xl px-4 py-3 text-marine-900 text-lg focus:border-orange-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Jours ouvrés */}
          <div className="sm:col-span-2">
            <label htmlFor="joursOuvres" className="block text-marine-700 font-semibold mb-2">
              Nombre de jours ouvrés <span className="text-danger-600">*</span>
              {!joursManuel && dateDebut && dateFin && (
                <span className="ml-2 text-sm font-normal text-marine-500 bg-marine-50 px-2 py-0.5 rounded">
                  calculé automatiquement
                </span>
              )}
            </label>
            <div className="flex items-center gap-3">
              <input
                id="joursOuvres"
                type="number"
                min="1"
                value={joursOuvres || ''}
                onChange={(e) => {
                  setJoursManuel(true)
                  setJoursOuvres(parseInt(e.target.value) || 0)
                }}
                required
                placeholder="0"
                className="w-32 border-2 border-marine-200 rounded-xl px-4 py-3 text-marine-900 text-lg focus:border-orange-500 focus:outline-none transition-colors"
              />
              {joursManuel && (
                <button
                  type="button"
                  onClick={() => {
                    setJoursManuel(false)
                    if (dateDebut && dateFin) {
                      setJoursOuvres(calculerJoursOuvres(dateDebut, dateFin))
                    }
                  }}
                  className="text-sm text-marine-500 underline hover:text-marine-700"
                >
                  Recalculer automatiquement
                </button>
              )}
            </div>
            <p className="text-sm text-marine-500 mt-1">
              Jours du lundi au vendredi (hors week-ends). Modifiable si nécessaire.
            </p>
          </div>
        </div>
      </section>

      {/* Section : Organisation du travail */}
      <section className="bg-white rounded-2xl shadow-sm p-6 border border-marine-100">
        <h2 className="text-marine-800 text-xl font-bold mb-6 pb-3 border-b border-marine-100">
          📋 Organisation du travail
        </h2>

        <div>
          <label htmlFor="commentaire" className="block text-marine-700 font-semibold mb-2">
            Commentaires <span className="text-marine-400 font-normal">(optionnel)</span>
          </label>
          <textarea
            id="commentaire"
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            rows={4}
            placeholder="Informations utiles pour l'organisation de votre absence..."
            className="w-full border-2 border-marine-200 rounded-xl px-4 py-3 text-marine-900 text-lg placeholder:text-marine-300 focus:border-orange-500 focus:outline-none transition-colors resize-none"
          />
        </div>
      </section>

      {/* Section : Signature */}
      <section className="bg-white rounded-2xl shadow-sm p-6 border border-marine-100">
        <h2 className="text-marine-800 text-xl font-bold mb-6 pb-3 border-b border-marine-100">
          ✍️ Signature et date
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Date du jour */}
          <div>
            <label className="block text-marine-700 font-semibold mb-2">
              Date de la demande
            </label>
            <div className="border-2 border-marine-100 rounded-xl px-4 py-3 text-marine-900 text-lg bg-marine-50">
              {new Date(dateAujourdhui_).toLocaleDateString('fr-FR', {
                day: '2-digit', month: '2-digit', year: 'numeric'
              })}
            </div>
          </div>

          {/* Nom affiché */}
          <div>
            <label className="block text-marine-700 font-semibold mb-2">
              Salarié
            </label>
            <div className="border-2 border-marine-100 rounded-xl px-4 py-3 text-marine-900 text-lg bg-marine-50 min-h-[52px]">
              {nomComplet || <span className="text-marine-300 italic">Saisissez votre nom ci-dessus</span>}
            </div>
          </div>
        </div>

        {/* Case à cocher certification */}
        <label className="flex items-start gap-4 mt-5 cursor-pointer group">
          <input
            type="checkbox"
            checked={certifie}
            onChange={(e) => setCertifie(e.target.checked)}
            className="w-6 h-6 mt-0.5 accent-orange-500 cursor-pointer flex-shrink-0"
          />
          <span className="text-marine-700 text-base group-hover:text-marine-900 transition-colors">
            Je certifie l&apos;exactitude des informations saisies dans ce formulaire.
            {nomComplet && <strong className="ml-1 text-marine-800">— {nomComplet}</strong>}
          </span>
        </label>
      </section>

      {/* Bouton de soumission */}
      <button
        type="submit"
        disabled={loading || !certifie}
        className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-marine-200 disabled:text-marine-400 text-white font-bold text-xl py-5 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-3">
            <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Envoi en cours...
          </span>
        ) : (
          'Envoyer la demande'
        )}
      </button>
    </form>
    </>
  )
}
