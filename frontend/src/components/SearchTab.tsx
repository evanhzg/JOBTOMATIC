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
    <div className="max-w-5xl mx-auto py-6 space-y-6 font-mono">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#242424] pb-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2 uppercase tracking-wider">
            <Search className="h-5 w-5 text-[#C5EA4B]" />
            CIBLES DE RECHERCHE & VEILLE EMPLOI
          </h2>
          <p className="text-xs text-[#8E8E8E] mt-1">
            Définissez les métiers, contrats (Alternance, Intérim...) et localisations (Rouen) à scanner.
          </p>
        </div>

        <button
          onClick={onRunSearchNow}
          disabled={isLoading}
          className="bg-[#C5EA4B] hover:bg-[#d6f859] text-black font-black px-4 py-2.5 text-xs flex items-center gap-2 border border-[#C5EA4B] transition-all self-start sm:self-auto"
        >
          <Play className="h-4 w-4 fill-black" />
          <span>LANCER LA RECHERCHE MAINTENANT</span>
        </button>
      </div>

      {/* Query Creator Card */}
      <div className="bg-[#141414] border border-[#242424] p-6 space-y-6">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-[#242424] pb-3">
          <Plus className="h-4 w-4 text-[#C5EA4B]" /> Ajouter une Nouvelle Requête de Veille
        </h3>

        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            
            <div className="md:col-span-6 space-y-1">
              <label className="block text-xs font-bold text-[#8E8E8E] uppercase">
                Métier / Intitulé Cible :
              </label>
              <input
                type="text"
                placeholder="Ex: Alternance Développeur Python, Intérim..."
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                className="w-full bg-[#0C0C0C] border border-[#282828] px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#C5EA4B]"
                required
              />
            </div>

            <div className="md:col-span-4 space-y-1">
              <label className="block text-xs font-bold text-[#8E8E8E] uppercase">
                Ville / Zone :
              </label>
              <div className="relative">
                <MapPin className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8E8E]" />
                <input
                  type="text"
                  placeholder="Ex: Rouen, Le Havre..."
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-[#0C0C0C] border border-[#282828] pl-9 pr-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#C5EA4B]"
                  required
                />
              </div>
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="block text-xs font-bold text-[#8E8E8E] uppercase">
                Rayon (km) :
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className="w-full bg-[#0C0C0C] border border-[#282828] px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#C5EA4B]"
              />
            </div>

          </div>

          {/* Contract Types */}
          <div className="space-y-2 pt-2">
            <span className="block text-xs font-bold text-[#8E8E8E] uppercase">
              Types de contrats acceptés :
            </span>
            <div className="flex flex-wrap gap-1.5">
              {CONTRACT_OPTIONS.map((contract) => {
                const isSelected = selectedContracts.includes(contract);
                return (
                  <button
                    type="button"
                    key={contract}
                    onClick={() => toggleContract(contract)}
                    className={`px-3 py-1 text-xs font-bold transition-all border ${
                      isSelected
                        ? 'bg-[#C5EA4B] text-black border-[#C5EA4B]'
                        : 'bg-[#0C0C0C] text-[#8E8E8E] border-[#262626] hover:text-white'
                    }`}
                  >
                    {contract.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Platforms to scan */}
          <div className="space-y-2 pt-2">
            <span className="block text-xs font-bold text-[#8E8E8E] uppercase">
              Plateformes et Portails à prospecter :
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORM_OPTIONS.map((plat) => {
                const isSelected = selectedPlatforms.includes(plat);
                return (
                  <button
                    type="button"
                    key={plat}
                    onClick={() => togglePlatform(plat)}
                    className={`px-3 py-1 text-xs font-bold transition-all border ${
                      isSelected
                        ? 'bg-[#182610] text-[#C5EA4B] border-[#C5EA4B]'
                        : 'bg-[#0C0C0C] text-[#8E8E8E] border-[#262626] hover:text-white'
                    }`}
                  >
                    {plat.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-3 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#C5EA4B] hover:bg-[#d6f859] text-black font-black px-6 py-2 text-xs flex items-center gap-2 border border-[#C5EA4B] transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>AJOUTER CETTE CIBLE</span>
            </button>
          </div>
        </form>
      </div>

      {/* Existing Queries List */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
          Cibles Actives ({queries.length})
        </h3>

        {queries.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {queries.map((q) => (
              <div 
                key={q.id}
                className="bg-[#141414] border border-[#242424] p-4 flex flex-col justify-between gap-3 hover:border-[#444444] transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-white text-sm">{q.query_text}</h4>
                    <button
                      onClick={() => onDeleteQuery(q.id)}
                      className="text-[#8E8E8E] hover:text-[#FA5F11] transition-colors p-1"
                      title="Supprimer cette cible"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-[#8E8E8E] mt-2">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-[#666666]" />
                      {q.location} ({q.radius_km} km)
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-[#666666]" />
                      {q.last_run_at ? `Scanné le ${new Date(q.last_run_at).toLocaleDateString()}` : 'Jamais scanné'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 border-t border-[#242424] pt-2">
                  {q.contract_types.map((c, i) => (
                    <span key={i} className="text-[10px] bg-[#0C0C0C] text-[#C5EA4B] border border-[#262626] px-1.5 py-0.5">
                      {c}
                    </span>
                  ))}
                  {q.platforms.map((p, i) => (
                    <span key={i} className="text-[10px] bg-[#0C0C0C] text-[#8E8E8E] border border-[#262626] px-1.5 py-0.5">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-[#141414] border border-dashed border-[#242424] p-8 text-center text-xs text-[#666666]">
            <Layers className="h-8 w-8 mx-auto mb-2 text-[#444444]" />
            <span>Aucune cible configurée. Créez-en une ci-dessus pour lancer la veille.</span>
          </div>
        )}
      </div>
    </div>
  );
};
