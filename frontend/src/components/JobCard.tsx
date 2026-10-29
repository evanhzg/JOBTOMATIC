import React from 'react';
import { 
  Building2, 
  MapPin, 
  Sparkles, 
  FileText, 
  Send, 
  MessageSquareReply, 
  CheckCircle2, 
  Eye,
  Rocket,
  AlertTriangle
} from 'lucide-react';
import { Job, JobStatus } from '../types';
import { Language, translations } from '../i18n';

interface JobCardProps {
  job: Job;
  onOpenDetails: (job: Job) => void;
  onPreviewCV: (job: Job) => void;
  onImproveCV: (job: Job) => void;
  onApply: (jobId: number) => void;
  onTailor: (jobId: number) => void;
  onSimulateReply: (jobId: number) => void;
  onMoveStatus: (jobId: number, newStatus: JobStatus) => void;
  currentLang?: Language;
}

export const JobCard: React.FC<JobCardProps> = ({
  job,
  onOpenDetails,
  onPreviewCV,
  onImproveCV,
  onApply,
  onTailor,
  onSimulateReply,
  onMoveStatus,
  currentLang = 'fr'
}) => {
  const isAnswerReceived = job.status === 'answer_received';
  const isApplied = job.status === 'applied';
  const t = translations[currentLang];

  // Detect if job is actually an educational institution / school ad
  const descLower = (job.title + " " + job.company + " " + (job.description || '')).toLowerCase();
  const isSchoolAd = job.is_school_promotion || (
    descLower.includes("école partenaire") ||
    descLower.includes("organisme de formation") ||
    descLower.includes("titre certifié") ||
    descLower.includes("frais de scolarité") ||
    descLower.includes("admission sur concours")
  );

  // Contract badge style (Sharp, unrounded, pickles.app muted tone)
  const getContractColor = (contract: string) => {
    const c = contract.toLowerCase();
    if (c.includes('alternance') || c.includes('apprentissage')) {
      return 'bg-[#EEF3E9] text-[#5F7A48] border-[#C8DAC0]';
    }
    if (c.includes('intérim')) {
      return 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]';
    }
    if (c.includes('cdi')) {
      return 'bg-[#FAF5FF] text-[#7E22CE] border-[#E9D5FF]';
    }
    return 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]';
  };

  // Match score color (Muted, non-flashy)
  const getScoreColor = (score: number) => {
    if (isSchoolAd) return 'text-[#B45309] bg-[#FEF3C7] border-[#FDE68A]';
    if (score >= 80) return 'text-[#5F7A48] bg-[#EEF3E9] border-[#C8DAC0]';
    if (score >= 65) return 'text-[#B45309] bg-[#FEF3C7] border-[#FDE68A]';
    return 'text-[#DC2626] bg-[#FEF2F2] border-[#FECACA]';
  };

  return (
    <div 
      className={`bg-[#FFFFFF] border p-3 shadow-xs transition-all hover:border-[#18181B] flex flex-col gap-2 relative font-sans ${
        isAnswerReceived 
          ? 'border-[#5F7A48] ring-1 ring-[#5F7A48]/30 bg-[#FBFDF9]' 
          : isSchoolAd 
            ? 'border-[#FDE68A] bg-[#FFFDF5]'
            : 'border-[#D4D4D8]'
      }`}
    >
      {/* Pickles.app Recruiter Answer Banner */}
      {isAnswerReceived && (
        <div className="bg-[#5F7A48] text-[#FFFFFF] px-2.5 py-0.5 -mx-3 -mt-3 mb-0.5 font-mono font-bold text-[11px] flex items-center justify-between">
          <span className="flex items-center gap-1 uppercase tracking-tight">
            <MessageSquareReply className="h-3 w-3" /> {t.col_answer}
          </span>
          {job.answer_classification && (
            <span className="bg-[#FFFFFF] text-[#5F7A48] px-1 py-0.1 font-mono text-[8px] uppercase font-bold tracking-wider">
              {job.answer_classification}
            </span>
          )}
        </div>
      )}

      {/* School / Training Center Warning */}
      {isSchoolAd && (
        <div className="bg-[#FEF3C7] border border-[#FDE68A] text-[#B45309] px-2 py-0.5 font-mono text-[9.5px] font-bold flex items-center gap-1 -mx-1">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          <span className="truncate">Publicité formation / école (Non employeur)</span>
        </div>
      )}

      {/* Top Row: Contract, Source & Match Score */}
      <div className="flex items-center justify-between gap-1 font-mono">
        <div className="flex items-center gap-1 flex-wrap min-w-0">
          <span className={`text-[9.5px] font-bold px-1.5 py-0.2 border truncate ${getContractColor(job.contract_type)}`}>
            {job.contract_type}
          </span>
          <span className="text-[9.5px] text-[#71717A] bg-[#F4F4F0] px-1 py-0.2 border border-[#E4E4E7] truncate">
            {job.source}
          </span>
        </div>

        {/* Fit Score Badge */}
        <div 
          className={`flex items-center gap-0.5 text-[10.5px] font-mono font-black px-1.5 py-0.2 border shrink-0 ${getScoreColor(job.match_score)}`}
          title={isSchoolAd ? "Annonce d'école de formation détectée" : (job.match_reasons?.join('\n') || `Score: ${job.match_score}%`)}
        >
          <Sparkles className="h-2.5 w-2.5" />
          <span>{isSchoolAd ? '20%' : `${job.match_score}%`}</span>
        </div>
      </div>

      {/* Job Title & Company */}
      <div className="min-w-0">
        <h3 
          onClick={() => onOpenDetails(job)}
          className="font-bold text-xs text-[#18181B] hover:text-[#5F7A48] cursor-pointer line-clamp-2 transition-colors font-sans leading-tight"
          title={job.title}
        >
          {job.title}
        </h3>
        <div className="flex items-center gap-2 text-[11px] text-[#71717A] mt-1 font-mono">
          <span className="flex items-center gap-0.5 text-[#27272A] truncate">
            <Building2 className="h-3 w-3 text-[#A1A1AA] shrink-0" />
            <span className="truncate font-medium">{job.company}</span>
          </span>
          <span className="flex items-center gap-0.5 shrink-0">
            <MapPin className="h-3 w-3 text-[#A1A1AA]" />
            <span className="truncate">{job.location}</span>
          </span>
        </div>
      </div>

      {/* Answer Snippet if answer happened */}
      {isAnswerReceived && job.answer_snippet && (
        <div className="bg-[#FAF9F6] border border-[#C8DAC0] p-2 text-xs text-[#27272A] font-mono">
          <div className="font-bold text-[#5F7A48] text-[9.5px] mb-0.5 flex items-center justify-between">
            <span>MESSAGE DU RECRUTEUR :</span>
            {job.answer_at && (
              <span className="text-[9px] text-[#71717A]">
                {new Date(job.answer_at).toLocaleDateString(currentLang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </div>
          <p className="line-clamp-2 italic text-[#52525B] text-[10.5px]">"{job.answer_snippet}"</p>
        </div>
      )}

      {/* Direct CV Preview & Improve Buttons */}
      <div className="flex items-center gap-1 pt-0.5 font-mono">
        <button
          onClick={() => onPreviewCV(job)}
          className="flex-1 bg-[#FAF9F6] hover:bg-[#F2F2EC] text-[#18181B] px-1.5 py-1 text-[10px] font-bold border border-[#D4D4D8] flex items-center justify-center gap-1 transition-all"
          title="Aperçu du CV adapté pour cette offre"
        >
          <Eye className="h-3 w-3 text-[#5F7A48]" />
          <span>{t.btn_preview_cv}</span>
        </button>

        {job.match_score < 80 && !isSchoolAd && (
          <button
            onClick={() => onImproveCV(job)}
            className="bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#B45309] border border-[#FDE68A] px-2 py-1 text-[10px] font-black flex items-center gap-0.5 transition-all shrink-0"
            title="L'IA analyse et améliore votre CV"
          >
            <Rocket className="h-2.5 w-2.5" />
            <span>{t.btn_boost}</span>
          </button>
        )}
      </div>

      {/* Card Action Buttons (Sharp brutalist) */}
      <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-[#E4E4E7] mt-auto text-xs font-mono">
        <button
          onClick={() => onOpenDetails(job)}
          className="text-[#71717A] hover:text-[#18181B] flex items-center gap-0.5 font-bold transition-colors text-[10px]"
        >
          <FileText className="h-3 w-3" />
          <span>{t.btn_details}</span>
        </button>

        <div className="flex items-center gap-1">
          {job.status === 'discovered' && (
            <button
              onClick={() => onTailor(job.id)}
              className="bg-[#FAF9F6] hover:bg-[#F2F2EC] text-[#5F7A48] px-2 py-0.5 font-bold flex items-center gap-0.5 border border-[#D4D4D8] text-[10px]"
            >
              <Sparkles className="h-2.5 w-2.5" />
              <span>{t.btn_adapt}</span>
            </button>
          )}

          {job.status === 'tailored' && (
            <button
              onClick={() => onApply(job.id)}
              className="bg-[#5F7A48] hover:bg-[#4E653A] text-white px-2.5 py-0.5 font-black flex items-center gap-0.5 border border-[#5F7A48] text-[10px]"
            >
              <Send className="h-2.5 w-2.5" />
              <span>{t.btn_apply}</span>
            </button>
          )}

          {isApplied && (
            <button
              onClick={() => onSimulateReply(job.id)}
              className="bg-[#FAF9F6] hover:bg-[#F2F2EC] text-[#71717A] hover:text-[#5F7A48] px-1.5 py-0.5 border border-[#E4E4E7] text-[9.5px] flex items-center gap-0.5"
            >
              <MessageSquareReply className="h-2.5 w-2.5" />
              <span>{t.btn_test_reply}</span>
            </button>
          )}

          {isAnswerReceived && (
            <button
              onClick={() => onMoveStatus(job.id, 'interview')}
              className="bg-[#5F7A48] hover:bg-[#4E653A] text-white px-2 py-0.5 font-black text-[9.5px] flex items-center gap-0.5 border border-[#5F7A48]"
            >
              <CheckCircle2 className="h-2.5 w-2.5" />
              <span>{t.btn_interview}</span>
            </button>
          )}
        </div>
      </div>

    </div>
  );
};
