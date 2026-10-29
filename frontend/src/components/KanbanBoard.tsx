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
  CheckCheck,
  Rocket
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
  { id: 'discovered', title: 'Découvertes', icon: <Inbox className="h-4 w-4" />, color: 'border-pickle-border' },
  { id: 'tailored', title: 'CV Prêts / Validation', icon: <Sparkles className="h-4 w-4 text-pickle-lime" />, color: 'border-pickle-lime/40' },
  { id: 'applied', title: 'Candidaté', icon: <Send className="h-4 w-4 text-blue-400" />, color: 'border-blue-500/40' },
  { id: 'answer_received', title: 'Réponse Reçue !', icon: <MessageSquareReply className="h-4 w-4 text-pickle-lime" />, color: 'border-pickle-lime' },
  { id: 'interview', title: 'Entretiens', icon: <CheckCircle2 className="h-4 w-4 text-purple-400" />, color: 'border-purple-500/40' },
  { id: 'archived', title: 'Archivées', icon: <Archive className="h-4 w-4 text-neutral-600" />, color: 'border-pickle-border' },
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
    <div className="flex flex-col h-[calc(100vh-140px)]">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-pickle-card p-3 rounded-2xl border border-pickle-border shadow-md">
        <div className="flex items-center gap-3 flex-1 min-w-[260px]">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-pickle-subtle" />
            <input
              type="text"
              placeholder="Filtrer par intitulé, entreprise, lieu..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-pickle-dark border border-pickle-border rounded-full pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-pickle-lime"
            />
          </div>

          {/* Contract Filter Pills */}
          <div className="flex items-center gap-1 text-xs">
            {['all', 'Alternance', 'Intérim', 'CDI'].map((c) => (
              <button
                key={c}
                onClick={() => setContractFilter(c)}
                className={`px-3 py-1 rounded-full font-bold transition-all ${
                  contractFilter === c
                    ? 'bg-pickle-lime text-pickle-dark shadow-sm'
                    : 'bg-neutral-900 text-pickle-subtle hover:text-white'
                }`}
              >
                {c === 'all' ? 'Tous' : c}
              </button>
            ))}
          </div>
        </div>

        {/* Score filter slider & Batch Button */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2 text-pickle-subtle">
            <span>Score min: {minScore}%</span>
            <input
              type="range"
              min="0"
              max="90"
              step="10"
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-24 accent-pickle-lime"
            />
          </div>

          {/* Quick Batch Apply Button if tailored jobs ready */}
          {tailoredCount > 0 && (
            <button
              onClick={handleBatchClick}
              disabled={isValidatingBatch}
              className="bg-pickle-lime hover:bg-pickle-limeHover text-pickle-dark font-black px-4 py-1.5 rounded-full text-xs flex items-center gap-1.5 shadow-md shadow-pickle-lime/20 active:scale-95 transition-all"
            >
              <CheckCheck className={`h-4 w-4 ${isValidatingBatch ? 'animate-spin' : ''}`} />
              <span>Valider le lot ({tailoredCount} prêts)</span>
            </button>
          )}
        </div>
      </div>

      {/* Kanban Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 flex-1 overflow-x-auto overflow-y-hidden pb-2">
        {COLUMNS.map((col) => {
          const colJobs = filteredJobs.filter(j => j.status === col.id);
          const isAnswerCol = col.id === 'answer_received';
          const isTailoredCol = col.id === 'tailored';

          return (
            <div
              key={col.id}
              className={`flex flex-col bg-pickle-dark/80 rounded-3xl border ${col.color} p-3.5 min-w-[280px] max-h-full ${
                isAnswerCol ? 'bg-gradient-to-b from-pickle-dark to-pickle-lime/5' : ''
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 border-b border-pickle-border mb-3">
                <div className="flex items-center gap-2 font-black text-xs text-white uppercase tracking-wider font-['Inter_Tight',sans-serif]">
                  {col.icon}
                  <span>{col.title}</span>
                </div>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-black ${
                  isAnswerCol && colJobs.length > 0
                    ? 'bg-pickle-lime text-pickle-dark animate-pulse shadow-md'
                    : 'bg-neutral-900 text-pickle-subtle border border-pickle-border'
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
                    className="w-full bg-pickle-lime/10 hover:bg-pickle-lime text-pickle-lime hover:text-pickle-dark border border-pickle-lime/40 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all active:scale-95"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    <span>Envoyer le Lot ({colJobs.length})</span>
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
                  <div className="h-32 flex flex-col items-center justify-center text-center text-xs text-neutral-600 border border-dashed border-neutral-800 rounded-2xl p-4">
                    <Layers className="h-6 w-6 mb-1 stroke-1 text-neutral-700" />
                    <span>Aucune offre</span>
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
