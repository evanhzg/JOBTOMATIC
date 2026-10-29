import React, { useState } from 'react';
import { 
  X, 
  Download, 
  Sparkles, 
  CheckCircle2, 
  TrendingUp, 
  AlertCircle, 
  Wrench, 
  ArrowRight, 
  FileText,
  Mail,
  RefreshCw,
  Building2,
  MapPin
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
      <div className="bg-pickle-card border border-pickle-border rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Top Header Bar */}
        <div className="p-4 sm:p-5 border-b border-pickle-border flex items-center justify-between gap-4 bg-pickle-dark/80">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-pickle-lime/10 border border-pickle-lime/30 flex items-center justify-center text-pickle-lime">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-white">
                  {isJobCV ? `Aperçu CV Candidature : ${job.company}` : "Aperçu de votre CV d'Origine (Maître)"}
                </h2>
                {isJobCV && (
                  <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border ${
                    job.match_score >= 80 
                      ? 'bg-pickle-lime/10 text-pickle-lime border-pickle-lime/30'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}>
                    Score : {job.match_score}%
                  </span>
                )}
              </div>
              <p className="text-xs text-pickle-subtle">
                {isJobCV 
                  ? `Adapté par IA pour le poste de ${job.title}`
                  : "Le socle de référence utilisé par l'IA pour personnaliser vos candidatures"}
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
                className="bg-pickle-lime hover:bg-pickle-limeHover text-pickle-dark font-black px-3.5 py-2 rounded-full text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Télécharger PDF</span>
              </a>
            ) : !isJobCV ? (
              <a
                href="/api/profile/preview-pdf"
                target="_blank"
                rel="noreferrer"
                className="bg-pickle-lime hover:bg-pickle-limeHover text-pickle-dark font-black px-3.5 py-2 rounded-full text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Télécharger PDF Maître</span>
              </a>
            ) : null}

            {/* Quick Edit Base Profile */}
            {!isJobCV && onEditBaseProfile && (
              <button
                onClick={() => {
                  onClose();
                  onEditBaseProfile();
                }}
                className="bg-pickle-card hover:bg-neutral-800 text-white border border-pickle-border px-3.5 py-2 rounded-full text-xs font-bold transition-all"
              >
                Modifier le CV
              </button>
            )}

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 text-pickle-subtle hover:text-white rounded-full hover:bg-neutral-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Split view or Document Canvas */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* AI IMPROVE CV PROMPT BANNER (if job fit is low or requested) */}
          {isJobCV && (
            <div className="bg-gradient-to-r from-pickle-dark via-pickle-card to-pickle-dark border border-pickle-lime/40 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-pickle-lime" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-pickle-lime">
                    Outil d'Amélioration & Audit de CV par IA
                  </span>
                  {job.match_score < 75 && (
                    <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                      Score à optimiser
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-300">
                  L'IA analyse les lacunes face aux exigences de <strong>{job.company}</strong>, injecte les mots-clés ATS manquants et renforce l'impact de vos expériences.
                </p>
              </div>

              <button
                onClick={handleRunImprovement}
                disabled={isImproving}
                className="bg-pickle-lime hover:bg-pickle-limeHover text-pickle-dark font-black px-4 py-2.5 rounded-full text-xs flex items-center justify-center gap-2 shadow-lg shadow-pickle-lime/20 active:scale-95 transition-all shrink-0"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isImproving ? 'animate-spin' : ''}`} />
                <span>{isImproving ? 'Audit IA en cours...' : '🚀 Améliorer ce CV avec l\'IA'}</span>
              </button>
            </div>
          )}

          {/* AI SUGGESTIONS DRAWER (if generated) */}
          {suggestions && (
            <div className="bg-pickle-dark border-2 border-pickle-lime rounded-2xl p-5 space-y-4 shadow-2xl animate-in slide-in-from-top-4 duration-200">
              <div className="flex items-center justify-between border-b border-pickle-border pb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-pickle-lime" />
                  <h4 className="font-extrabold text-sm text-white">
                    Audit IA Réalisé : Boost de Score de {suggestions.current_score}% ➔ <span className="text-pickle-lime font-black text-base">{suggestions.projected_score}%</span>
                  </h4>
                </div>
                <button
                  onClick={handleApplyBoost}
                  disabled={isApplying}
                  className="bg-pickle-lime hover:bg-pickle-limeHover text-pickle-dark font-black px-4 py-2 rounded-full text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{isApplying ? 'Application...' : 'Appliquer ces améliorations au CV'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Diagnostic critique */}
                <div className="space-y-1.5 bg-neutral-900/80 p-3 rounded-xl border border-neutral-800">
                  <span className="font-bold text-amber-400 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" /> Diagnostic & Points Faibles Détectés :
                  </span>
                  <p className="text-neutral-300 leading-relaxed">{suggestions.critique}</p>
                </div>

                {/* Missing Keywords */}
                <div className="space-y-1.5 bg-neutral-900/80 p-3 rounded-xl border border-neutral-800">
                  <span className="font-bold text-pickle-lime flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5" /> Mots-clés ATS à intégrer absolument :
                  </span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {suggestions.missing_keywords.map((kw, i) => (
                      <span key={i} className="bg-pickle-lime/10 text-pickle-lime border border-pickle-lime/30 px-2.5 py-0.5 rounded-full font-semibold text-[11px]">
                        + {kw}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Boosted Headline & Bullet Points */}
              <div className="space-y-2 bg-neutral-900/80 p-3 rounded-xl border border-neutral-800 text-xs">
                <span className="font-bold text-white">Puces d'expérience reformulées à fort impact (Méthode STAR) :</span>
                <ul className="list-disc list-inside space-y-1 text-neutral-300 pl-1">
                  {suggestions.boosted_bullet_points.map((pt, i) => (
                    <li key={i}>{pt}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* VISUAL DOCUMENT RESUME CANVAS (Pixel-accurate styled presentation) */}
          <div className="bg-white text-slate-900 rounded-2xl p-8 sm:p-10 shadow-2xl max-w-3xl mx-auto border border-neutral-300 font-sans leading-relaxed">
            
            {/* Resume Header */}
            <div className="border-b-2 border-slate-900 pb-4 mb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
                  {candidateName}
                </h1>
                <p className="text-sm font-bold text-blue-700 mt-1">
                  {headline}
                </p>
              </div>

              <div className="text-xs text-slate-600 sm:text-right space-y-0.5 shrink-0">
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

            {/* Skills Badges */}
            <div className="mb-5">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-2">
                Compétences Clés
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {skills.map((skill, i) => (
                  <span key={i} className="bg-slate-100 text-slate-900 border border-slate-200 px-2.5 py-0.5 rounded-md text-[11px] font-semibold">
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
                      <span className="text-slate-500 font-normal">{exp.period}</span>
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
                      <span className="text-slate-500 text-[11px]">{edu.year}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer watermark */}
            <div className="mt-8 pt-3 border-t border-dashed border-slate-200 text-center text-[10px] text-slate-400">
              {isJobCV 
                ? `Candidature optimisée pour ${job.company} — Posté via JobHunter AGY`
                : "CV Maître de Référence — JobHunter AGY"}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
