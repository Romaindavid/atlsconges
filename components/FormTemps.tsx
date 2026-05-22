'use client'

import { useState } from 'react'
import { dateAujourdhui } from '@/lib/calcul-jours'
import { soumettreFeuilleTemps } from '@/app/temps/actions'

type LigneBateau = {
  id: number
  nom_bateau: string
  heures: string
}

let nextId = 1

export default function FormTemps() {
  const aujourd = dateAujourdhui()

  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [dateJournee, setDateJournee] = useState(aujourd)
  const [heuresTravaillees, setHeuresTravaillees] = useState('')
  const [heuresARecuperer, setHeuresARecuperer] = useState('0')
  const [lignesBateaux, setLignesBateaux] = useState<LigneBateau[]>([])

  const [loading, setLoading] = useState(false)
  const [resultat, setResultat] = useState<{ success: boolean; message: string } | null>(null)

  function ajouterBateau() {
    setLignesBateaux((prev) => [
      ...prev,
      { id: nextId++, nom_bateau: '', heures: '' },
    ])
  }

  function supprimerBateau(id: number) {
    setLignesBateaux((prev) => prev.filter((l) => l.id !== id))
  }

  function modifierBateau(id: number, champ: 'nom_bateau' | 'heures', valeur: string) {
    setLignesBateaux((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [champ]: valeur } : l))
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setResultat(null)

    const res = await soumettreFeuilleTemps({
      nom,
      prenom,
      date_journee: dateJournee,
      heures_travaillees: heuresTravaillees ? parseFloat(heuresTravaillees) : null,
      heures_a_recuperer: parseFloat(heuresARecuperer) || 0,
      pointes_bateaux: lignesBateaux
        .filter((l) => l.nom_bateau.trim() && l.heures)
        .map((l) => ({
          nom_bateau: l.nom_bateau,
          heures: parseFloat(l.heures) || 0,
        })),
    })

    setLoading(false)
    setResultat(res)

    if (res.success) {
      setNom('')
      setPrenom('')
      setDateJournee(aujourd)
      setHeuresTravaillees('')
      setHeuresARecuperer('0')
      setLignesBateaux([])
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">

      {/* Message de résultat */}
      {resultat && (
        <div
          className={`rounded-xl p-5 text-base font-medium ${
            resultat.success
              ? 'bg-success-100 text-success-600 border border-success-600/30'
              : 'bg-danger-100 text-danger-600 border border-danger-600/30'
          }`}
        >
          {resultat.success ? '✅ ' : '⚠️ '}
          {resultat.message}
        </div>
      )}

      {/* Section : Identification */}
      <section className="bg-white rounded-2xl shadow-sm p-6 border border-marine-100">
        <h2 className="text-marine-800 text-xl font-bold mb-6 pb-3 border-b border-marine-100">
          👤 Identification
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

          {/* Date */}
          <div className="sm:col-span-2">
            <label htmlFor="dateJournee" className="block text-marine-700 font-semibold mb-2">
              Date <span className="text-danger-600">*</span>
            </label>
            <input
              id="dateJournee"
              type="date"
              value={dateJournee}
              onChange={(e) => setDateJournee(e.target.value)}
              required
              className="w-full sm:w-auto border-2 border-marine-200 rounded-xl px-4 py-3 text-marine-900 text-lg focus:border-orange-500 focus:outline-none transition-colors"
            />
          </div>
        </div>
      </section>

      {/* Section : Heures */}
      <section className="bg-white rounded-2xl shadow-sm p-6 border border-marine-100">
        <h2 className="text-marine-800 text-xl font-bold mb-6 pb-3 border-b border-marine-100">
          ⏱️ Temps de travail
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Heures travaillées */}
          <div>
            <label htmlFor="heuresTravaillees" className="block text-marine-700 font-semibold mb-2">
              Heures travaillées
            </label>
            <input
              id="heuresTravaillees"
              type="number"
              step="0.25"
              min="0"
              max="24"
              value={heuresTravaillees}
              onChange={(e) => setHeuresTravaillees(e.target.value)}
              placeholder="Ex : 7.5"
              className="w-full border-2 border-marine-200 rounded-xl px-4 py-3 text-marine-900 text-lg placeholder:text-marine-300 focus:border-orange-500 focus:outline-none transition-colors"
            />
            <p className="text-sm text-marine-500 mt-1">
              Exemples : 7, 7.5, 8.25
            </p>
          </div>

          {/* Heures à récupérer */}
          <div>
            <label htmlFor="heuresARecuperer" className="block text-marine-700 font-semibold mb-2">
              Heures à récupérer
            </label>
            <input
              id="heuresARecuperer"
              type="number"
              step="0.25"
              value={heuresARecuperer}
              onChange={(e) => setHeuresARecuperer(e.target.value)}
              placeholder="0"
              className="w-full border-2 border-marine-200 rounded-xl px-4 py-3 text-marine-900 text-lg placeholder:text-marine-300 focus:border-orange-500 focus:outline-none transition-colors"
            />
            {/* Explication inline */}
            <div className="mt-2 p-3 bg-marine-50 rounded-lg text-sm text-marine-600">
              <p><strong>+</strong> si la direction vous doit des heures (ex : +2 = vous avez fait 2h de plus)</p>
              <p className="mt-1"><strong>–</strong> si vous devez des heures (ex : -1 = vous êtes parti 1h plus tôt)</p>
            </div>
          </div>
        </div>
      </section>

      {/* Section : Pointés bateaux */}
      <section className="bg-white rounded-2xl shadow-sm p-6 border border-marine-100">
        <h2 className="text-marine-800 text-xl font-bold mb-2 pb-3 border-b border-marine-100">
          ⛵ Pointés bateaux
        </h2>
        <p className="text-marine-500 text-sm mb-5">
          Si vous avez travaillé sur des bateaux aujourd&apos;hui, ajoutez chaque bateau avec le nombre d&apos;heures associé.
        </p>

        {/* Liste des bateaux */}
        {lignesBateaux.length > 0 && (
          <div className="space-y-3 mb-4">
            {/* En-tête */}
            <div className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[1fr_140px_auto] gap-3 text-marine-600 text-sm font-semibold px-1">
              <span>Nom du bateau</span>
              <span>Heures</span>
              <span></span>
            </div>

            {lignesBateaux.map((ligne, index) => (
              <div
                key={ligne.id}
                className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[1fr_140px_auto] gap-3 items-center"
              >
                <input
                  type="text"
                  value={ligne.nom_bateau}
                  onChange={(e) => modifierBateau(ligne.id, 'nom_bateau', e.target.value)}
                  placeholder={`Bateau ${index + 1}`}
                  className="border-2 border-marine-200 rounded-xl px-4 py-3 text-marine-900 text-base placeholder:text-marine-300 focus:border-orange-500 focus:outline-none transition-colors"
                />
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  value={ligne.heures}
                  onChange={(e) => modifierBateau(ligne.id, 'heures', e.target.value)}
                  placeholder="0"
                  className="border-2 border-marine-200 rounded-xl px-4 py-3 text-marine-900 text-base placeholder:text-marine-300 focus:border-orange-500 focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => supprimerBateau(ligne.id)}
                  className="p-3 text-danger-600 hover:bg-danger-100 rounded-xl transition-colors"
                  aria-label="Supprimer cette ligne"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Bouton ajouter */}
        <button
          type="button"
          onClick={ajouterBateau}
          className="flex items-center gap-2 text-marine-700 hover:text-marine-900 border-2 border-dashed border-marine-300 hover:border-marine-500 px-5 py-3 rounded-xl transition-colors font-medium"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Ajouter un bateau
        </button>
      </section>

      {/* Bouton de soumission */}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-marine-200 disabled:text-marine-400 text-white font-bold text-xl py-5 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-3">
            <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Enregistrement...
          </span>
        ) : (
          'Enregistrer la feuille de temps'
        )}
      </button>
    </form>
  )
}
