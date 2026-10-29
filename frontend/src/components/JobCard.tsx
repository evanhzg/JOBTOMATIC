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

  // Contract badge style
  const getContractColor = (contract: string) => {
    const c = contract.toLowerCase();
    if (c.includes('alternance') || c.includes('apprentissage')) {
      return 'bg-pickle-lime/10 text-pickle-lime border-pickle-lime/30';
    }
    if (c.includes('intérim')) {
      return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    }
    if (c.includes('cdi')) {
      return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    }
    return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
  };

  // Match score color
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-pickle-lime bg-pickle-lime/10 border-pickle-lime/30';
    if (score >= 65) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
  };

  return (
    <div 
      className={`bg-pickle-card rounded-2xl border p-4 shadow-md transition-all hover:shadow-xl hover:border-neutral-700 flex flex-col gap-3 group relative overflow-hidden ${
        isAnswerReceived 
          ? 'border-pickle-lime ring-2 ring-pickle-lime/30 bg-gradient-to-b from-pickle-card to-pickle-dark' 
          : 'border-pickle-border'
      }`}
    >
      {/* Pickles.team Recruiter Answer Banner */}
      {isAnswerReceived && (
        <div className="bg-pickle-lime text-pickle-dark px-3 py-1 -mx-4 -mt-4 mb-1 font-black text-xs flex items-center justify-between shadow-sm">
          <span className="flex items-center gap-1.5 font-['Inter_Tight',sans-serif]">
            <MessageSquareReply className="h-3.5 w-3.5" /> RÉPONSE REÇUE !
          </span>
          {job.answer_classification && (
            <span className="bg-pickle-dark text-pickle-lime px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wider">
              {job.answer_classification}
            </span>
          )}
        </div>
      )}

      {/* Top Row: Contract, Source & Match Score */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${getContractColor(job.contract_type)}`}>
            {job.contract_type}
          </span>
          <span className="text-[10px] text-pickle-subtle bg-neutral-900 px-2 py-0.5 rounded-full border border-neutral-800">
            {job.source}
          </span>
        </div>

        {/* Fit Score Badge */}
        <div 
          className={`flex items-center gap-1 text-xs font-black px-2.5 py-0.5 rounded-full border ${getScoreColor(job.match_score)}`}
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
          className="font-bold text-sm text-white hover:text-pickle-lime cursor-pointer line-clamp-2 transition-colors font-['Inter_Tight',sans-serif]"
          title={job.title}
        >
          {job.title}
        </h3>
        <div className="flex items-center gap-3 text-xs text-pickle-subtle mt-1.5">
          <span className="flex items-center gap-1 font-medium text-neutral-300 truncate">
            <Building2 className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
            {job.company}
          </span>
          <span className="flex items-center gap-1 shrink-0">
            <MapPin className="h-3.5 w-3.5 text-neutral-500" />
            {job.location}
          </span>
        </div>
      </div>

      {/* Answer Snippet if answer happened */}
      {isAnswerReceived && job.answer_snippet && (
        <div className="bg-neutral-900 border border-pickle-lime/40 rounded-xl p-2.5 text-xs text-neutral-200">
          <div className="font-bold text-pickle-lime text-[11px] mb-1 flex items-center justify-between">
            <span>Message du recruteur :</span>
            {job.answer_at && (
              <span className="text-[10px] text-neutral-400">
                {new Date(job.answer_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </div>
          <p className="line-clamp-2 italic text-neutral-300">"{job.answer_snippet}"</p>
        </div>
      )}

      {/* Direct CV Preview & Improve Buttons */}
      <div className="flex items-center gap-1.5 pt-1">
        <button
          onClick={() => onPreviewCV(job)}
          className="flex-1 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white px-2.5 py-1.5 rounded-full text-[11px] font-bold border border-neutral-800 flex items-center justify-center gap-1 transition-all"
          title="Aperçu du CV adapté pour cette offre"
        >
          <Eye className="h-3 w-3 text-pickle-lime" />
          <span>Aperçu CV</span>
        </button>

        {job.match_score < 80 && (
          <button
            onClick={() => onImproveCV(job)}
            className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-1.5 rounded-full text-[11px] font-black flex items-center gap-1 transition-all"
            title="L'IA analyse et améliore votre CV pour augmenter son score"
          >
            <Rocket className="h-3 w-3" />
            <span>Booster</span>
          </button>
        )}
      </div>

      {/* Card Action Buttons */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-pickle-border mt-auto text-xs">
        <button
          onClick={() => onOpenDetails(job)}
          className="text-pickle-subtle hover:text-white flex items-center gap-1 font-semibold transition-colors"
        >
          <FileText className="h-3.5 w-3.5" />
          <span>Détails</span>
        </button>

        <div className="flex items-center gap-1">
          {job.status === 'discovered' && (
            <button
              onClick={() => onTailor(job.id)}
              className="bg-pickle-card hover:bg-neutral-800 text-pickle-lime px-3 py-1 rounded-full font-bold flex items-center gap-1 border border-pickle-border active:scale-95"
            >
              <Sparkles className="h-3 w-3" />
              <span>Adapter</span>
            </button>
          )}

          {job.status === 'tailored' && (
            <button
              onClick={() => onApply(job.id)}
              className="bg-pickle-lime hover:bg-pickle-limeHover text-pickle-dark px-3 py-1 rounded-full font-black flex items-center gap-1 active:scale-95 shadow-md shadow-pickle-lime/20"
            >
              <Send className="h-3 w-3" />
              <span>Postuler</span>
            </button>
          )}

          {isApplied && (
            <button
              onClick={() => onSimulateReply(job.id)}
              className="bg-neutral-900 hover:bg-neutral-800 text-pickle-subtle hover:text-pickle-lime px-2 py-1 rounded-full border border-neutral-800 text-[10px] flex items-center gap-1"
              title="Tester la détection de réponse (Simulation)"
            >
              <MessageSquareReply className="h-3 w-3" />
              <span>Test Réponse</span>
            </button>
          )}

          {isAnswerReceived && (
            <button
              onClick={() => onMoveStatus(job.id, 'interview')}
              className="bg-pickle-lime hover:bg-pickle-limeHover text-pickle-dark px-3 py-1 rounded-full font-black text-[11px] flex items-center gap-1"
            >
              <CheckCircle2 className="h-3 w-3" />
              <span>Entretien</span>
            </button>
          )}
        </div>
      </div>

    </div>
  );
};
