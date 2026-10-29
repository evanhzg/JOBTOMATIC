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
  FileCheck,
  AlertTriangle
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

  const descLower = (job.title + " " + job.company + " " + (job.description || '')).toLowerCase();
  const isSchoolAd = job.is_school_promotion || (
    descLower.includes("école partenaire") ||
    descLower.includes("organisme de formation") ||
    descLower.includes("titre certifié") ||
    descLower.includes("frais de scolarité")
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs overflow-y-auto font-mono">
      <div className="bg-[#FFFFFF] border-2 border-[#18181B] w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-[#D4D4D8] flex items-start justify-between gap-4 bg-[#FAF9F6]">
          <div>
            <div className="flex items-center gap-1.5 mb-1.5 font-mono">
              <span className="text-[10px] font-bold px-1.5 py-0.2 border bg-[#EEF3E9] text-[#5F7A48] border-[#C8DAC0]">
                {job.contract_type}
              </span>
              <span className="text-[10px] text-[#71717A] bg-white px-1.5 py-0.2 border border-[#D4D4D8]">
                {job.source}
              </span>
              <span className="text-[10px] font-bold text-[#5F7A48] bg-[#EEF3E9] px-2 py-0.2 border border-[#C8DAC0] flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> SCORE : {isSchoolAd ? '20%' : `${job.match_score}%`}
              </span>
            </div>
            <h2 className="text-base font-black text-[#18181B] uppercase tracking-tight">{job.title}</h2>
            <div className="flex items-center gap-3 text-xs text-[#71717A] mt-1.5">
              <span className="flex items-center gap-1 text-[#18181B] font-medium">
                <Building2 className="h-3.5 w-3.5 text-[#A1A1AA]" /> {job.company}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-[#A1A1AA]" /> {job.location}
              </span>
              {job.salary && (
                <span className="text-[#5F7A48] font-bold">💰 {job.salary}</span>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-[#71717A] hover:text-[#18181B] p-1 border border-transparent hover:border-[#D4D4D8] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-[#27272A]">
          
          {/* School Ad Warning Notice */}
          {isSchoolAd && (
            <div className="bg-[#FEF3C7] border border-[#FDE68A] text-[#B45309] p-3 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" /> ATTENTION : Annonce de Formation / École Détectée
              </div>
              <p className="text-[11px] leading-relaxed">
                Cette proposition émane d'un organisme de formation vendant une scolarité/inscription plutôt que d'un employeur direct proposant un contrat de travail rémunéré. L'autopilot ne postulera pas automatiquement.
              </p>
            </div>
          )}

          {/* Recruiter Answer Notice */}
          {job.status === 'answer_received' && job.answer_snippet && (
            <div className="bg-[#EEF3E9] border border-[#5F7A48] p-3.5 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-bold text-[#5F7A48] text-xs">
                  <MessageSquareReply className="h-4 w-4" /> RÉPONSE DU RECRUTEUR
                  {job.answer_classification && (
                    <span className="bg-[#5F7A48] text-white text-[9px] px-1.5 py-0.1 font-black uppercase">
                      {job.answer_classification}
                    </span>
                  )}
                </div>
                {job.answer_at && (
                  <span className="text-[10px] text-[#71717A]">
                    {new Date(job.answer_at).toLocaleString('fr-FR')}
                  </span>
                )}
              </div>
              <p className="text-[#18181B] whitespace-pre-line text-xs italic bg-white p-2.5 border border-[#C8DAC0]">
                "{job.answer_snippet}"
              </p>
            </div>
          )}

          {/* AI Fit Analysis Reasons */}
          {job.match_reasons && job.match_reasons.length > 0 && (
            <div className="bg-[#FAF9F6] border border-[#D4D4D8] p-3.5">
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#18181B] flex items-center gap-1.5 mb-1.5">
                <Sparkles className="h-3.5 w-3.5 text-[#5F7A48]" /> Analyse de Correspondance IA
              </h4>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-[#52525B]">
                {job.match_reasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Tailored CV Section */}
          <div className="bg-[#FAF9F6] border border-[#D4D4D8] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#18181B] flex items-center gap-1.5">
                <FileCheck className="h-4 w-4 text-[#5F7A48]" /> CV Adapté & Personnalisé pour cette offre
              </h4>
              {job.tailored_cv_path && (
                <a
                  href={`/api/cv-preview/${job.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-[#5F7A48] hover:bg-[#4E653A] text-white font-black px-2.5 py-0.5 text-xs flex items-center gap-1 border border-[#5F7A48] transition-all"
                >
                  <Download className="h-3 w-3" />
                  <span>Télécharger PDF</span>
                </a>
              )}
            </div>

            {job.tailored_title ? (
              <div className="space-y-1.5 text-xs">
                <div>
                  <span className="text-[#71717A]">Titre optimisé : </span>
                  <span className="font-semibold text-[#18181B]">{job.tailored_title}</span>
                </div>
                {job.tailored_summary && (
                  <div>
                    <span className="text-[#71717A]">Accroche professionnelle :</span>
                    <p className="mt-0.5 text-[#3F3F46] bg-white p-2 border border-[#E2E2DC] italic text-[11px]">
                      {job.tailored_summary}
                    </p>
                  </div>
                )}
                {job.tailored_skills && job.tailored_skills.length > 0 && (
                  <div>
                    <span className="text-[#71717A]">Compétences mises en avant :</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {job.tailored_skills.map((skill, i) => (
                        <span key={i} className="bg-white text-[#18181B] border border-[#D4D4D8] px-1.5 py-0.2 text-[10px] font-medium">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-[#71717A] flex items-center justify-between">
                <span>Le CV n'a pas encore été adapté par l'IA pour cette offre.</span>
                <button
                  onClick={() => onTailor(job.id)}
                  className="bg-white hover:bg-[#F2F2EC] text-[#5F7A48] px-2.5 py-1 border border-[#D4D4D8] font-bold flex items-center gap-1"
                >
                  <Sparkles className="h-3 w-3" /> Adapter maintenant
                </button>
              </div>
            )}
          </div>

          {/* Generated Cover Letter */}
          {job.cover_letter && (
            <div className="bg-[#FAF9F6] border border-[#D4D4D8] p-3.5 space-y-1.5">
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#18181B] flex items-center gap-1.5">
                <Mail className="h-4 w-4 text-blue-600" /> Lettre / Message de Motivation
              </h4>
              <p className="text-[11px] text-[#3F3F46] bg-white p-2.5 border border-[#E2E2DC] whitespace-pre-line leading-relaxed">
                {job.cover_letter}
              </p>
            </div>
          )}

          {/* Original Job Description */}
          <div className="space-y-1.5">
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#71717A]">
              Description Complète de l'Offre
            </h4>
            <div className="bg-[#FAF9F6] p-3.5 border border-[#D4D4D8] text-[11px] text-[#3F3F46] whitespace-pre-line leading-relaxed">
              {job.description}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-[#D4D4D8] bg-[#FAF9F6] flex items-center justify-between gap-3">
          <a
            href={job.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-[#71717A] hover:text-[#18181B] flex items-center gap-1 underline underline-offset-4"
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
                className="bg-white hover:bg-[#F2F2EC] text-[#5F7A48] font-bold px-3.5 py-1.5 text-xs flex items-center gap-1 border border-[#D4D4D8]"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Adapter CV & Lettre</span>
              </button>
            )}

            {job.status !== 'applied' && job.status !== 'answer_received' && job.status !== 'interview' && (
              <button
                onClick={() => {
                  onApply(job.id);
                  onClose();
                }}
                className="bg-[#5F7A48] hover:bg-[#4E653A] text-white font-black px-4 py-1.5 text-xs flex items-center gap-1.5 border border-[#5F7A48] transition-all"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Postuler Automatiquement</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
