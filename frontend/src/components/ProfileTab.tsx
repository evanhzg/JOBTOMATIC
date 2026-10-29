import React, { useState, useRef } from 'react';
import { 
  CandidateProfile, 
  EfficiencyReport, 
  EfficiencySubMetric, 
  MetricVariantsResponse,
  TranslatedCVResponse
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
  X,
  Target,
  BarChart3,
  Check,
  Languages,
  Download
} from 'lucide-react';
import { Language, translations } from '../i18n';

interface ProfileTabProps {
  profile: CandidateProfile | null;
  onSaveProfile: (profile: CandidateProfile) => Promise<void>;
  isLoading: boolean;
  currentLang?: Language;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  profile,
  onSaveProfile,
  isLoading,
  currentLang = 'fr'
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isGeneratingVariants, setIsGeneratingVariants] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedCv, setTranslatedCv] = useState<TranslatedCVResponse | null>(null);
  const [activeVariantMetric, setActiveVariantMetric] = useState<string | null>(null);
  const [variantsModalData, setVariantsModalData] = useState<MetricVariantsResponse | null>(null);
  const [previewVariantPdf, setPreviewVariantPdf] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'audit_and_preview' | 'translation' | 'text_data'>('audit_and_preview');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = translations[currentLang];

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
      await api.uploadOriginalCv(file);
      setUploadSuccess(`CV "${file.name}" importé avec succès ! Design original préservé et audit calculé.`);
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
    setPreviewVariantPdf(null);
    try {
      const data = await api.generateMetricVariants(metric.id);
      setVariantsModalData(data);
      if (data.variants && data.variants.length > 0 && data.variants[0].pdf_url) {
        setPreviewVariantPdf(data.variants[0].pdf_url);
      }
    } catch (err) {
      console.error('Erreur génération variantes:', err);
    } finally {
      setIsGeneratingVariants(false);
    }
  };

  const handleTranslateCV = async (targetLang: 'en' | 'fr') => {
    setIsTranslating(true);
    try {
      const res = await api.translateCv(targetLang);
      setTranslatedCv(res);
      setActiveView('translation');
    } catch (err) {
      console.error('Erreur traduction CV:', err);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleCopyVariant = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2500);
  };

  const hasOriginalCv = !!profile?.original_cv_path;

  return (
    <div className="space-y-5 max-w-[1600px] mx-auto font-sans pb-12">
      
      {/* Top Header & Tabs - Pickles.app Light Minimalist Style */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#D4D4D8] pb-3 bg-[#FFFFFF] p-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-[#18181B] font-mono uppercase tracking-wider">
              {t.original_cv_title}
            </h2>
            <span className="text-[10px] font-mono bg-[#EEF3E9] text-[#5F7A48] border border-[#C8DAC0] px-2 py-0.5">
              [DESIGN 100% PRÉSERVÉ]
            </span>
          </div>
          <p className="text-xs font-mono text-[#71717A] mt-0.5">
            {t.original_cv_desc}
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center bg-[#FAF9F6] border border-[#D4D4D8] p-0.5 font-mono text-xs">
          <button
            onClick={() => setActiveView('audit_and_preview')}
            className={`px-3 py-1 font-bold transition-all border ${
              activeView === 'audit_and_preview'
                ? 'bg-[#18181B] text-[#FFFFFF] border-[#18181B]'
                : 'bg-transparent text-[#71717A] border-transparent hover:text-[#18181B]'
            }`}
          >
            {t.tab_view_doc}
          </button>
          <button
            onClick={() => setActiveView('translation')}
            className={`px-3 py-1 font-bold transition-all border ${
              activeView === 'translation'
                ? 'bg-[#18181B] text-[#FFFFFF] border-[#18181B]'
                : 'bg-transparent text-[#71717A] border-transparent hover:text-[#18181B]'
            }`}
          >
            {t.tab_view_translate}
          </button>
          <button
            onClick={() => setActiveView('text_data')}
            className={`px-3 py-1 font-bold transition-all border ${
              activeView === 'text_data'
                ? 'bg-[#18181B] text-[#FFFFFF] border-[#18181B]'
                : 'bg-transparent text-[#71717A] border-transparent hover:text-[#18181B]'
            }`}
          >
            {t.tab_view_profile}
          </button>
        </div>
      </div>

      {/* Alerts */}
      {uploadSuccess && (
        <div className="bg-[#EEF3E9] border border-[#5F7A48] text-[#5F7A48] p-2.5 text-xs font-mono flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{uploadSuccess}</span>
          </div>
          <button onClick={() => setUploadSuccess(null)} className="text-[#5F7A48] hover:text-[#18181B]">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {uploadError && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] p-2.5 text-xs font-mono flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
          <button onClick={() => setUploadError(null)} className="text-[#DC2626] hover:text-[#18181B]">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* VIEW 1: AUDIT & AUTHENTIC DOCUMENT */}
      {activeView === 'audit_and_preview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* Left Column (5 Cols): AI Efficiency Gauges & Metrics < 80% Threshold Generator */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Upload Box / CV Status */}
            <div className="bg-[#FFFFFF] border border-[#D4D4D8] p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase text-[#18181B] flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-[#5F7A48]" />
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
                  className="bg-[#5F7A48] hover:bg-[#4E653A] text-white font-mono text-xs font-black px-3 py-1 flex items-center gap-1 border border-[#5F7A48] transition-all"
                >
                  <UploadCloud className="h-3.5 w-3.5" />
                  <span>{isUploading ? 'IMPORT EN COURS...' : hasOriginalCv ? t.replace_btn : t.upload_btn}</span>
                </button>
              </div>

              {hasOriginalCv ? (
                <div className="bg-[#FAF9F6] border border-[#E2E2DC] p-2 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-[#5F7A48]">✔</span>
                    <span className="text-[#18181B] truncate font-bold">{profile?.original_cv_filename || 'cv_original.pdf'}</span>
                  </div>
                  <a
                    href="/api/profile/original-cv"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[#5F7A48] hover:underline flex items-center gap-0.5 shrink-0 ml-2"
                  >
                    <span>Ouvrir</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ) : (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#D4D4D8] hover:border-[#5F7A48] bg-[#FAF9F6] p-5 text-center cursor-pointer transition-colors"
                >
                  <UploadCloud className="h-7 w-7 text-[#A1A1AA] mx-auto mb-1.5" />
                  <p className="text-xs font-mono text-[#18181B] font-bold">
                    Cliquez ou glissez-déposez votre CV (PDF) ici
                  </p>
                  <p className="text-[10px] font-mono text-[#71717A] mt-0.5">
                    Conserve fidèlement votre maquette originale pour chaque candidature
                  </p>
                </div>
              )}
            </div>

            {/* Overall Score & Efficiency Calculation */}
            <div className="bg-[#FFFFFF] border border-[#D4D4D8] p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4 text-[#5F7A48]" />
                  <h3 className="text-xs font-mono font-bold uppercase text-[#18181B] tracking-wider">
                    {t.overall_score}
                  </h3>
                </div>
                <button
                  onClick={handleRunAudit}
                  disabled={isAuditing}
                  className="text-[11px] font-mono text-[#71717A] hover:text-[#5F7A48] flex items-center gap-1 transition-colors"
                  title="Recalculer les pourcentages avec l'IA"
                >
                  <RefreshCw className={`h-3 w-3 ${isAuditing ? 'animate-spin text-[#5F7A48]' : ''}`} />
                  <span>{isAuditing ? 'Calcul...' : t.recalculate}</span>
                </button>
              </div>

              {/* Score Display */}
              <div className="bg-[#FAF9F6] border border-[#E2E2DC] p-3 flex items-center justify-between">
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black font-mono text-[#18181B]">
                      {efficiencyReport?.overall_score ?? 76}
                    </span>
                    <span className="text-xs font-mono text-[#71717A]">/ 100%</span>
                  </div>
                  <p className="text-[10.5px] font-mono text-[#71717A] mt-0.5">
                    Indice synthétique d'attractivité ATS & Recruteurs
                  </p>
                </div>
                
                <div className="text-right">
                  <span className={`inline-block font-mono text-xs font-bold px-2 py-0.5 border ${
                    (efficiencyReport?.overall_score ?? 76) >= 80 
                      ? 'bg-[#EEF3E9] text-[#5F7A48] border-[#C8DAC0]' 
                      : 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]'
                  }`}>
                    {(efficiencyReport?.overall_score ?? 76) >= 80 ? 'EXCELLENT' : 'OPTIMISABLE'}
                  </span>
                </div>
              </div>

              {/* Threshold Note */}
              <div className="text-[10.5px] font-mono text-[#52525B] bg-[#FAF9F6] p-2 border-l-2 border-[#5F7A48]">
                {t.threshold_note}
              </div>

              {/* The 5 Sub-metrics */}
              <div className="space-y-2.5 pt-1">
                {(efficiencyReport?.sub_metrics || [
                  {
                    id: 'ats_keywords',
                    name: 'Alignement Mots-Clés ATS',
                    score: 70,
                    is_below_80: true,
                    diagnosis: 'Vocabulaire généraliste, manque de termes techniques stricts.',
                    short_advice: 'Intégrer les technologies précises du poste dans l\'en-tête.'
                  },
                  {
                    id: 'impact_metrics',
                    name: 'Impact & Résultats Chiffrés',
                    score: 65,
                    is_below_80: true,
                    diagnosis: 'Les missions décrivent des tâches plutôt que des réalisations mesurables (STAR).',
                    short_advice: 'Ajouter des chiffres (pourcentages, volumes traités, délais économisés).'
                  },
                  {
                    id: 'clarity_structure',
                    name: 'Clarté, Structure & Lisibilité',
                    score: 85,
                    is_below_80: false,
                    diagnosis: 'Structure hiérarchique claire et facilement parcourable en < 10 secondes.',
                    short_advice: 'Bonne clarté globale.'
                  },
                  {
                    id: 'target_relevance',
                    name: 'Pertinence Marché (Rouen & Métiers)',
                    score: 82,
                    is_below_80: false,
                    diagnosis: 'Bon ancrage géographique et cohérence avec les offres de la région.',
                    short_advice: 'Préciser la mobilité immédiate.'
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
                      className={`border p-2.5 space-y-1.5 transition-all ${
                        isLow 
                          ? 'bg-[#FFFDF9] border-[#FDE68A]' 
                          : 'bg-[#FFFFFF] border-[#E4E4E7]'
                      }`}
                    >
                      {/* Metric Header & Score */}
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="font-bold text-[#18181B] flex items-center gap-1.5">
                          {isLow ? (
                            <span className="text-[#B45309]">●</span>
                          ) : (
                            <span className="text-[#5F7A48]">✔</span>
                          )}
                          {metric.name}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <span className={`font-mono font-black ${isLow ? 'text-[#B45309]' : 'text-[#5F7A48]'}`}>
                            {metric.score}%
                          </span>
                          {isLow && (
                            <span className="text-[9px] font-bold bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A] px-1 py-0.1">
                              &lt; 80%
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar (Sharp, 0px border radius) */}
                      <div className="w-full bg-[#E4E4E7] h-1.5 overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 ${
                            isLow ? 'bg-[#B45309]' : 'bg-[#5F7A48]'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(5, metric.score))}%` }}
                        />
                      </div>

                      {/* Diagnosis */}
                      <p className="text-[10.5px] font-mono text-[#52525B] leading-relaxed">
                        {metric.diagnosis}
                      </p>

                      {/* Threshold Action Button for Metrics < 80% */}
                      {isLow && (
                        <div className="pt-1 flex items-center justify-between">
                          <span className="text-[9.5px] font-mono text-[#B45309]">
                            Recommandé : optimiser
                          </span>
                          <button
                            onClick={() => handleOpenVariants(metric)}
                            disabled={isGeneratingVariants && activeVariantMetric === metric.name}
                            className="bg-[#18181B] hover:bg-[#27272A] text-white font-mono font-bold text-[10px] px-2 py-0.5 flex items-center gap-1 transition-all border border-[#18181B]"
                          >
                            <Sparkles className="h-2.5 w-2.5 text-[#EEF3E9]" />
                            <span>
                              {isGeneratingVariants && activeVariantMetric === metric.name 
                                ? 'Génération...' 
                                : '⚡ Proposer 3 Variantes Visuelles'}
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
          <div className="lg:col-span-7 bg-[#FFFFFF] border border-[#D4D4D8] p-4 space-y-3 shadow-xs">
            
            <div className="flex items-center justify-between border-b border-[#E4E4E7] pb-2.5">
              <div className="flex items-center gap-1.5">
                <Eye className="h-4 w-4 text-[#5F7A48]" />
                <h3 className="text-xs font-mono font-bold uppercase text-[#18181B] tracking-wider">
                  Rendu Authentique du Document
                </h3>
              </div>
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="text-[#71717A] text-[10.5px]">Format : PDF A4 Haute Fidélité</span>
                <a
                  href={hasOriginalCv ? "/api/profile/original-cv" : "/api/profile/preview-pdf"}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-[#FAF9F6] hover:bg-[#F2F2EC] text-[#18181B] border border-[#D4D4D8] px-2 py-0.5 text-[10.5px] font-bold flex items-center gap-1 transition-all"
                >
                  <span>Télécharger</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            {/* Embedded Native Document Viewer (Loads inline without triggering auto-download) */}
            <div className="w-full bg-[#FAF9F6] border border-[#E2E2DC] min-h-[680px] flex flex-col items-center justify-center relative overflow-hidden">
              {hasOriginalCv ? (
                <iframe
                  src="/api/profile/original-cv#toolbar=0&navpanes=0"
                  className="w-full h-[700px] border-none"
                  title="Aperçu CV Original"
                />
              ) : (
                <iframe
                  src="/api/profile/preview-pdf#toolbar=0&navpanes=0"
                  className="w-full h-[700px] border-none"
                  title="Aperçu CV Initial"
                />
              )}
            </div>

            <div className="bg-[#FAF9F6] border border-[#E2E2DC] p-2.5 text-[10.5px] font-mono text-[#52525B] flex items-center justify-between">
              <span>
                💡 Le document affiché ci-dessus est envoyé tel quel aux recruteurs et formulaires automatisés.
              </span>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-[#5F7A48] hover:underline font-bold shrink-0 ml-2"
              >
                Mettre à jour le document ➔
              </button>
            </div>

          </div>

        </div>
      )}

      {/* VIEW 2: TRANSLATED CV (FR / EN) WITH VISUAL PDF PREVIEWS */}
      {activeView === 'translation' && (
        <div className="bg-[#FFFFFF] border border-[#D4D4D8] p-5 space-y-5 shadow-xs font-mono">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E4E4E7] pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Languages className="h-5 w-5 text-[#5F7A48]" />
                <h3 className="text-sm font-bold uppercase text-[#18181B] tracking-wider">
                  Générateur de CV Bilingue (Français ⟷ English ATS)
                </h3>
              </div>
              <p className="text-xs text-[#71717A] mt-0.5">
                L'IA traduit et restructure votre CV avec le vocabulaire international standard (Action verbs, Star methodology).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleTranslateCV('en')}
                disabled={isTranslating}
                className="bg-[#5F7A48] hover:bg-[#4E653A] text-white font-bold px-3 py-1.5 text-xs flex items-center gap-1 border border-[#5F7A48] transition-all"
              >
                <RefreshCw className={`h-3 w-3 ${isTranslating ? 'animate-spin' : ''}`} />
                <span>{isTranslating ? t.translating : t.translate_to_en}</span>
              </button>

              <button
                onClick={() => handleTranslateCV('fr')}
                disabled={isTranslating}
                className="bg-[#FAF9F6] hover:bg-[#F2F2EC] text-[#18181B] font-bold px-3 py-1.5 text-xs flex items-center gap-1 border border-[#D4D4D8] transition-all"
              >
                <span>{t.translate_to_fr}</span>
              </button>
            </div>
          </div>

          {translatedCv ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              
              {/* Summary / Data Translated */}
              <div className="lg:col-span-5 bg-[#FAF9F6] border border-[#E2E2DC] p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-[#E2E2DC] pb-2">
                  <span className="text-xs font-bold text-[#5F7A48] uppercase">
                    Version {translatedCv.target_language.toUpperCase()} Traduite
                  </span>
                  <a
                    href={translatedCv.pdf_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[#18181B] font-bold hover:underline flex items-center gap-1"
                  >
                    <Download className="h-3 w-3" />
                    <span>Télécharger PDF</span>
                  </a>
                </div>

                <div>
                  <span className="text-[11px] text-[#71717A] block mb-0.5 font-bold">Headline / Professional Title :</span>
                  <p className="text-xs font-bold text-[#18181B] bg-white p-2 border border-[#E2E2DC]">
                    {translatedCv.translated_data.headline}
                  </p>
                </div>

                <div>
                  <span className="text-[11px] text-[#71717A] block mb-0.5 font-bold">Profile Summary :</span>
                  <p className="text-xs text-[#27272A] bg-white p-2.5 border border-[#E2E2DC] leading-relaxed">
                    {translatedCv.translated_data.summary}
                  </p>
                </div>

                <div>
                  <span className="text-[11px] text-[#71717A] block mb-1 font-bold">Adapted Skills / Keywords :</span>
                  <div className="flex flex-wrap gap-1">
                    {translatedCv.translated_data.skills.map((s, i) => (
                      <span key={i} className="bg-white text-[#18181B] border border-[#D4D4D8] px-2 py-0.5 text-[10.5px]">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Visual PDF Preview of Translated Resume */}
              <div className="lg:col-span-7 bg-white border border-[#D4D4D8] p-3 space-y-2">
                <div className="flex items-center justify-between text-xs text-[#71717A] pb-1 border-b border-[#E4E4E7]">
                  <span>Aperçu PDF Direct ({translatedCv.filename}) :</span>
                  <a
                    href={translatedCv.pdf_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#5F7A48] hover:underline font-bold"
                  >
                    Ouvrir plein écran ➔
                  </a>
                </div>
                <iframe
                  src={`${translatedCv.pdf_url}#toolbar=0`}
                  className="w-full h-[650px] border border-[#E2E2DC]"
                  title="Aperçu CV Traduit"
                />
              </div>

            </div>
          ) : (
            <div className="py-12 text-center text-[#71717A] border border-dashed border-[#D4D4D8] p-6">
              <Languages className="h-8 w-8 text-[#A1A1AA] mx-auto mb-2" />
              <p className="text-xs font-bold text-[#18181B]">
                Cliquez sur "Traduire en Anglais (English ATS)" pour générer automatiquement un CV visuel en anglais.
              </p>
              <p className="text-[11px] text-[#71717A] mt-1">
                L'IA adapte la terminologie pour les filtres ATS internationaux.
              </p>
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: RAW CANDIDATE METADATA */}
      {activeView === 'text_data' && (
        <div className="bg-[#FFFFFF] border border-[#D4D4D8] p-5 space-y-5 shadow-xs font-mono">
          <div className="border-b border-[#E4E4E7] pb-2.5">
            <h3 className="text-xs font-bold uppercase text-[#18181B] tracking-wider">
              Métadonnées Candidate & Profil Structuré
            </h3>
            <p className="text-[11px] text-[#71717A] mt-0.5">
              Ces informations alimentent le remplissage automatique des formulaires Playwright et les e-mails directs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[#71717A] mb-1 font-bold">Nom complet</label>
              <input
                type="text"
                value={profile?.full_name || ''}
                disabled
                className="w-full bg-[#FAF9F6] border border-[#D4D4D8] p-1.5 text-[#18181B]"
              />
            </div>
            <div>
              <label className="block text-[#71717A] mb-1 font-bold">E-mail de contact</label>
              <input
                type="email"
                value={profile?.email || ''}
                disabled
                className="w-full bg-[#FAF9F6] border border-[#D4D4D8] p-1.5 text-[#18181B]"
              />
            </div>
            <div>
              <label className="block text-[#71717A] mb-1 font-bold">Téléphone</label>
              <input
                type="text"
                value={profile?.phone || ''}
                disabled
                className="w-full bg-[#FAF9F6] border border-[#D4D4D8] p-1.5 text-[#18181B]"
              />
            </div>
            <div>
              <label className="block text-[#71717A] mb-1 font-bold">Localisation Cible</label>
              <input
                type="text"
                value={profile?.city || ''}
                disabled
                className="w-full bg-[#FAF9F6] border border-[#D4D4D8] p-1.5 text-[#18181B]"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[#71717A] mb-1 font-bold">Titre Professionnel</label>
              <input
                type="text"
                value={profile?.headline || ''}
                disabled
                className="w-full bg-[#FAF9F6] border border-[#D4D4D8] p-1.5 text-[#18181B]"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[#71717A] mb-1 font-bold">Résumé & Objectifs</label>
              <textarea
                value={profile?.summary || ''}
                rows={3}
                disabled
                className="w-full bg-[#FAF9F6] border border-[#D4D4D8] p-1.5 text-[#18181B]"
              />
            </div>
          </div>
        </div>
      )}

      {/* MODAL: 3 AI VISUAL PDF VARIANTS FOR METRIC < 80% */}
      {(variantsModalData || isGeneratingVariants) && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-5 backdrop-blur-xs font-mono">
          <div className="bg-[#FFFFFF] border-2 border-[#18181B] max-w-4xl w-full p-5 space-y-4 shadow-2xl relative max-h-[92vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#E4E4E7] pb-2.5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#5F7A48]" />
                <h3 className="text-xs font-black uppercase text-[#18181B] tracking-wider">
                  Propositions Visuelles IA : <span className="text-[#5F7A48]">{activeVariantMetric}</span>
                </h3>
              </div>
              <button
                onClick={() => setVariantsModalData(null)}
                className="text-[#71717A] hover:text-[#18181B] p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isGeneratingVariants ? (
              <div className="py-12 text-center space-y-2 font-mono">
                <RefreshCw className="h-7 w-7 text-[#5F7A48] animate-spin mx-auto" />
                <p className="text-xs text-[#18181B] font-bold">Génération des variantes et compilation des PDF visuels...</p>
                <p className="text-[11px] text-[#71717A]">Modélisation STAR, impact chiffré et injection de mots-clés ATS.</p>
              </div>
            ) : variantsModalData ? (
              <div className="space-y-4">
                
                {/* Score Projection Banner */}
                <div className="bg-[#EEF3E9] border border-[#C8DAC0] p-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <Target className="h-4 w-4 text-[#5F7A48]" />
                    <span className="text-[#18181B] font-bold">Score projeté après intégration :</span>
                  </div>
                  <span className="bg-[#5F7A48] text-white font-black px-2 py-0.2 text-xs">
                    {variantsModalData.projected_score}% (MAX)
                  </span>
                </div>

                <p className="text-[11px] text-[#52525B] leading-relaxed">
                  {variantsModalData.explanation}
                </p>

                {/* Direct Visual PDF Preview if selected */}
                {previewVariantPdf && (
                  <div className="border border-[#D4D4D8] p-2 bg-[#FAF9F6] space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-[#18181B] flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5 text-[#5F7A48]" />
                        Rendu Visuel PDF du Document Proposé :
                      </span>
                      <a
                        href={previewVariantPdf}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#5F7A48] font-bold hover:underline flex items-center gap-0.5"
                      >
                        <span>Ouvrir PDF</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <iframe
                      src={`${previewVariantPdf}#toolbar=0`}
                      className="w-full h-[400px] border border-[#E2E2DC] bg-white"
                      title="Visual PDF Variant Proposal"
                    />
                  </div>
                )}

                {/* 3 Variants Cards */}
                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {variantsModalData.variants.map((variant, index) => (
                    <div 
                      key={index}
                      className="bg-[#FAF9F6] border border-[#D4D4D8] p-3 space-y-1.5 hover:border-[#18181B] transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#18181B]">
                          [{index + 1}] {variant.title}
                        </span>
                        
                        <div className="flex items-center gap-2">
                          {variant.pdf_url && (
                            <button
                              onClick={() => setPreviewVariantPdf(variant.pdf_url!)}
                              className="text-[10px] font-bold text-[#5F7A48] hover:underline flex items-center gap-0.5"
                            >
                              <Eye className="h-3 w-3" />
                              <span>Voir le PDF visuel</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleCopyVariant(variant.content, index)}
                            className="bg-white hover:bg-[#F2F2EC] text-[#18181B] border border-[#D4D4D8] px-2 py-0.5 text-[10px] font-bold flex items-center gap-1 transition-all"
                          >
                            {copiedIndex === index ? (
                              <>
                                <Check className="h-3 w-3 text-[#5F7A48]" />
                                <span className="text-[#5F7A48]">{t.copied}</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                <span>{t.copy}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      <p className="text-[11px] text-[#27272A] leading-relaxed bg-white p-2 border border-[#E2E2DC] whitespace-pre-line">
                        {variant.content}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setVariantsModalData(null)}
                    className="bg-[#18181B] hover:bg-[#27272A] text-white font-mono font-black text-xs px-4 py-1.5 border border-[#18181B] transition-all"
                  >
                    {t.close}
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
