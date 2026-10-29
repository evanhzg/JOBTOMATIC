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
  Rocket
} from 'lucide-react';
import { Job, JobStatus } from '../types';

interface JobCardProps {
  job: Job;
  onOpenDetails: (job: Job) => void;
  onPreviewCV: (job: Job) => void;
  onImproveCV: (job: Job) => void;
  onApply: (jobId: number) => void;
  onTailor: (jobId: number) => void;
  onSimulateReply: (jobId: number) => void;
  onMoveStatus: (jobId: number, newStatus: JobStatus) => void;
}

export const JobCard: React.FC<JobCardProps> = ({
  job,
  onOpenDetails,
  onPreviewCV,
  onImproveCV,
  onApply,
  onTailor,
  onSimulateReply,
  onMoveStatus
}) => {
  const isAnswerReceived = job.status === 'answer_received';
  const isApplied = job.status === 'applied';

  // Contract badge style (Sharp, unrounded)
  const getContractColor = (contract: string) => {
    const c = contract.toLowerCase();
    if (c.includes('alternance') || c.includes('apprentissage')) {
      return 'bg-[#182610] text-[#C5EA4B] border-[#C5EA4B]/40';
    }
    if (c.includes('intérim')) {
      return 'bg-[#101C26] text-blue-400 border-blue-500/40';
    }
    if (c.includes('cdi')) {
      return 'bg-[#201026] text-purple-400 border-purple-500/40';
    }
    return 'bg-[#261E10] text-amber-400 border-amber-500/40';
  };

  // Match score color (Sharp, unrounded)
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-[#C5EA4B] bg-[#182610] border-[#C5EA4B]';
    if (score >= 65) return 'text-[#FA5F11] bg-[#2A1810] border-[#FA5F11]';
    return 'text-rose-400 bg-rose-950/40 border-rose-800';
  };

  return (
    <div 
      className={`bg-[#141414] border p-4 shadow-md transition-all hover:border-[#444444] flex flex-col gap-3 group relative font-sans ${
        isAnswerReceived 
          ? 'border-[#C5EA4B] bg-[#161B12]' 
          : 'border-[#242424]'
      }`}
    >
      {/* Pickles.team Recruiter Answer Banner */}
      {isAnswerReceived && (
        <div className="bg-[#C5EA4B] text-[#0C0C0C] px-3 py-1 -mx-4 -mt-4 mb-1 font-mono font-black text-xs flex items-center justify-between">
          <span className="flex items-center gap-1.5 uppercase tracking-wide">
            <MessageSquareReply className="h-3.5 w-3.5" /> RÉPONSE REÇUE !
          </span>
          {job.answer_classification && (
            <span className="bg-[#0C0C0C] text-[#C5EA4B] px-1.5 py-0.2 font-mono text-[9px] uppercase font-bold tracking-wider">
              {job.answer_classification}
            </span>
          )}
        </div>
      )}

      {/* Top Row: Contract, Source & Match Score */}
      <div className="flex items-center justify-between gap-2 font-mono">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[10px] font-bold px-2 py-0.5 border ${getContractColor(job.contract_type)}`}>
            {job.contract_type}
          </span>
          <span className="text-[10px] text-[#8E8E8E] bg-[#0C0C0C] px-1.5 py-0.5 border border-[#222222]">
            {job.source}
          </span>
        </div>

        {/* Fit Score Badge */}
        <div 
          className={`flex items-center gap-1 text-[11px] font-mono font-black px-2 py-0.5 border ${getScoreColor(job.match_score)}`}
          title={job.match_reasons?.join('\n') || `Score: ${job.match_score}%`}
        >
          <Sparkles className="h-3 w-3" />
          <span>{job.match_score}%</span>
        </div>
      </div>

      {/* Job Title & Company */}
      <div>
        <h3 
          onClick={() => onOpenDetails(job)}
          className="font-bold text-sm text-white hover:text-[#C5EA4B] cursor-pointer line-clamp-2 transition-colors font-mono"
          title={job.title}
        >
          {job.title}
        </h3>
        <div className="flex items-center gap-3 text-xs text-[#8E8E8E] mt-1.5 font-mono">
          <span className="flex items-center gap-1 text-[#CCCCCC] truncate">
            <Building2 className="h-3.5 w-3.5 text-[#666666] shrink-0" />
            {job.company}
          </span>
          <span className="flex items-center gap-1 shrink-0">
            <MapPin className="h-3.5 w-3.5 text-[#666666]" />
            {job.location}
          </span>
        </div>
      </div>

      {/* Answer Snippet if answer happened */}
      {isAnswerReceived && job.answer_snippet && (
        <div className="bg-[#0C0C0C] border border-[#C5EA4B]/50 p-2.5 text-xs text-[#E0E0E0] font-mono">
          <div className="font-bold text-[#C5EA4B] text-[10px] mb-1 flex items-center justify-between">
            <span>MESSAGE DU RECRUTEUR :</span>
            {job.answer_at && (
              <span className="text-[10px] text-[#888888]">
                {new Date(job.answer_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </div>
          <p className="line-clamp-2 italic text-[#CCCCCC]">"{job.answer_snippet}"</p>
        </div>
      )}

      {/* Direct CV Preview & Improve Buttons */}
      <div className="flex items-center gap-1.5 pt-1 font-mono">
        <button
          onClick={() => onPreviewCV(job)}
          className="flex-1 bg-[#1A1A1A] hover:bg-[#262626] text-[#E0E0E0] hover:text-white px-2 py-1.5 text-[11px] font-bold border border-[#2D2D2D] flex items-center justify-center gap-1 transition-all"
          title="Aperçu du CV adapté pour cette offre"
        >
          <Eye className="h-3 w-3 text-[#C5EA4B]" />
          <span>APERÇU CV</span>
        </button>

        {job.match_score < 80 && (
          <button
            onClick={() => onImproveCV(job)}
            className="bg-[#2A1810] hover:bg-[#3D2010] text-[#FA5F11] border border-[#FA5F11] px-2.5 py-1.5 text-[11px] font-black flex items-center gap-1 transition-all"
            title="L'IA analyse et améliore votre CV pour augmenter son score"
          >
            <Rocket className="h-3 w-3" />
            <span>BOOSTER</span>
          </button>
        )}
      </div>

      {/* Card Action Buttons (Sharp brutalist) */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#242424] mt-auto text-xs font-mono">
        <button
          onClick={() => onOpenDetails(job)}
          className="text-[#8E8E8E] hover:text-white flex items-center gap-1 font-bold transition-colors text-[11px]"
        >
          <FileText className="h-3.5 w-3.5" />
          <span>DÉTAILS</span>
        </button>

        <div className="flex items-center gap-1">
          {job.status === 'discovered' && (
            <button
              onClick={() => onTailor(job.id)}
              className="bg-[#1A1A1A] hover:bg-[#252525] text-[#C5EA4B] px-3 py-1 font-bold flex items-center gap-1 border border-[#333333] text-[11px]"
            >
              <Sparkles className="h-3 w-3" />
              <span>ADAPTER</span>
            </button>
          )}

          {job.status === 'tailored' && (
            <button
              onClick={() => onApply(job.id)}
              className="bg-[#C5EA4B] hover:bg-[#d6f859] text-black px-3 py-1 font-black flex items-center gap-1 border border-[#C5EA4B] text-[11px]"
            >
              <Send className="h-3 w-3" />
              <span>POSTULER</span>
            </button>
          )}

          {isApplied && (
            <button
              onClick={() => onSimulateReply(job.id)}
              className="bg-[#0C0C0C] hover:bg-[#1A1A1A] text-[#8E8E8E] hover:text-[#C5EA4B] px-2 py-1 border border-[#262626] text-[10px] flex items-center gap-1"
              title="Tester la détection de réponse (Simulation)"
            >
              <MessageSquareReply className="h-3 w-3" />
              <span>TEST RÉPONSE</span>
            </button>
          )}

          {isAnswerReceived && (
            <button
              onClick={() => onMoveStatus(job.id, 'interview')}
              className="bg-[#C5EA4B] hover:bg-[#d6f859] text-black px-2.5 py-1 font-black text-[10px] flex items-center gap-1 border border-[#C5EA4B]"
            >
              <CheckCircle2 className="h-3 w-3" />
              <span>ENTRETIEN</span>
            </button>
          )}
        </div>
      </div>

    </div>
  );
};
