import React, { useState } from 'react';
import { 
  Job, 
  JobStatus 
} from '../types';
import { JobCard } from './JobCard';
import { 
  Search, 
  Sparkles, 
  Send, 
  MessageSquareReply, 
  CheckCircle2, 
  Archive, 
  Inbox, 
  Layers,
  CheckCheck
} from 'lucide-react';

interface KanbanBoardProps {
  jobs: Job[];
  waitBatchValidation: boolean;
  onOpenDetails: (job: Job) => void;
  onPreviewCV: (job: Job) => void;
  onImproveCV: (job: Job) => void;
  onApply: (jobId: number) => void;
  onTailor: (jobId: number) => void;
  onSimulateReply: (jobId: number) => void;
  onMoveStatus: (jobId: number, newStatus: JobStatus) => void;
  onBatchValidate: () => Promise<void>;
}

const COLUMNS: { id: JobStatus; title: string; icon: React.ReactNode; color: string }[] = [
  { id: 'discovered', title: 'Découvertes', icon: <Inbox className="h-4 w-4" />, color: 'border-[#242424]' },
  { id: 'tailored', title: 'CV Prêts / Validation', icon: <Sparkles className="h-4 w-4 text-[#C5EA4B]" />, color: 'border-[#C5EA4B]/40' },
  { id: 'applied', title: 'Candidaté', icon: <Send className="h-4 w-4 text-blue-400" />, color: 'border-blue-500/40' },
  { id: 'answer_received', title: 'Réponse Reçue !', icon: <MessageSquareReply className="h-4 w-4 text-[#C5EA4B]" />, color: 'border-[#C5EA4B]' },
  { id: 'interview', title: 'Entretiens', icon: <CheckCircle2 className="h-4 w-4 text-purple-400" />, color: 'border-purple-500/40' },
  { id: 'archived', title: 'Archivées', icon: <Archive className="h-4 w-4 text-[#555555]" />, color: 'border-[#242424]' },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  jobs,
  waitBatchValidation,
  onOpenDetails,
  onPreviewCV,
  onImproveCV,
  onApply,
  onTailor,
  onSimulateReply,
  onMoveStatus,
  onBatchValidate
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [contractFilter, setContractFilter] = useState<string>('all');
  const [minScore, setMinScore] = useState<number>(0);
  const [isValidatingBatch, setIsValidatingBatch] = useState(false);

  // Filter jobs
  const filteredJobs = jobs.filter(job => {
    const matchesSearch = 
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.location.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesContract = 
      contractFilter === 'all' || 
      job.contract_type.toLowerCase().includes(contractFilter.toLowerCase());

    const matchesScore = job.match_score >= minScore;

    return matchesSearch && matchesContract && matchesScore;
  });

  const tailoredCount = filteredJobs.filter(j => j.status === 'tailored').length;

  const handleBatchClick = async () => {
    setIsValidatingBatch(true);
    try {
      await onBatchValidate();
    } finally {
      setIsValidatingBatch(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] font-mono">
      {/* Search & Filter Toolbar (Not Rounded, Boxy Brutalist) */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-[#141414] p-3 border border-[#242424]">
        <div className="flex items-center gap-3 flex-1 min-w-[260px]">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8E8E]" />
            <input
              type="text"
              placeholder="Filtrer par intitulé, entreprise, lieu..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0C0C0C] border border-[#282828] pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#C5EA4B]"
            />
          </div>

          {/* Contract Filter Buttons (Sharp) */}
          <div className="flex items-center gap-1 text-xs">
            {['all', 'Alternance', 'Intérim', 'CDI'].map((c) => (
              <button
                key={c}
                onClick={() => setContractFilter(c)}
                className={`px-2.5 py-1 text-[11px] font-bold transition-all border ${
                  contractFilter === c
                    ? 'bg-[#C5EA4B] text-[#0C0C0C] border-[#C5EA4B]'
                    : 'bg-[#0C0C0C] text-[#8E8E8E] border-[#262626] hover:text-white'
                }`}
              >
                {c === 'all' ? 'TOUS' : c.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Score filter slider & Batch Button */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2 text-[#8E8E8E]">
            <span>SCORE MIN: {minScore}%</span>
            <input
              type="range"
              min="0"
              max="90"
              step="10"
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-24 accent-[#C5EA4B]"
            />
          </div>

          {/* Quick Batch Apply Button if tailored jobs ready */}
          {tailoredCount > 0 && (
            <button
              onClick={handleBatchClick}
              disabled={isValidatingBatch}
              className="bg-[#C5EA4B] hover:bg-[#d6f859] text-black font-black px-3.5 py-1.5 text-xs flex items-center gap-1.5 border border-[#C5EA4B] transition-all"
            >
              <CheckCheck className={`h-4 w-4 ${isValidatingBatch ? 'animate-spin' : ''}`} />
              <span>VALIDER LE LOT ({tailoredCount} PRÊTS)</span>
            </button>
          )}
        </div>
      </div>

      {/* Kanban Columns Grid (Sharp Unrounded Borders) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3.5 flex-1 overflow-x-auto overflow-y-hidden pb-2">
        {COLUMNS.map((col) => {
          const colJobs = filteredJobs.filter(j => j.status === col.id);
          const isAnswerCol = col.id === 'answer_received';
          const isTailoredCol = col.id === 'tailored';

          return (
            <div
              key={col.id}
              className={`flex flex-col bg-[#0F0F0F] border ${col.color} p-3 min-w-[280px] max-h-full ${
                isAnswerCol ? 'bg-[#12160F]' : ''
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2.5 border-b border-[#242424] mb-3">
                <div className="flex items-center gap-1.5 font-bold text-xs text-white uppercase tracking-wider font-mono">
                  {col.icon}
                  <span>{col.title}</span>
                </div>
                <span className={`text-[11px] px-2 py-0.2 font-mono font-bold border ${
                  isAnswerCol && colJobs.length > 0
                    ? 'bg-[#C5EA4B] text-black border-[#C5EA4B] animate-pulse'
                    : 'bg-[#141414] text-[#8E8E8E] border-[#242424]'
                }`}>
                  {colJobs.length}
                </span>
              </div>

              {/* Special Batch Action Button inside 'tailored' column header */}
              {isTailoredCol && colJobs.length > 0 && (
                <div className="mb-3">
                  <button
                    onClick={handleBatchClick}
                    disabled={isValidatingBatch}
                    className="w-full bg-[#182610] hover:bg-[#C5EA4B] text-[#C5EA4B] hover:text-black border border-[#C5EA4B]/50 py-1.5 text-xs font-black flex items-center justify-center gap-1.5 transition-all"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    <span>ENVOYER LE LOT ({colJobs.length})</span>
                  </button>
                </div>
              )}

              {/* Cards Scroll Container */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-neutral-800">
                {colJobs.length > 0 ? (
                  colJobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      onOpenDetails={onOpenDetails}
                      onPreviewCV={onPreviewCV}
                      onImproveCV={onImproveCV}
                      onApply={onApply}
                      onTailor={onTailor}
                      onSimulateReply={onSimulateReply}
                      onMoveStatus={onMoveStatus}
                    />
                  ))
                ) : (
                  <div className="h-32 flex flex-col items-center justify-center text-center text-xs text-[#555555] border border-dashed border-[#242424] p-4 font-mono">
                    <Layers className="h-6 w-6 mb-1 stroke-1 text-[#444444]" />
                    <span>AUCUNE OFFRE</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
