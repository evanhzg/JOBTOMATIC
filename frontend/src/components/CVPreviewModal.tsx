import React, { useState } from 'react';
import { 
  X, 
  Download, 
  Sparkles, 
  CheckCircle2, 
  TrendingUp, 
  AlertCircle, 
  FileText,
  RefreshCw
} from 'lucide-react';
import { Job, CandidateProfile, CVImprovementSuggestions } from '../types';

interface CVPreviewModalProps {
  job?: Job | null;
  baseProfile?: CandidateProfile | null;
  onClose: () => void;
  onImproveCV?: (jobId: number) => Promise<CVImprovementSuggestions>;
  onApplyImprovements?: (jobId: number) => Promise<void>;
  onEditBaseProfile?: () => void;
}

export const CVPreviewModal: React.FC<CVPreviewModalProps> = ({
  job,
  baseProfile,
  onClose,
  onImproveCV,
  onApplyImprovements,
  onEditBaseProfile
}) => {
  const [isImproving, setIsImproving] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [suggestions, setSuggestions] = useState<CVImprovementSuggestions | null>(
    job?.cv_improvement_suggestions || null
  );

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="bg-[#141414] border-2 border-[#242424] w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-mono">
        
        {/* Top Header Bar (Sharp Boxy Brutalist) */}
        <div className="p-4 border-b border-[#242424] flex items-center justify-between gap-4 bg-[#0C0C0C]">
          <div className="flex items-center gap-3">
            <div className="border border-[#333333] bg-[#181818] p-2 text-[#C5EA4B]">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-white uppercase tracking-wider">
                  {isJobCV ? `[CV CANDIDATURE] : ${job.company}` : "[CV MAÎTRE DE RÉFÉRENCE]"}
                </h2>
                {isJobCV && (
                  <span className={`text-[10px] font-bold px-2 py-0.2 border ${
                    job.match_score >= 80 
                      ? 'bg-[#182610] text-[#C5EA4B] border-[#C5EA4B]'
                      : 'bg-[#2A1810] text-[#FA5F11] border-[#FA5F11]'
                  }`}>
                    SCORE : {job.match_score}%
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#8E8E8E] mt-0.5">
                {isJobCV 
                  ? `Adapté par l'IA pour l'offre : ${job.title}`
                  : "Le socle de référence original utilisé pour générer chaque candidature"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Download PDF button */}
            {isJobCV && job.tailored_cv_path ? (
              <a
                href={`/api/cv-preview/${job.id}`}
                target="_blank"
                rel="noreferrer"
                className="bg-[#C5EA4B] hover:bg-[#d6f859] text-black font-black px-3.5 py-1.5 text-xs flex items-center gap-1.5 border border-[#C5EA4B] transition-all"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">TÉLÉCHARGER PDF</span>
              </a>
            ) : !isJobCV ? (
              <a
                href={baseProfile?.original_cv_path ? "/api/profile/original-cv" : "/api/profile/preview-pdf"}
                target="_blank"
                rel="noreferrer"
                className="bg-[#C5EA4B] hover:bg-[#d6f859] text-black font-black px-3.5 py-1.5 text-xs flex items-center gap-1.5 border border-[#C5EA4B] transition-all"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">TÉLÉCHARGER PDF ORIGINAL</span>
              </a>
            ) : null}

            {/* Quick Edit Base Profile */}
            {!isJobCV && onEditBaseProfile && (
              <button
                onClick={() => {
                  onClose();
                  onEditBaseProfile();
                }}
                className="bg-[#1C1C1C] hover:bg-[#282828] text-white border border-[#333333] px-3 py-1.5 text-xs font-bold transition-all"
              >
                MODIFIER LE CV
              </button>
            )}

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 text-[#8E8E8E] hover:text-white border border-transparent hover:border-[#333333] hover:bg-[#202020] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          
          {/* AI IMPROVE CV PROMPT BANNER (if job fit is low or requested) */}
          {isJobCV && (
            <div className="bg-[#101010] border border-[#C5EA4B] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#C5EA4B]" />
                  <span className="text-xs font-black uppercase tracking-wider text-[#C5EA4B]">
                    AUDIT & AMÉLIORATION PAR L'IA
                  </span>
                  {job.match_score < 75 && (
                    <span className="bg-[#FA5F11] text-black text-[9px] font-black px-1.5 py-0.2">
                      OPTIMISATION SUGGÉRÉE
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#CCCCCC]">
                  L'IA inspecte les écarts avec <strong>{job.company}</strong>, injecte les mots-clés ATS manquants et renforce l'impact STAR.
                </p>
              </div>

              <button
                onClick={handleRunImprovement}
                disabled={isImproving}
                className="bg-[#C5EA4B] hover:bg-[#d6f859] text-black font-black px-4 py-2 text-xs flex items-center justify-center gap-1.5 border border-[#C5EA4B] transition-all shrink-0"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isImproving ? 'animate-spin' : ''}`} />
                <span>{isImproving ? 'AUDIT EN COURS...' : '🚀 AMÉLIORER CE CV (IA)'}</span>
              </button>
            </div>
          )}

          {/* AI SUGGESTIONS DRAWER (if generated) */}
          {suggestions && (
            <div className="bg-[#0C0C0C] border-2 border-[#C5EA4B] p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-[#242424] pb-2.5">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[#C5EA4B]" />
                  <h4 className="font-black text-xs text-white uppercase">
                    Audit IA : Boost de Score {suggestions.current_score}% ➔ <span className="text-[#C5EA4B] text-sm">{suggestions.projected_score}%</span>
                  </h4>
                </div>
                <button
                  onClick={handleApplyBoost}
                  disabled={isApplying}
                  className="bg-[#C5EA4B] hover:bg-[#d6f859] text-black font-black px-3.5 py-1.5 text-xs flex items-center gap-1.5 border border-[#C5EA4B] transition-all"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{isApplying ? 'APPLICATION...' : 'APPLIQUER LES AMÉLIORATIONS'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1 bg-[#141414] p-3 border border-[#242424]">
                  <span className="font-bold text-[#FA5F11] flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" /> DIAGNOSTIC :
                  </span>
                  <p className="text-[#CCCCCC] leading-relaxed text-[11px]">{suggestions.critique}</p>
                </div>

                <div className="space-y-1 bg-[#141414] p-3 border border-[#242424]">
                  <span className="font-bold text-[#C5EA4B] flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5" /> MOTS-CLÉS ATS À INJECTER :
                  </span>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {suggestions.missing_keywords.map((kw, i) => (
                      <span key={i} className="bg-[#182610] text-[#C5EA4B] border border-[#C5EA4B]/40 px-2 py-0.5 text-[10px] font-bold">
                        + {kw}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 bg-[#141414] p-3 border border-[#242424] text-xs">
                <span className="font-bold text-white">RÉALISATIONS REFORMULÉES À FORT IMPACT (STAR) :</span>
                <ul className="list-disc list-inside space-y-1 text-[#CCCCCC] pl-1 text-[11px]">
                  {suggestions.boosted_bullet_points.map((pt, i) => (
                    <li key={i}>{pt}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* VISUAL DOCUMENT RESUME CANVAS (Sharp rectangular paper sheet) */}
          <div className="bg-white text-slate-900 p-8 sm:p-10 shadow-2xl max-w-3xl mx-auto border-2 border-neutral-300 font-sans leading-relaxed">
            
            {/* Resume Header */}
            <div className="border-b-2 border-slate-950 pb-4 mb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
                  {candidateName}
                </h1>
                <p className="text-sm font-bold text-blue-700 mt-1">
                  {headline}
                </p>
              </div>

              <div className="text-xs text-slate-600 sm:text-right space-y-0.5 shrink-0 font-mono">
                <div>📍 {candidateCity}</div>
                <div>✉️ {candidateEmail}</div>
                <div>📞 {candidatePhone}</div>
              </div>
            </div>

            {/* Profile Summary */}
            <div className="mb-5">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-2">
                Profil & Objectifs
              </h3>
              <p className="text-xs text-slate-700 leading-relaxed text-justify">
                {summary || "Professionnel rigoureux et polyvalent, immédiatement disponible pour s'investir dans les missions de l'entreprise."}
              </p>
            </div>

            {/* Skills Badges (Sharp) */}
            <div className="mb-5">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-2">
                Compétences Clés
              </h3>
              <div className="flex flex-wrap gap-1">
                {skills.map((skill, i) => (
                  <span key={i} className="bg-slate-100 text-slate-900 border border-slate-300 px-2 py-0.5 text-[11px] font-semibold">
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {/* Experiences */}
            <div className="mb-5">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-2">
                Expériences Professionnelles
              </h3>
              <div className="space-y-3">
                {experiences.map((exp, i) => (
                  <div key={i} className="text-xs">
                    <div className="flex justify-between font-bold text-slate-950">
                      <span>{exp.role}</span>
                      <span className="text-slate-500 font-normal font-mono">{exp.period}</span>
                    </div>
                    <div className="text-blue-700 font-medium text-[11px] mb-1">
                      {exp.company} — {exp.location || candidateCity}
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-700 text-[11px]">
                      {exp.details.map((d, di) => (
                        <li key={di}>{d}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* Education */}
            {baseProfile?.education && baseProfile.education.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-2">
                  Formations & Diplômes
                </h3>
                <div className="space-y-2">
                  {baseProfile.education.map((edu, i) => (
                    <div key={i} className="text-xs flex justify-between">
                      <div>
                        <div className="font-bold text-slate-950">{edu.degree}</div>
                        <div className="text-slate-600 text-[11px]">{edu.school}</div>
                      </div>
                      <span className="text-slate-500 text-[11px] font-mono">{edu.year}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer watermark */}
            <div className="mt-8 pt-3 border-t border-dashed border-slate-200 text-center text-[10px] text-slate-400 font-mono">
              JOBTOMATIC — Candidature automatisée & CV adapté
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
