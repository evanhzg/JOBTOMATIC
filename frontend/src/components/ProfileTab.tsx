import React, { useState, useRef } from 'react';
import { 
  CandidateProfile, 
  EfficiencyReport, 
  EfficiencySubMetric, 
  MetricVariantsResponse 
} from '../types';
import * as api from '../api';
import { 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  Copy, 
  RefreshCw, 
  Eye, 
  ExternalLink, 
  Wand2, 
  X,
  Target,
  BarChart3,
  Sliders,
  Check
} from 'lucide-react';

interface ProfileTabProps {
  profile: CandidateProfile | null;
  onSaveProfile: (profile: CandidateProfile) => Promise<void>;
  isLoading: boolean;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  profile,
  onSaveProfile,
  isLoading
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isGeneratingVariants, setIsGeneratingVariants] = useState(false);
  const [activeVariantMetric, setActiveVariantMetric] = useState<string | null>(null);
  const [variantsModalData, setVariantsModalData] = useState<MetricVariantsResponse | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'audit_and_preview' | 'text_data'>('audit_and_preview');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse efficiency metrics
  let efficiencyReport: EfficiencyReport | null = null;
  if (profile?.efficiency_metrics) {
    if (typeof profile.efficiency_metrics === 'string') {
      try {
        efficiencyReport = JSON.parse(profile.efficiency_metrics);
      } catch {
        efficiencyReport = null;
      }
    } else {
      efficiencyReport = profile.efficiency_metrics as EfficiencyReport;
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const res = await api.uploadOriginalCv(file);
      setUploadSuccess(`CV "${file.name}" importé avec succès ! Design original préservé et audit calculé.`);
      // Reload profile
      const updated = await api.fetchProfile();
      await onSaveProfile(updated);
    } catch (err: any) {
      setUploadError(err.message || 'Erreur lors du téléversement du fichier.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRunAudit = async () => {
    setIsAuditing(true);
    try {
      await api.inspectCvEfficiency();
      const updated = await api.fetchProfile();
      await onSaveProfile(updated);
    } catch (err) {
      console.error('Erreur audit CV:', err);
    } finally {
      setIsAuditing(false);
    }
  };

  const handleOpenVariants = async (metric: EfficiencySubMetric) => {
    setActiveVariantMetric(metric.name);
    setIsGeneratingVariants(true);
    setVariantsModalData(null);
    try {
      const data = await api.generateMetricVariants(metric.id);
      setVariantsModalData(data);
    } catch (err) {
      console.error('Erreur génération variantes:', err);
    } finally {
      setIsGeneratingVariants(false);
    }
  };

  const handleCopyVariant = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2500);
  };

  const hasOriginalCv = !!profile?.original_cv_path;

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans pb-12">
      
      {/* Top Header & Tabs - Pickles Not Rounded Style */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#242424] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-white font-mono uppercase tracking-wider">
              CV ORIGINAL & <span className="text-[#C5EA4B]">AUDIT D'EFFICACITÉ IA</span>
            </h2>
            <span className="text-[10px] font-mono bg-[#181818] text-[#C5EA4B] border border-[#333333] px-2 py-0.5">
              [DESIGN ORIGINAL 100% PRÉSERVÉ]
            </span>
          </div>
          <p className="text-xs font-mono text-[#8E8E8E] mt-1">
            Importez votre vrai CV pour conserver sa mise en page et charte graphique. L'IA l'inspecte selon 5 axes et propose des variantes si un score est &lt; 80%.
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center bg-[#141414] border border-[#242424] p-0.5 font-mono text-xs">
          <button
            onClick={() => setActiveView('audit_and_preview')}
            className={`px-3 py-1.5 font-bold transition-all border ${
              activeView === 'audit_and_preview'
                ? 'bg-[#C5EA4B] text-[#0C0C0C] border-[#C5EA4B]'
                : 'bg-transparent text-[#8E8E8E] border-transparent hover:text-white'
            }`}
          >
            [01] AUDIT & DOCUMENT ORIGINAL
          </button>
          <button
            onClick={() => setActiveView('text_data')}
            className={`px-3 py-1.5 font-bold transition-all border ${
              activeView === 'text_data'
                ? 'bg-[#C5EA4B] text-[#0C0C0C] border-[#C5EA4B]'
                : 'bg-transparent text-[#8E8E8E] border-transparent hover:text-white'
            }`}
          >
            [02] DONNÉES CANDIDAT
          </button>
        </div>
      </div>

      {/* Alerts */}
      {uploadSuccess && (
        <div className="bg-[#142310] border border-[#C5EA4B] text-[#C5EA4B] p-3 text-xs font-mono flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{uploadSuccess}</span>
          </div>
          <button onClick={() => setUploadSuccess(null)} className="text-[#C5EA4B] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {uploadError && (
        <div className="bg-[#2A1212] border border-[#FA5F11] text-[#FA5F11] p-3 text-xs font-mono flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
          <button onClick={() => setUploadError(null)} className="text-[#FA5F11] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {activeView === 'audit_and_preview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column (5 Cols): AI Efficiency Gauges & Metrics < 80% Threshold Generator */}
          <div className="lg:col-span-5 space-y-5">
            
            {/* Upload Box / CV Status */}
            <div className="bg-[#141414] border border-[#242424] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase text-white flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-[#C5EA4B]" />
                  Fichier CV Importé
                </span>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept=".pdf" 
                  className="hidden" 
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="bg-[#C5EA4B] hover:bg-[#d6f859] text-[#0C0C0C] font-mono text-xs font-black px-3 py-1.5 flex items-center gap-1.5 border border-[#C5EA4B] transition-all"
                >
                  <UploadCloud className="h-3.5 w-3.5" />
                  <span>{isUploading ? 'IMPORT EN COURS...' : hasOriginalCv ? 'REMPLACER LE CV' : 'IMPORTER MON CV (PDF)'}</span>
                </button>
              </div>

              {hasOriginalCv ? (
                <div className="bg-[#0C0C0C] border border-[#262626] p-2.5 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-[#C5EA4B]">✔</span>
                    <span className="text-[#E0E0E0] truncate font-bold">{profile?.original_cv_filename || 'cv_original.pdf'}</span>
                  </div>
                  <a
                    href="/api/profile/original-cv"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[#C5EA4B] hover:underline flex items-center gap-1 shrink-0 ml-2"
                  >
                    <span>Ouvrir</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ) : (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#333333] hover:border-[#C5EA4B] bg-[#0C0C0C] p-6 text-center cursor-pointer transition-colors"
                >
                  <UploadCloud className="h-8 w-8 text-[#666666] mx-auto mb-2" />
                  <p className="text-xs font-mono text-[#CCCCCC] font-bold">
                    Cliquez ou glissez-déposez votre CV (PDF) ici
                  </p>
                  <p className="text-[10px] font-mono text-[#777777] mt-1">
                    Conserve fidèlement votre maquette originale pour chaque candidature
                  </p>
                </div>
              )}
            </div>

            {/* Overall Score & Efficiency Calculation */}
            <div className="bg-[#141414] border border-[#242424] p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-[#C5EA4B]" />
                  <h3 className="text-sm font-mono font-bold uppercase text-white tracking-wider">
                    Score Global d'Efficacité
                  </h3>
                </div>
                <button
                  onClick={handleRunAudit}
                  disabled={isAuditing}
                  className="text-[11px] font-mono text-[#8E8E8E] hover:text-[#C5EA4B] flex items-center gap-1 transition-colors"
                  title="Recalculer les pourcentages avec l'IA"
                >
                  <RefreshCw className={`h-3 w-3 ${isAuditing ? 'animate-spin text-[#C5EA4B]' : ''}`} />
                  <span>{isAuditing ? 'Calcul...' : 'Re-calculer'}</span>
                </button>
              </div>

              {/* Large Score Display */}
              <div className="bg-[#0C0C0C] border border-[#262626] p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black font-mono text-[#C5EA4B]">
                      {efficiencyReport?.overall_score ?? 76}
                    </span>
                    <span className="text-xs font-mono text-[#777777]">/ 100%</span>
                  </div>
                  <p className="text-[11px] font-mono text-[#8E8E8E] mt-0.5">
                    Indice synthétique d'attractivité ATS & Recruteurs
                  </p>
                </div>
                
                <div className="text-right">
                  <span className={`inline-block font-mono text-xs font-bold px-2.5 py-1 border ${
                    (efficiencyReport?.overall_score ?? 76) >= 80 
                      ? 'bg-[#182610] text-[#C5EA4B] border-[#C5EA4B]' 
                      : 'bg-[#2A1810] text-[#FA5F11] border-[#FA5F11]'
                  }`}>
                    {(efficiencyReport?.overall_score ?? 76) >= 80 ? 'EXCELLENT' : 'OPTIMISABLE'}
                  </span>
                </div>
              </div>

              {/* Threshold Note */}
              <div className="text-[11px] font-mono text-[#777777] bg-[#101010] p-2.5 border-l-2 border-[#C5EA4B]">
                ⚡ <strong>Seuil d'excellence : 80%</strong>. Tout sous-score sous 80% est signalé et l'IA propose 3 variantes rédigées pour le hisser à 95-100%.
              </div>

              {/* The 5 Sub-metrics */}
              <div className="space-y-3.5 pt-1">
                {(efficiencyReport?.sub_metrics || [
                  {
                    id: 'ats_keywords',
                    name: 'Alignement Mots-Clés ATS',
                    score: 75,
                    is_below_80: true,
                    diagnosis: 'Vocabulaire un peu trop généraliste, manque de termes techniques stricts.',
                    short_advice: 'Intégrer les technologies et outils ciblés dans l\'accroche.'
                  },
                  {
                    id: 'impact_metrics',
                    name: 'Impact & Résultats Chiffrés',
                    score: 68,
                    is_below_80: true,
                    diagnosis: 'Les missions décrivent des tâches plutôt que des réalisations mesurables.',
                    short_advice: 'Ajouter des chiffres (pourcentages, volumes traités, délais économisés).'
                  },
                  {
                    id: 'clarity_structure',
                    name: 'Clarté, Structure & Lisibilité',
                    score: 88,
                    is_below_80: false,
                    diagnosis: 'Structure hiérarchique nette et facile à parcourir en moins de 10 secondes.',
                    short_advice: 'Excellente clarté globale.'
                  },
                  {
                    id: 'target_relevance',
                    name: 'Pertinence Marché (Rouen & Métiers)',
                    score: 84,
                    is_below_80: false,
                    diagnosis: 'Bon ciblage géographique et cohérence avec les missions de la région.',
                    short_advice: 'Indiquer la mobilité immédiate.'
                  },
                  {
                    id: 'skills_density',
                    name: 'Densité des Compétences Clés',
                    score: 80,
                    is_below_80: false,
                    diagnosis: 'Socle technique complet et structuré.',
                    short_advice: 'Maintenir à jour avec les dernières versions.'
                  }
                ]).map((metric) => {
                  const isLow = metric.score < 80;
                  return (
                    <div 
                      key={metric.id}
                      className={`border p-3 space-y-2 transition-all ${
                        isLow 
                          ? 'bg-[#181210] border-[#442211]' 
                          : 'bg-[#0E0E0E] border-[#222222]'
                      }`}
                    >
                      {/* Metric Header & Score */}
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          {isLow ? (
                            <span className="text-[#FA5F11]">●</span>
                          ) : (
                            <span className="text-[#C5EA4B]">✔</span>
                          )}
                          {metric.name}
                        </span>

                        <div className="flex items-center gap-2">
                          <span className={`font-mono font-black ${isLow ? 'text-[#FA5F11]' : 'text-[#C5EA4B]'}`}>
                            {metric.score}%
                          </span>
                          {isLow && (
                            <span className="text-[9px] font-bold bg-[#FA5F11]/20 text-[#FA5F11] border border-[#FA5F11]/40 px-1.5 py-0.2">
                              &lt; 80%
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar (Sharp, 0px border radius) */}
                      <div className="w-full bg-[#202020] h-1.5 overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 ${
                            isLow ? 'bg-[#FA5F11]' : 'bg-[#C5EA4B]'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(5, metric.score))}%` }}
                        />
                      </div>

                      {/* Diagnosis */}
                      <p className="text-[11px] font-mono text-[#AAAAAA] leading-relaxed">
                        {metric.diagnosis}
                      </p>

                      {/* Threshold Action Button for Metrics < 80% */}
                      {isLow && (
                        <div className="pt-1 flex items-center justify-between">
                          <span className="text-[10px] font-mono text-[#FA5F11]">
                            ⚠️ Recommandé : maxer cette valeur
                          </span>
                          <button
                            onClick={() => handleOpenVariants(metric)}
                            disabled={isGeneratingVariants && activeVariantMetric === metric.name}
                            className="bg-[#FA5F11] hover:bg-[#e0520c] text-black font-mono font-bold text-[10px] px-2.5 py-1 flex items-center gap-1 transition-all border border-[#FA5F11]"
                          >
                            <Sparkles className="h-3 w-3" />
                            <span>
                              {isGeneratingVariants && activeVariantMetric === metric.name 
                                ? 'Génération...' 
                                : '⚡ Proposer 3 Variantes (95-100%)'}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

            </div>

          </div>

          {/* Right Column (7 Cols): Authentic Original CV Viewer (100% Native Design) */}
          <div className="lg:col-span-7 bg-[#141414] border border-[#242424] p-4 space-y-3">
            
            <div className="flex items-center justify-between border-b border-[#242424] pb-3">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-[#C5EA4B]" />
                <h3 className="text-sm font-mono font-bold uppercase text-white tracking-wider">
                  Rendu Authentique du Document
                </h3>
              </div>
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="text-[#8E8E8E] text-[11px]">Format: PDF A4 Haute Fidélité</span>
                <a
                  href={hasOriginalCv ? "/api/profile/original-cv" : "/api/profile/preview-pdf"}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-[#222222] hover:bg-[#2C2C2C] text-[#C5EA4B] border border-[#333333] px-2.5 py-1 text-[11px] font-bold flex items-center gap-1 transition-all"
                >
                  <span>Télécharger</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            {/* Embedded Native Document Viewer */}
            <div className="w-full bg-[#0C0C0C] border border-[#262626] min-h-[720px] flex flex-col items-center justify-center relative overflow-hidden">
              {hasOriginalCv ? (
                <iframe
                  src="/api/profile/original-cv#toolbar=0&navpanes=0"
                  className="w-full h-[750px] border-none"
                  title="Aperçu CV Original"
                />
              ) : (
                <iframe
                  src="/api/profile/preview-pdf#toolbar=0&navpanes=0"
                  className="w-full h-[750px] border-none"
                  title="Aperçu CV Initial"
                />
              )}
            </div>

            <div className="bg-[#0C0C0C] border border-[#242424] p-3 text-[11px] font-mono text-[#8E8E8E] flex items-center justify-between">
              <span>
                💡 Le document affiché ci-dessus est envoyé tel quel aux recruteurs et formulaires automatisés.
              </span>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-[#C5EA4B] hover:underline font-bold shrink-0 ml-3"
              >
                Mettre à jour le document ➔
              </button>
            </div>

          </div>

        </div>
      )}

      {/* VIEW 2: RAW PROFILE DATA / METADATA */}
      {activeView === 'text_data' && (
        <div className="bg-[#141414] border border-[#242424] p-6 space-y-6">
          <div className="border-b border-[#242424] pb-3">
            <h3 className="text-sm font-mono font-bold uppercase text-white tracking-wider">
              Métadonnées Candidate & Profil Structuré
            </h3>
            <p className="text-xs font-mono text-[#8E8E8E] mt-0.5">
              Ces informations alimentent le remplissage automatique des formulaires Playwright et les e-mails directs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
            <div>
              <label className="block text-[#8E8E8E] mb-1">Nom complet</label>
              <input
                type="text"
                value={profile?.full_name || ''}
                disabled
                className="w-full bg-[#0C0C0C] border border-[#282828] p-2 text-white"
              />
            </div>
            <div>
              <label className="block text-[#8E8E8E] mb-1">E-mail de contact</label>
              <input
                type="email"
                value={profile?.email || ''}
                disabled
                className="w-full bg-[#0C0C0C] border border-[#282828] p-2 text-white"
              />
            </div>
            <div>
              <label className="block text-[#8E8E8E] mb-1">Téléphone</label>
              <input
                type="text"
                value={profile?.phone || ''}
                disabled
                className="w-full bg-[#0C0C0C] border border-[#282828] p-2 text-white"
              />
            </div>
            <div>
              <label className="block text-[#8E8E8E] mb-1">Localisation Cible</label>
              <input
                type="text"
                value={profile?.city || ''}
                disabled
                className="w-full bg-[#0C0C0C] border border-[#282828] p-2 text-white"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[#8E8E8E] mb-1">Titre Professionnel</label>
              <input
                type="text"
                value={profile?.headline || ''}
                disabled
                className="w-full bg-[#0C0C0C] border border-[#282828] p-2 text-white"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[#8E8E8E] mb-1">Résumé & Objectifs</label>
              <textarea
                value={profile?.summary || ''}
                rows={3}
                disabled
                className="w-full bg-[#0C0C0C] border border-[#282828] p-2 text-white"
              />
            </div>
          </div>

          <div className="border-t border-[#242424] pt-4">
            <span className="block font-mono text-xs text-[#8E8E8E] mb-2">Compétences enregistrées :</span>
            <div className="flex flex-wrap gap-1.5 font-mono text-xs">
              {profile?.skills.map((skill, i) => (
                <span key={i} className="bg-[#0C0C0C] text-[#C5EA4B] border border-[#262626] px-2 py-1">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: 3 AI VARIANTS FOR METRIC < 80% */}
      {(variantsModalData || isGeneratingVariants) && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-[#141414] border-2 border-[#C5EA4B] max-w-2xl w-full p-6 space-y-5 shadow-2xl relative">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#242424] pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[#C5EA4B]" />
                <h3 className="text-base font-black font-mono uppercase text-white tracking-wider">
                  Variantes d'Optimisation IA : <span className="text-[#C5EA4B]">{activeVariantMetric}</span>
                </h3>
              </div>
              <button
                onClick={() => setVariantsModalData(null)}
                className="text-[#8E8E8E] hover:text-white p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isGeneratingVariants ? (
              <div className="py-12 text-center space-y-3 font-mono">
                <RefreshCw className="h-8 w-8 text-[#C5EA4B] animate-spin mx-auto" />
                <p className="text-xs text-white font-bold">Génération des 3 variantes à score maximal par l'IA...</p>
                <p className="text-[11px] text-[#777777]">Modélisation STAR, impact chiffré et injection de mots-clés ATS.</p>
              </div>
            ) : variantsModalData ? (
              <div className="space-y-4">
                
                {/* Score Projection Banner */}
                <div className="bg-[#182610] border border-[#C5EA4B] p-3 flex items-center justify-between font-mono text-xs">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-[#C5EA4B]" />
                    <span className="text-white font-bold">Score projeté après intégration :</span>
                  </div>
                  <span className="bg-[#C5EA4B] text-black font-black px-2 py-0.5 text-sm">
                    {variantsModalData.projected_score}% (MAX)
                  </span>
                </div>

                <p className="text-xs font-mono text-[#AAAAAA] leading-relaxed">
                  {variantsModalData.explanation}
                </p>

                {/* 3 Variants Cards */}
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {variantsModalData.variants.map((variant, index) => (
                    <div 
                      key={index}
                      className="bg-[#0C0C0C] border border-[#282828] p-3.5 space-y-2 hover:border-[#C5EA4B] transition-all"
                    >
                      <div className="flex items-center justify-between font-mono">
                        <span className="text-xs font-bold text-[#C5EA4B]">
                          [{index + 1}] {variant.title}
                        </span>
                        <button
                          onClick={() => handleCopyVariant(variant.content, index)}
                          className="bg-[#1A1A1A] hover:bg-[#252525] text-white border border-[#333333] px-2.5 py-1 text-[11px] font-bold flex items-center gap-1 transition-all"
                        >
                          {copiedIndex === index ? (
                            <>
                              <Check className="h-3 w-3 text-[#C5EA4B]" />
                              <span className="text-[#C5EA4B]">Copié !</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span>Copier</span>
                            </>
                          )}
                        </button>
                      </div>

                      <p className="text-xs font-mono text-white leading-relaxed bg-[#141414] p-2.5 border border-[#1E1E1E]">
                        {variant.content}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Footer advice */}
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setVariantsModalData(null)}
                    className="bg-[#C5EA4B] hover:bg-[#d6f859] text-black font-mono font-black text-xs px-5 py-2 border border-[#C5EA4B] transition-all"
                  >
                    FERMER
                  </button>
                </div>

              </div>
            ) : null}

          </div>
        </div>
      )}

    </div>
  );
};
