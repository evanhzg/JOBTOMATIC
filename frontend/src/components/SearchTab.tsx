import React, { useState } from 'react';
import { SearchQuery } from '../types';
import { 
  Search, 
  MapPin, 
  Plus, 
  Trash2, 
  Play, 
  Layers, 
  Clock,
  Laptop
} from 'lucide-react';
import { Language, translations } from '../i18n';

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
  currentLang?: Language;
}

const CONTRACT_OPTIONS = ['Alternance', 'Apprentissage', 'Intérim', 'CDI', 'CDD', 'Stage'];
const PLATFORM_OPTIONS = ['France Travail', 'Indeed', 'HelloWork', 'Adecco / Manpower / Randstad'];

export const SearchTab: React.FC<SearchTabProps> = ({
  queries,
  onAddQuery,
  onDeleteQuery,
  onRunSearchNow,
  isLoading,
  currentLang = 'fr'
}) => {
  const [queryText, setQueryText] = useState('Alternance Développeur');
  const [location, setLocation] = useState('Rouen, Le Havre, Télétravail');
  const [radiusKm, setRadiusKm] = useState(25);
  const [selectedContracts, setSelectedContracts] = useState<string[]>(['Alternance', 'Apprentissage']);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['France Travail', 'Indeed', 'HelloWork']);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const t = translations[currentLang];

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

  const handleAddLocationTag = (loc: string) => {
    const parts = location.split(',').map(s => s.trim()).filter(Boolean);
    if (!parts.includes(loc)) {
      setLocation(parts.concat(loc).join(', '));
    }
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
    <div className="max-w-5xl mx-auto py-5 space-y-5 font-mono">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D4D4D8] pb-3 bg-white p-4 shadow-xs">
        <div>
          <h2 className="text-base font-black text-[#18181B] flex items-center gap-2 uppercase tracking-wider">
            <Search className="h-4 w-4 text-[#5F7A48]" />
            {currentLang === 'en' ? 'Job Search Targets & Monitoring' : 'Cibles de Recherche & Veille Emploi'}
          </h2>
          <p className="text-xs text-[#71717A] mt-0.5">
            {currentLang === 'en' 
              ? 'Define target roles, multiple cities (Rouen, Le Havre...), and remote/telework options.'
              : 'Définissez les métiers, plusieurs villes (Rouen, Le Havre...) et options de télétravail.'}
          </p>
        </div>

        <button
          onClick={onRunSearchNow}
          disabled={isLoading}
          className="bg-[#5F7A48] hover:bg-[#4E653A] text-white font-black px-4 py-2 text-xs flex items-center gap-1.5 border border-[#5F7A48] transition-all self-start sm:self-auto"
        >
          <Play className="h-3.5 w-3.5 fill-white" />
          <span>{t.run_search_now}</span>
        </button>
      </div>

      {/* Query Creator Card */}
      <div className="bg-[#FFFFFF] border border-[#D4D4D8] p-5 space-y-5 shadow-xs">
        <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider flex items-center gap-1.5 border-b border-[#E4E4E7] pb-2.5">
          <Plus className="h-4 w-4 text-[#5F7A48]" /> {t.add_query_title}
        </h3>

        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            
            <div className="md:col-span-6 space-y-1">
              <label className="block text-[11px] font-bold text-[#71717A] uppercase">
                {t.job_target_label}
              </label>
              <input
                type="text"
                placeholder="Ex: Alternance Développeur Python, Intérim Full-Stack..."
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                className="w-full bg-[#FAF9F6] border border-[#D4D4D8] px-3 py-1.5 text-xs text-[#18181B] focus:outline-none focus:border-[#5F7A48]"
                required
              />
            </div>

            <div className="md:col-span-4 space-y-1">
              <label className="block text-[11px] font-bold text-[#71717A] uppercase">
                {t.location_label}
              </label>
              <div className="relative">
                <MapPin className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#71717A]" />
                <input
                  type="text"
                  placeholder="Rouen, Le Havre, Paris, Télétravail..."
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-[#FAF9F6] border border-[#D4D4D8] pl-8 pr-2.5 py-1.5 text-xs text-[#18181B] focus:outline-none focus:border-[#5F7A48]"
                  required
                />
              </div>
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="block text-[11px] font-bold text-[#71717A] uppercase">
                {t.radius_label}
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className="w-full bg-[#FAF9F6] border border-[#D4D4D8] px-2.5 py-1.5 text-xs text-[#18181B] focus:outline-none focus:border-[#5F7A48]"
              />
            </div>

          </div>

          {/* Quick Multiple City & Remote tags */}
          <div className="space-y-1">
            <span className="text-[10px] text-[#71717A] font-bold uppercase">Ajout rapide de localisations :</span>
            <div className="flex flex-wrap gap-1 text-[10px]">
              <button
                type="button"
                onClick={() => handleAddLocationTag('Rouen')}
                className="bg-[#FAF9F6] hover:bg-[#F2F2EC] text-[#18181B] border border-[#D4D4D8] px-2 py-0.5 font-bold"
              >
                + Rouen
              </button>
              <button
                type="button"
                onClick={() => handleAddLocationTag('Le Havre')}
                className="bg-[#FAF9F6] hover:bg-[#F2F2EC] text-[#18181B] border border-[#D4D4D8] px-2 py-0.5 font-bold"
              >
                + Le Havre
              </button>
              <button
                type="button"
                onClick={() => handleAddLocationTag('Paris')}
                className="bg-[#FAF9F6] hover:bg-[#F2F2EC] text-[#18181B] border border-[#D4D4D8] px-2 py-0.5 font-bold"
              >
                + Paris
              </button>
              <button
                type="button"
                onClick={() => handleAddLocationTag('Télétravail / Remote')}
                className="bg-[#EEF3E9] hover:bg-[#E2EBDC] text-[#5F7A48] border border-[#C8DAC0] px-2 py-0.5 font-bold flex items-center gap-1"
              >
                <Laptop className="h-3 w-3" />
                <span>+ Télétravail / 100% Remote</span>
              </button>
            </div>
          </div>

          {/* Contract Types */}
          <div className="space-y-1.5 pt-1">
            <span className="block text-[11px] font-bold text-[#71717A] uppercase">
              {t.contracts_label}
            </span>
            <div className="flex flex-wrap gap-1">
              {CONTRACT_OPTIONS.map((contract) => {
                const isSelected = selectedContracts.includes(contract);
                return (
                  <button
                    type="button"
                    key={contract}
                    onClick={() => toggleContract(contract)}
                    className={`px-2.5 py-0.5 text-[11px] font-bold transition-all border ${
                      isSelected
                        ? 'bg-[#18181B] text-white border-[#18181B]'
                        : 'bg-[#FAF9F6] text-[#71717A] border-[#D4D4D8] hover:text-[#18181B]'
                    }`}
                  >
                    {contract.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Platforms to scan */}
          <div className="space-y-1.5 pt-1">
            <span className="block text-[11px] font-bold text-[#71717A] uppercase">
              {t.platforms_label}
            </span>
            <div className="flex flex-wrap gap-1">
              {PLATFORM_OPTIONS.map((plat) => {
                const isSelected = selectedPlatforms.includes(plat);
                return (
                  <button
                    type="button"
                    key={plat}
                    onClick={() => togglePlatform(plat)}
                    className={`px-2.5 py-0.5 text-[11px] font-bold transition-all border ${
                      isSelected
                        ? 'bg-[#EEF3E9] text-[#5F7A48] border-[#5F7A48]'
                        : 'bg-[#FAF9F6] text-[#71717A] border-[#D4D4D8] hover:text-[#18181B]'
                    }`}
                  >
                    {plat.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#5F7A48] hover:bg-[#4E653A] text-white font-black px-5 py-2 text-xs flex items-center gap-1.5 border border-[#5F7A48] transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>{t.add_query_btn}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Existing Queries List */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
          {t.active_targets} ({queries.length})
        </h3>

        {queries.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {queries.map((q) => (
              <div 
                key={q.id}
                className="bg-[#FFFFFF] border border-[#D4D4D8] p-3.5 flex flex-col justify-between gap-2.5 hover:border-[#18181B] transition-all shadow-xs"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-[#18181B] text-xs leading-snug">{q.query_text}</h4>
                    <button
                      onClick={() => onDeleteQuery(q.id)}
                      className="text-[#A1A1AA] hover:text-[#DC2626] transition-colors p-0.5"
                      title="Supprimer cette cible"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-3 text-[10.5px] text-[#71717A] mt-1.5">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-[#A1A1AA]" />
                      {q.location} ({q.radius_km} km)
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-[#A1A1AA]" />
                      {q.last_run_at ? `Scanné le ${new Date(q.last_run_at).toLocaleDateString()}` : 'Jamais scanné'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 border-t border-[#E4E4E7] pt-2">
                  {q.contract_types.map((c, i) => (
                    <span key={i} className="text-[9.5px] bg-[#EEF3E9] text-[#5F7A48] border border-[#C8DAC0] px-1.5 py-0.2">
                      {c}
                    </span>
                  ))}
                  {q.platforms.map((p, i) => (
                    <span key={i} className="text-[9.5px] bg-[#FAF9F6] text-[#71717A] border border-[#E2E2DC] px-1.5 py-0.2">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-[#FFFFFF] border border-dashed border-[#D4D4D8] p-6 text-center text-xs text-[#A1A1AA]">
            <Layers className="h-6 w-6 mx-auto mb-1 text-[#D4D4D8]" />
            <span>Aucune cible configurée. Créez-en une ci-dessus pour lancer la veille.</span>
          </div>
        )}
      </div>
    </div>
  );
};
