import React, { useState } from 'react';
import { 
  X, 
  Download, 
  Sparkles, 
  CheckCircle2, 
  TrendingUp, 
  AlertCircle, 
  FileText,
  RefreshCw,
  Eye,
  ExternalLink
} from 'lucide-react';
import { Job, CandidateProfile, CVImprovementSuggestions } from '../types';
import { Language, translations } from '../i18n';

interface CVPreviewModalProps {
  job?: Job | null;
  baseProfile?: CandidateProfile | null;
  onClose: () => void;
  onImproveCV?: (jobId: number) => Promise<CVImprovementSuggestions>;
  onApplyImprovements?: (jobId: number) => Promise<void>;
  onEditBaseProfile?: () => void;
  currentLang?: Language;
}

export const CVPreviewModal: React.FC<CVPreviewModalProps> = ({
  job,
  baseProfile,
  onClose,
  onImproveCV,
  onApplyImprovements,
  onEditBaseProfile,
  currentLang = 'fr'
}) => {
  const [isImproving, setIsImproving] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [viewMode, setViewMode] = useState<'visual_pdf' | 'html_canvas'>('visual_pdf');
  const [suggestions, setSuggestions] = useState<CVImprovementSuggestions | null>(
    job?.cv_improvement_suggestions || null
  );

  const t = translations[currentLang];
  const isJobCV = !!job;
  const candidateName = baseProfile?.full_name || 'Evan Candidate';
  const candidateCity = job?.location || baseProfile?.city || 'Rouen (76000)';
  const candidateEmail = baseProfile?.email || 'evan@example.com';
  const candidatePhone = baseProfile?.phone || '06 12 34 56 78';

  const headline = isJobCV ? (job.tailored_title || job.title) : (baseProfile?.headline || 'Profil Candidat');
  const summary = isJobCV ? (job.tailored_summary || baseProfile?.summary || '') : (baseProfile?.summary || '');
  const skills = isJobCV ? (job.tailored_skills || baseProfile?.skills || []) : (baseProfile?.skills || []);
  const experiences = baseProfile?.experiences || [];

  const handleRunImprovement = async () => {
    if (!job || !onImproveCV) return;
    setIsImproving(true);
    try {
      const res = await onImproveCV(job.id);
      setSuggestions(res);
    } finally {
      setIsImproving(false);
    }
  };

  const handleApplyBoost = async () => {
    if (!job || !onApplyImprovements) return;
    setIsApplying(true);
    try {
      await onApplyImprovements(job.id);
      setSuggestions(null);
    } finally {
      setIsApplying(false);
    }
  };

  const pdfUrl = isJobCV && job.tailored_cv_path 
    ? `/api/cv-preview/${job.id}`
    : baseProfile?.original_cv_path 
      ? `/api/profile/original-cv`
      : `/api/profile/preview-pdf`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs overflow-y-auto font-mono">
      <div className="bg-[#FFFFFF] border-2 border-[#18181B] w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Top Header Bar (Pickles.app clean style) */}
        <div className="p-3.5 border-b border-[#D4D4D8] flex items-center justify-between gap-3 bg-[#FAF9F6]">
          <div className="flex items-center gap-2.5">
            <div className="border border-[#D4D4D8] bg-white p-1.5 text-[#5F7A48]">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-black text-[#18181B] uppercase tracking-wider">
                  {isJobCV ? `[CV CANDIDATURE] : ${job.company}` : "[CV MAÎTRE DE RÉFÉRENCE]"}
                </h2>
                {isJobCV && (
                  <span className={`text-[9.5px] font-bold px-1.5 py-0.1 border ${
                    job.match_score >= 80 
                      ? 'bg-[#EEF3E9] text-[#5F7A48] border-[#C8DAC0]'
                      : 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]'
                  }`}>
                    SCORE : {job.match_score}%
                  </span>
                )}
              </div>
              <p className="text-[10.5px] text-[#71717A] mt-0.5">
                {isJobCV 
                  ? `Adapté par l'IA pour : ${job.title}`
                  : "Le socle de référence original utilisé pour générer chaque candidature"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle: Direct Visual PDF vs Styled Canvas */}
            <div className="flex items-center bg-white border border-[#D4D4D8] p-0.5 text-[10.5px]">
              <button
                onClick={() => setViewMode('visual_pdf')}
                className={`px-2 py-0.5 font-bold transition-all ${
                  viewMode === 'visual_pdf'
                    ? 'bg-[#18181B] text-white'
                    : 'text-[#71717A] hover:text-[#18181B]'
                }`}
              >
                PDF Visuel Direct
              </button>
              <button
                onClick={() => setViewMode('html_canvas')}
                className={`px-2 py-0.5 font-bold transition-all ${
                  viewMode === 'html_canvas'
                    ? 'bg-[#18181B] text-white'
                    : 'text-[#71717A] hover:text-[#18181B]'
                }`}
              >
                Structure Données
              </button>
            </div>

            {/* Download button */}
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="bg-[#5F7A48] hover:bg-[#4E653A] text-white font-black px-3 py-1 text-[11px] flex items-center gap-1 border border-[#5F7A48] transition-all"
            >
              <Download className="h-3 w-3" />
              <span className="hidden sm:inline">TÉLÉCHARGER PDF</span>
            </a>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1 text-[#71717A] hover:text-[#18181B] border border-transparent hover:border-[#D4D4D8] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          
          {/* AI IMPROVE CV PROMPT BANNER (if job fit is low or requested) */}
          {isJobCV && (
            <div className="bg-[#FAF9F6] border border-[#5F7A48] p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-[#5F7A48]" />
                  <span className="text-xs font-black uppercase tracking-wider text-[#18181B]">
                    AUDIT & AMÉLIORATION PAR L'IA (PDF VISUELS)
                  </span>
                  {job.match_score < 75 && (
                    <span className="bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A] text-[9px] font-black px-1.5 py-0.1">
                      OPTIMISATION SUGGÉRÉE
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#52525B]">
                  L'IA inspecte les écarts avec <strong>{job.company}</strong>, injecte les mots-clés ATS manquants et génère des versions visuelles optimisées.
                </p>
              </div>

              <button
                onClick={handleRunImprovement}
                disabled={isImproving}
                className="bg-[#18181B] hover:bg-[#27272A] text-white font-black px-3.5 py-1.5 text-xs flex items-center justify-center gap-1.5 border border-[#18181B] transition-all shrink-0"
              >
                <RefreshCw className={`h-3 w-3 ${isImproving ? 'animate-spin text-[#EEF3E9]' : ''}`} />
                <span>{isImproving ? 'AUDIT EN COURS...' : '🚀 AMÉLIORER CE CV (IA)'}</span>
              </button>
            </div>
          )}

          {/* AI SUGGESTIONS DRAWER (if generated) */}
          {suggestions && (
            <div className="bg-[#FAF9F6] border-2 border-[#5F7A48] p-3.5 space-y-3">
              <div className="flex items-center justify-between border-b border-[#E4E4E7] pb-2">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-[#5F7A48]" />
                  <h4 className="font-black text-xs text-[#18181B] uppercase">
                    Audit IA : Boost de Score {suggestions.current_score}% ➔ <span className="text-[#5F7A48] text-sm">{suggestions.projected_score}%</span>
                  </h4>
                </div>
                <button
                  onClick={handleApplyBoost}
                  disabled={isApplying}
                  className="bg-[#5F7A48] hover:bg-[#4E653A] text-white font-black px-3 py-1 text-xs flex items-center gap-1 border border-[#5F7A48] transition-all"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  <span>{isApplying ? 'APPLICATION...' : 'APPLIQUER LES AMÉLIORATIONS'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                <div className="space-y-1 bg-white p-2.5 border border-[#E2E2DC]">
                  <span className="font-bold text-[#B45309] flex items-center gap-1 text-[11px]">
                    <AlertCircle className="h-3.5 w-3.5" /> DIAGNOSTIC :
                  </span>
                  <p className="text-[#52525B] leading-relaxed text-[10.5px]">{suggestions.critique}</p>
                </div>

                <div className="space-y-1 bg-white p-2.5 border border-[#E2E2DC]">
                  <span className="font-bold text-[#5F7A48] flex items-center gap-1 text-[11px]">
                    <Sparkles className="h-3.5 w-3.5" /> MOTS-CLÉS ATS À INJECTER :
                  </span>
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {suggestions.missing_keywords.map((kw, i) => (
                      <span key={i} className="bg-[#EEF3E9] text-[#5F7A48] border border-[#C8DAC0] px-1.5 py-0.2 text-[10px] font-bold">
                        + {kw}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-1 bg-white p-2.5 border border-[#E2E2DC] text-xs">
                <span className="font-bold text-[#18181B] text-[11px]">RÉALISATIONS REFORMULÉES À FORT IMPACT (STAR) :</span>
                <ul className="list-disc list-inside space-y-0.5 text-[#52525B] pl-1 text-[10.5px]">
                  {suggestions.boosted_bullet_points.map((pt, i) => (
                    <li key={i}>{pt}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* VISUAL PREVIEW: DIRECT VISUAL PDF EMBED */}
          {viewMode === 'visual_pdf' ? (
            <div className="w-full bg-[#FAF9F6] border border-[#D4D4D8] min-h-[650px]">
              <iframe
                src={`${pdfUrl}#toolbar=0`}
                className="w-full h-[680px] border-none"
                title="Aperçu Visuel PDF"
              />
            </div>
          ) : (
            /* HTML CANVAS PREVIEW */
            <div className="bg-white text-[#18181B] p-8 sm:p-10 shadow-lg max-w-3xl mx-auto border border-[#D4D4D8] font-sans leading-relaxed">
              <div className="border-b-2 border-[#18181B] pb-3 mb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-black text-[#18181B] tracking-tight">{candidateName}</h1>
                  <p className="text-xs font-bold text-[#5F7A48] mt-0.5">{headline}</p>
                </div>
                <div className="text-[10.5px] text-[#71717A] sm:text-right font-mono space-y-0.5">
                  <div>📍 {candidateCity}</div>
                  <div>✉️ {candidateEmail}</div>
                  <div>📞 {candidatePhone}</div>
                </div>
              </div>

              <div className="mb-4">
                <h3 className="text-xs font-black uppercase text-[#18181B] border-b border-[#E4E4E7] pb-1 mb-1.5">
                  Profil & Objectifs
                </h3>
                <p className="text-xs text-[#52525B] leading-relaxed text-justify">{summary}</p>
              </div>

              <div className="mb-4">
                <h3 className="text-xs font-black uppercase text-[#18181B] border-b border-[#E4E4E7] pb-1 mb-1.5">
                  Compétences Clés
                </h3>
                <div className="flex flex-wrap gap-1">
                  {skills.map((skill, i) => (
                    <span key={i} className="bg-[#FAF9F6] text-[#18181B] border border-[#D4D4D8] px-2 py-0.5 text-[10.5px] font-semibold">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <h3 className="text-xs font-black uppercase text-[#18181B] border-b border-[#E4E4E7] pb-1 mb-1.5">
                  Expériences Professionnelles
                </h3>
                <div className="space-y-2.5">
                  {experiences.map((exp, i) => (
                    <div key={i} className="text-xs">
                      <div className="flex justify-between font-bold text-[#18181B]">
                        <span>{exp.role}</span>
                        <span className="text-[#71717A] font-normal font-mono">{exp.period}</span>
                      </div>
                      <div className="text-[#5F7A48] font-medium text-[10.5px] mb-0.5">
                        {exp.company} — {exp.location || candidateCity}
                      </div>
                      <ul className="list-disc list-inside space-y-0.5 text-[#52525B] text-[10.5px]">
                        {exp.details.map((d, di) => (
                          <li key={di}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
