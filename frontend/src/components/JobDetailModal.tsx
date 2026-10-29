import React from 'react';
import { 
  X, 
  Building2, 
  MapPin, 
  ExternalLink, 
  Download, 
  Sparkles, 
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#141414] border-2 border-[#242424] w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-mono">
        
        {/* Header */}
        <div className="p-5 border-b border-[#242424] flex items-start justify-between gap-4 bg-[#0C0C0C]">
          <div>
            <div className="flex items-center gap-2 mb-2 font-mono">
              <span className="text-[10px] font-bold px-2 py-0.5 border bg-[#182610] text-[#C5EA4B] border-[#C5EA4B]/40">
                {job.contract_type}
              </span>
              <span className="text-[10px] text-[#8E8E8E] bg-[#141414] px-1.5 py-0.5 border border-[#222222]">
                {job.source}
              </span>
              <span className="text-[10px] font-bold text-[#C5EA4B] bg-[#182610] px-2 py-0.5 border border-[#C5EA4B] flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> SCORE: {job.match_score}%
              </span>
            </div>
            <h2 className="text-lg font-black text-white uppercase tracking-tight">{job.title}</h2>
            <div className="flex items-center gap-4 text-xs text-[#8E8E8E] mt-2">
              <span className="flex items-center gap-1 text-[#CCCCCC] font-medium">
                <Building2 className="h-3.5 w-3.5 text-[#666666]" /> {job.company}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-[#666666]" /> {job.location}
              </span>
              {job.salary && (
                <span className="text-[#C5EA4B] font-medium">💰 {job.salary}</span>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-[#8E8E8E] hover:text-white p-1.5 border border-transparent hover:border-[#333333] hover:bg-[#202020] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-[#CCCCCC]">
          
          {/* Recruiter Answer Notice */}
          {job.status === 'answer_received' && job.answer_snippet && (
            <div className="bg-[#182610] border border-[#C5EA4B] p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-[#C5EA4B] text-xs">
                  <MessageSquareReply className="h-4 w-4" /> RÉPONSE REÇUE DU RECRUTEUR
                  {job.answer_classification && (
                    <span className="bg-[#C5EA4B] text-black text-[10px] px-1.5 py-0.2 font-black uppercase">
                      {job.answer_classification}
                    </span>
                  )}
                </div>
                {job.answer_at && (
                  <span className="text-[10px] text-[#8E8E8E]">
                    {new Date(job.answer_at).toLocaleString('fr-FR')}
                  </span>
                )}
              </div>
              <p className="text-white whitespace-pre-line text-xs italic bg-[#0C0C0C] p-3 border border-[#242424]">
                "{job.answer_snippet}"
              </p>
            </div>
          )}

          {/* AI Fit Analysis Reasons */}
          {job.match_reasons && job.match_reasons.length > 0 && (
            <div className="bg-[#0C0C0C] border border-[#242424] p-4">
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#C5EA4B] flex items-center gap-1.5 mb-2">
                <Sparkles className="h-3.5 w-3.5" /> Analyse de Correspondance IA
              </h4>
              <ul className="list-disc list-inside space-y-1 text-xs text-[#AAAAAA]">
                {job.match_reasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Tailored CV Section */}
          <div className="bg-[#0C0C0C] border border-[#242424] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs uppercase tracking-wider text-white flex items-center gap-1.5">
                <FileCheck className="h-4 w-4 text-[#C5EA4B]" /> CV Adapté & Personnalisé pour cette offre
              </h4>
              {job.tailored_cv_path && (
                <a
                  href={`/api/cv-preview/${job.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-[#C5EA4B] hover:bg-[#d6f859] text-black font-black px-3 py-1 text-xs flex items-center gap-1.5 border border-[#C5EA4B] transition-all"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Télécharger PDF</span>
                </a>
              )}
            </div>

            {job.tailored_title ? (
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[#8E8E8E]">Titre optimisé : </span>
                  <span className="font-semibold text-white">{job.tailored_title}</span>
                </div>
                {job.tailored_summary && (
                  <div>
                    <span className="text-[#8E8E8E]">Accroche professionnelle :</span>
                    <p className="mt-1 text-[#CCCCCC] bg-[#141414] p-2.5 border border-[#242424] italic">
                      {job.tailored_summary}
                    </p>
                  </div>
                )}
                {job.tailored_skills && job.tailored_skills.length > 0 && (
                  <div>
                    <span className="text-[#8E8E8E]">Compétences mises en avant :</span>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {job.tailored_skills.map((skill, i) => (
                        <span key={i} className="bg-[#141414] text-[#C5EA4B] border border-[#262626] px-2 py-0.5 text-[10px] font-medium">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-[#8E8E8E] flex items-center justify-between">
                <span>Le CV n'a pas encore été adapté par l'IA pour cette offre.</span>
                <button
                  onClick={() => onTailor(job.id)}
                  className="bg-[#1A1A1A] hover:bg-[#252525] text-[#C5EA4B] px-3 py-1.5 border border-[#333333] font-bold flex items-center gap-1"
                >
                  <Sparkles className="h-3 w-3" /> Adapter maintenant
                </button>
              </div>
            )}
          </div>

          {/* Generated Cover Letter */}
          {job.cover_letter && (
            <div className="bg-[#0C0C0C] border border-[#242424] p-4 space-y-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-white flex items-center gap-1.5">
                <Mail className="h-4 w-4 text-blue-400" /> Lettre / Message de Motivation
              </h4>
              <p className="text-xs text-[#CCCCCC] bg-[#141414] p-3 border border-[#242424] whitespace-pre-line leading-relaxed">
                {job.cover_letter}
              </p>
            </div>
          )}

          {/* Submission Screenshot */}
          {job.submission_screenshot && (
            <div className="bg-[#0C0C0C] border border-[#242424] p-4 space-y-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-white">
                Preuve de Soumission (Capture d'écran Playwright)
              </h4>
              <div className="border border-[#333333] max-h-60 overflow-y-auto">
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
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#8E8E8E]">
              Description Complète de l'Offre
            </h4>
            <div className="bg-[#0C0C0C] p-4 border border-[#242424] text-xs text-[#CCCCCC] whitespace-pre-line leading-relaxed">
              {job.description}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#242424] bg-[#0C0C0C] flex items-center justify-between gap-3">
          <a
            href={job.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-[#8E8E8E] hover:text-white flex items-center gap-1 underline underline-offset-4"
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
                className="bg-[#1A1A1A] hover:bg-[#252525] text-[#C5EA4B] font-bold px-4 py-2 text-xs flex items-center gap-1.5 border border-[#333333]"
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
                className="bg-[#C5EA4B] hover:bg-[#d6f859] text-black font-black px-4 py-2 text-xs flex items-center gap-1.5 border border-[#C5EA4B] transition-all"
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
