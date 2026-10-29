import React from 'react';
import { 
  X, 
  Building2, 
  MapPin, 
  Calendar, 
  ExternalLink, 
  Download, 
  Sparkles, 
  CheckCircle2, 
  Mail, 
  Send, 
  MessageSquareReply, 
  FileCheck
} from 'lucide-react';
import { Job } from '../types';

interface JobDetailModalProps {
  job: Job | null;
  onClose: () => void;
  onApply: (jobId: number) => void;
  onTailor: (jobId: number) => void;
}

export const JobDetailModal: React.FC<JobDetailModalProps> = ({
  job,
  onClose,
  onApply,
  onTailor
}) => {
  if (!job) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-start justify-between gap-4 bg-slate-900/60">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                {job.contract_type}
              </span>
              <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
                {job.source}
              </span>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/30 flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Score {job.match_score}%
              </span>
            </div>
            <h2 className="text-xl font-bold text-white">{job.title}</h2>
            <div className="flex items-center gap-4 text-xs text-slate-400 mt-2">
              <span className="flex items-center gap-1 text-slate-300 font-medium">
                <Building2 className="h-4 w-4 text-slate-500" /> {job.company}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4 text-slate-500" /> {job.location}
              </span>
              {job.salary && (
                <span className="text-emerald-400 font-medium">💰 {job.salary}</span>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-300">
          
          {/* Recruiter Answer Notice (if answer occurred) */}
          {job.status === 'answer_received' && job.answer_snippet && (
            <div className="bg-emerald-950/60 border border-emerald-500/50 rounded-xl p-4 shadow-lg shadow-emerald-500/10">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 font-bold text-emerald-300 text-sm">
                  <MessageSquareReply className="h-4 w-4" /> Réponse Reçue du Recruteur
                  {job.answer_classification && (
                    <span className="bg-emerald-500 text-slate-950 text-xs px-2 py-0.5 rounded font-extrabold uppercase">
                      {job.answer_classification}
                    </span>
                  )}
                </div>
                {job.answer_at && (
                  <span className="text-xs text-emerald-400/80">
                    {new Date(job.answer_at).toLocaleString('fr-FR')}
                  </span>
                )}
              </div>
              <p className="text-slate-200 whitespace-pre-line text-xs italic bg-slate-900/60 p-3 rounded-lg border border-emerald-500/20">
                {job.answer_snippet}
              </p>
            </div>
          )}

          {/* AI Fit Analysis Reasons */}
          {job.match_reasons && job.match_reasons.length > 0 && (
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
              <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 mb-2">
                <Sparkles className="h-3.5 w-3.5" /> Analyse de Correspondance IA (Antigravity)
              </h4>
              <ul className="list-disc list-inside space-y-1 text-xs text-slate-300">
                {job.match_reasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Tailored CV Section */}
          <div className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                <FileCheck className="h-4 w-4 text-emerald-400" /> CV Adapté & Personnalisé pour cette offre
              </h4>
              {job.tailored_cv_path && (
                <a
                  href={`/api/cv-preview/${job.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-3 py-1 rounded-lg text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Télécharger le CV PDF</span>
                </a>
              )}
            </div>

            {job.tailored_title ? (
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-slate-400">Titre optimisé : </span>
                  <span className="font-semibold text-white">{job.tailored_title}</span>
                </div>
                {job.tailored_summary && (
                  <div>
                    <span className="text-slate-400">Accroche / Résumé professionnel :</span>
                    <p className="mt-1 text-slate-300 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 italic">
                      {job.tailored_summary}
                    </p>
                  </div>
                )}
                {job.tailored_skills && job.tailored_skills.length > 0 && (
                  <div>
                    <span className="text-slate-400">Compétences mises en avant :</span>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {job.tailored_skills.map((skill, i) => (
                        <span key={i} className="bg-slate-800 text-emerald-300 border border-slate-700 px-2 py-0.5 rounded text-[11px] font-medium">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>Le CV n'a pas encore été adapté par AGY pour cette offre.</span>
                <button
                  onClick={() => onTailor(job.id)}
                  className="bg-slate-800 hover:bg-slate-700 text-emerald-400 px-3 py-1.5 rounded-lg border border-slate-700 font-semibold flex items-center gap-1"
                >
                  <Sparkles className="h-3 w-3" /> Adapter maintenant
                </button>
              </div>
            )}
          </div>

          {/* Generated Cover Letter */}
          {job.cover_letter && (
            <div className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-4 space-y-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                <Mail className="h-4 w-4 text-blue-400" /> Lettre / Message de Motivation Généré
              </h4>
              <p className="text-xs text-slate-300 bg-slate-900/60 p-3 rounded-lg border border-slate-800 whitespace-pre-line leading-relaxed">
                {job.cover_letter}
              </p>
            </div>
          )}

          {/* Submission Screenshot (if web form submitted) */}
          {job.submission_screenshot && (
            <div className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-4 space-y-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-200">
                Preuve de Soumission (Capture d'écran Playwright)
              </h4>
              <div className="rounded-lg overflow-hidden border border-slate-700 max-h-60 overflow-y-auto">
                <img 
                  src={`/static/screenshots/${job.submission_screenshot.split('/').pop()}`} 
                  alt="Preuve formulaire soumission" 
                  className="w-full object-cover object-top"
                />
              </div>
            </div>
          )}

          {/* Original Job Description */}
          <div className="space-y-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">
              Description Complète de l'Offre
            </h4>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-slate-300 whitespace-pre-line leading-relaxed">
              {job.description}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between gap-3">
          <a
            href={job.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 underline underline-offset-4"
          >
            <span>Voir l'offre originale sur {job.source}</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>

          <div className="flex items-center gap-2">
            {job.status === 'discovered' && (
              <button
                onClick={() => {
                  onTailor(job.id);
                  onClose();
                }}
                className="bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 border border-slate-700"
              >
                <Sparkles className="h-4 w-4" />
                <span>Adapter CV & Lettre</span>
              </button>
            )}

            {job.status !== 'applied' && job.status !== 'answer_received' && job.status !== 'interview' && (
              <button
                onClick={() => {
                  onApply(job.id);
                  onClose();
                }}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
              >
                <Send className="h-4 w-4" />
                <span>Postuler Automatiquement</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
