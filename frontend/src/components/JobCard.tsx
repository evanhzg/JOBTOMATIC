import React from 'react';
import { 
  Building2, 
  MapPin, 
  Sparkles, 
  Mail, 
  FileText, 
  Send, 
  MessageSquareReply, 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  ChevronRight, 
  AlertCircle
} from 'lucide-react';
import { Job, JobStatus } from '../types';

interface JobCardProps {
  job: Job;
  onOpenDetails: (job: Job) => void;
  onApply: (jobId: number) => void;
  onTailor: (jobId: number) => void;
  onSimulateReply: (jobId: number) => void;
  onMoveStatus: (jobId: number, newStatus: JobStatus) => void;
}

export const JobCard: React.FC<JobCardProps> = ({
  job,
  onOpenDetails,
  onApply,
  onTailor,
  onSimulateReply,
  onMoveStatus
}) => {
  const isAnswerReceived = job.status === 'answer_received';
  const isApplied = job.status === 'applied';
  const isTailored = job.status === 'tailored';

  // Contract badge style
  const getContractColor = (contract: string) => {
    const c = contract.toLowerCase();
    if (c.includes('alternance') || c.includes('apprentissage')) {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
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
    if (score >= 80) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (score >= 65) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-slate-400 bg-slate-800 border-slate-700';
  };

  return (
    <div 
      className={`bg-slate-900/90 rounded-xl border p-4 shadow-md transition-all hover:shadow-xl hover:border-slate-600 flex flex-col gap-3 group relative overflow-hidden ${
        isAnswerReceived 
          ? 'border-emerald-500 ring-2 ring-emerald-500/30 bg-gradient-to-b from-slate-900 to-emerald-950/30' 
          : 'border-slate-800'
      }`}
    >
      {/* Highlighted Banner for Recruiter Reply */}
      {isAnswerReceived && (
        <div className="bg-emerald-500 text-slate-950 px-3 py-1 -mx-4 -mt-4 mb-1 font-bold text-xs flex items-center justify-between shadow-sm">
          <span className="flex items-center gap-1.5">
            <MessageSquareReply className="h-3.5 w-3.5" /> RÉPONSE REÇUE DU RECRUTEUR !
          </span>
          {job.answer_classification && (
            <span className="bg-slate-950/20 px-1.5 py-0.5 rounded text-[10px] uppercase">
              {job.answer_classification}
            </span>
          )}
        </div>
      )}

      {/* Top Row: Contract, Source & Match Score */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${getContractColor(job.contract_type)}`}>
            {job.contract_type}
          </span>
          <span className="text-[10px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/60">
            {job.source}
          </span>
        </div>

        {/* Fit Score Badge */}
        <div 
          className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md border ${getScoreColor(job.match_score)}`}
          title={job.match_reasons?.join('\n') || `Score AGY: ${job.match_score}%`}
        >
          <Sparkles className="h-3 w-3" />
          <span>{job.match_score}%</span>
        </div>
      </div>

      {/* Job Title & Company */}
      <div>
        <h3 
          onClick={() => onOpenDetails(job)}
          className="font-bold text-sm text-slate-100 hover:text-emerald-400 cursor-pointer line-clamp-2 transition-colors"
          title={job.title}
        >
          {job.title}
        </h3>
        <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
          <span className="flex items-center gap-1 font-medium text-slate-300 truncate">
            <Building2 className="h-3.5 w-3.5 text-slate-500 shrink-0" />
            {job.company}
          </span>
          <span className="flex items-center gap-1 shrink-0">
            <MapPin className="h-3.5 w-3.5 text-slate-500" />
            {job.location}
          </span>
        </div>
      </div>

      {/* Answer Snippet if answer happened */}
      {isAnswerReceived && job.answer_snippet && (
        <div className="bg-emerald-950/50 border border-emerald-500/30 rounded-lg p-2.5 text-xs text-emerald-200">
          <div className="font-semibold text-emerald-300 text-[11px] mb-1 flex items-center justify-between">
            <span>Message du recruteur :</span>
            {job.answer_at && (
              <span className="text-[10px] text-emerald-400/80">
                {new Date(job.answer_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <p className="line-clamp-2 italic text-slate-300">"{job.answer_snippet}"</p>
        </div>
      )}

      {/* Application Method & Timestamp */}
      {job.applied_at && (
        <div className="text-[11px] text-slate-400 flex items-center justify-between bg-slate-800/40 px-2 py-1 rounded">
          <span className="flex items-center gap-1">
            <Send className="h-3 w-3 text-blue-400" /> Candidaté le :
          </span>
          <span className="font-medium text-slate-300">
            {new Date(job.applied_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
          </span>
        </div>
      )}

      {/* Card Action Buttons */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80 mt-auto text-xs">
        <button
          onClick={() => onOpenDetails(job)}
          className="text-slate-400 hover:text-white flex items-center gap-1 font-medium transition-colors"
        >
          <FileText className="h-3.5 w-3.5" />
          <span>Détails & CV</span>
        </button>

        <div className="flex items-center gap-1">
          {/* Action according to current column */}
          {job.status === 'discovered' && (
            <button
              onClick={() => onTailor(job.id)}
              className="bg-slate-800 hover:bg-slate-700 text-emerald-400 px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 border border-slate-700 active:scale-95"
            >
              <Sparkles className="h-3 w-3" />
              <span>Adapter CV</span>
            </button>
          )}

          {job.status === 'tailored' && (
            <button
              onClick={() => onApply(job.id)}
              className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 px-2.5 py-1 rounded-md font-bold flex items-center gap-1 active:scale-95 shadow-md shadow-emerald-500/20"
            >
              <Send className="h-3 w-3" />
              <span>Postuler</span>
            </button>
          )}

          {isApplied && (
            <button
              onClick={() => onSimulateReply(job.id)}
              className="bg-slate-800 hover:bg-emerald-900/40 text-slate-300 hover:text-emerald-400 px-2 py-1 rounded-md border border-slate-700 text-[10px] flex items-center gap-1"
              title="Tester la détection de réponse (Simulation)"
            >
              <MessageSquareReply className="h-3 w-3" />
              <span>Test Réponse</span>
            </button>
          )}

          {isAnswerReceived && (
            <button
              onClick={() => onMoveStatus(job.id, 'interview')}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-2 py-1 rounded-md font-bold text-[11px] flex items-center gap-1"
            >
              <CheckCircle2 className="h-3 w-3" />
              <span>Entretien !</span>
            </button>
          )}
        </div>
      </div>

    </div>
  );
};
