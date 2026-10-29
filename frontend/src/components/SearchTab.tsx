import React, { useState } from 'react';
import { SearchQuery } from '../types';
import { 
  Search, 
  MapPin, 
  Plus, 
  Trash2, 
  Play, 
  Layers, 
  Clock 
} from 'lucide-react';

interface SearchTabProps {
  queries: SearchQuery[];
  onAddQuery: (query: {
    query_text: string;
    location: string;
    radius_km: number;
    contract_types: string[];
    platforms: string[];
  }) => Promise<void>;
  onDeleteQuery: (id: number) => Promise<void>;
  onRunSearchNow: () => Promise<void>;
  isLoading: boolean;
}

const CONTRACT_OPTIONS = ['Alternance', 'Apprentissage', 'Intérim', 'CDI', 'CDD', 'Stage'];
const PLATFORM_OPTIONS = ['France Travail', 'Indeed', 'HelloWork', 'Adecco / Manpower / Randstad'];

export const SearchTab: React.FC<SearchTabProps> = ({
  queries,
  onAddQuery,
  onDeleteQuery,
  onRunSearchNow,
  isLoading
}) => {
  const [queryText, setQueryText] = useState('Alternance Développeur');
  const [location, setLocation] = useState('Rouen');
  const [radiusKm, setRadiusKm] = useState(25);
  const [selectedContracts, setSelectedContracts] = useState<string[]>(['Alternance', 'Apprentissage']);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['France Travail', 'Indeed', 'HelloWork']);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleContract = (c: string) => {
    setSelectedContracts(prev => 
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    );
  };

  const togglePlatform = (p: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryText.trim() || !location.trim()) return;

    setIsSubmitting(true);
    try {
      await onAddQuery({
        query_text: queryText.trim(),
        location: location.trim(),
        radius_km: radiusKm,
        contract_types: selectedContracts.length > 0 ? selectedContracts : ['Alternance'],
        platforms: selectedPlatforms.length > 0 ? selectedPlatforms : ['France Travail']
      });
      setQueryText('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-pickle-border pb-4">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2 font-['Inter_Tight',sans-serif]">
            <Search className="h-5 w-5 text-pickle-lime" />
            Cibles de Recherche & Veille Emploi
          </h2>
          <p className="text-xs text-pickle-subtle mt-1">
            Définissez les métiers, contrats (Alternance, Intérim...) et localisations (Rouen) à scanner.
          </p>
        </div>

        <button
          onClick={onRunSearchNow}
          disabled={isLoading}
          className="bg-pickle-lime hover:bg-pickle-limeHover text-pickle-dark font-black px-4 py-2.5 rounded-full text-xs flex items-center gap-2 shadow-lg shadow-pickle-lime/20 active:scale-95 transition-all self-start sm:self-auto"
        >
          <Play className="h-4 w-4 fill-pickle-dark" />
          <span>Lancer la recherche maintenant</span>
        </button>
      </div>

      {/* Query Creator Card */}
      <div className="bg-pickle-card border border-pickle-border rounded-3xl p-6 shadow-xl space-y-6">
        <h3 className="font-extrabold text-sm text-white flex items-center gap-2 font-['Inter_Tight',sans-serif]">
          <Plus className="h-4 w-4 text-pickle-lime" />
          Ajouter une nouvelle recherche ciblée
        </h3>

        <form onSubmit={handleAdd} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-pickle-subtle mb-1.5">
                Intitulé ou mots-clés du poste
              </label>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  type="text"
                  placeholder="ex: Alternance Développeur Web, Intérim Logistique..."
                  value={queryText}
                  onChange={(e) => setQueryText(e.target.value)}
                  required
                  className="w-full bg-pickle-dark border border-pickle-border rounded-full pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-pickle-lime"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-pickle-subtle mb-1.5">
                Ville / Zone
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <MapPin className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input
                    type="text"
                    placeholder="ex: Rouen, Normandie..."
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    required
                    className="w-full bg-pickle-dark border border-pickle-border rounded-full pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-pickle-lime"
                  />
                </div>
                <div className="bg-pickle-dark border border-pickle-border rounded-full px-3.5 flex items-center text-xs text-pickle-subtle whitespace-nowrap">
                  Rayon : {radiusKm} km
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] text-pickle-subtle mb-1">
              <span>Rayon : {radiusKm} km</span>
              <span>Max: 100 km</span>
            </div>
            <input
              type="range"
              min="5"
              max="100"
              step="5"
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="w-full accent-pickle-lime"
            />
          </div>

          {/* Contracts */}
          <div>
            <label className="block text-xs font-semibold text-pickle-subtle mb-2">
              Types de contrat
            </label>
            <div className="flex flex-wrap gap-2">
              {CONTRACT_OPTIONS.map((c) => {
                const active = selectedContracts.includes(c);
                return (
                  <button
                    type="button"
                    key={c}
                    onClick={() => toggleContract(c)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                      active
                        ? 'bg-pickle-lime text-pickle-dark border-pickle-lime shadow-sm'
                        : 'bg-pickle-dark text-pickle-subtle border-pickle-border hover:border-neutral-700'
                    }`}
                  >
                    {active ? '✓ ' : '+ '}{c}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Platforms */}
          <div>
            <label className="block text-xs font-semibold text-pickle-subtle mb-2">
              Plateformes ciblées
            </label>
            <div className="flex flex-wrap gap-2">
              {PLATFORM_OPTIONS.map((p) => {
                const active = selectedPlatforms.includes(p);
                return (
                  <button
                    type="button"
                    key={p}
                    onClick={() => togglePlatform(p)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                      active
                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/50 shadow-sm'
                        : 'bg-pickle-dark text-pickle-subtle border-pickle-border hover:border-neutral-700'
                    }`}
                  >
                    {active ? '✓ ' : '+ '}{p}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-pickle-lime hover:bg-pickle-limeHover text-pickle-dark font-black px-5 py-2.5 rounded-full text-xs flex items-center gap-2 shadow-md shadow-pickle-lime/20 active:scale-95 transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>Enregistrer cette cible</span>
            </button>
          </div>
        </form>
      </div>

      {/* Active Queries */}
      <div className="space-y-4">
        <h3 className="font-extrabold text-sm text-white font-['Inter_Tight',sans-serif]">
          Cibles Actives en Veille ({queries.length})
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {queries.map((q) => (
            <div
              key={q.id}
              className="bg-pickle-card border border-pickle-border rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-md hover:border-neutral-700 transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-extrabold text-sm text-white">{q.query_text}</h4>
                  <button
                    onClick={() => onDeleteQuery(q.id)}
                    className="text-neutral-500 hover:text-red-400 p-1"
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs text-pickle-subtle mt-1">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-neutral-500" />
                    {q.location} (+{q.radius_km}km)
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap gap-1">
                  {q.contract_types.map((c, i) => (
                    <span key={i} className="bg-pickle-lime/10 text-pickle-lime border border-pickle-lime/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                      {c}
                    </span>
                  ))}
                  {q.platforms.map((p, i) => (
                    <span key={i} className="bg-neutral-900 text-pickle-subtle border border-neutral-800 text-[10px] px-2 py-0.5 rounded-full">
                      {p}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between text-[11px] text-pickle-subtle pt-2 border-t border-pickle-border">
                  <span className="flex items-center gap-1">
                    <Layers className="h-3 w-3" /> {q.total_found} offres trouvées
                  </span>
                  {q.last_run_at && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Dernier scan : {new Date(q.last_run_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>

            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
