import React, { useState } from 'react';
import { 
  Job, 
  JobStatus 
} from '../types';
import { JobCard } from './JobCard';
import { 
  Search, 
  Filter, 
  Sparkles, 
  Send, 
  MessageSquareReply, 
  CheckCircle2, 
  Archive, 
  Inbox, 
  Layers
} from 'lucide-react';

interface KanbanBoardProps {
  jobs: Job[];
  onOpenDetails: (job: Job) => void;
  onApply: (jobId: number) => void;
  onTailor: (jobId: number) => void;
  onSimulateReply: (jobId: number) => void;
  onMoveStatus: (jobId: number, newStatus: JobStatus) => void;
}

const COLUMNS: { id: JobStatus; title: string; icon: React.ReactNode; color: string }[] = [
  { id: 'discovered', title: 'Découvertes', icon: <Inbox className="h-4 w-4" />, color: 'border-slate-700' },
  { id: 'tailored', title: 'CV Personnalisé', icon: <Sparkles className="h-4 w-4 text-emerald-400" />, color: 'border-emerald-500/40' },
  { id: 'applied', title: 'Candidaté', icon: <Send className="h-4 w-4 text-blue-400" />, color: 'border-blue-500/40' },
  { id: 'answer_received', title: 'Réponse Reçue !', icon: <MessageSquareReply className="h-4 w-4 text-emerald-400" />, color: 'border-emerald-500' },
  { id: 'interview', title: 'Entretiens', icon: <CheckCircle2 className="h-4 w-4 text-purple-400" />, color: 'border-purple-500/40' },
  { id: 'archived', title: 'Archivées', icon: <Archive className="h-4 w-4 text-slate-500" />, color: 'border-slate-800' },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  jobs,
  onOpenDetails,
  onApply,
  onTailor,
  onSimulateReply,
  onMoveStatus
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [contractFilter, setContractFilter] = useState<string>('all');
  const [minScore, setMinScore] = useState<number>(0);

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

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center gap-3 flex-1 min-w-[260px]">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filtrer par intitulé, entreprise, lieu..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Contract Filter */}
          <div className="flex items-center gap-1 text-xs">
            {['all', 'Alternance', 'Intérim', 'CDI'].map((c) => (
              <button
                key={c}
                onClick={() => setContractFilter(c)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  contractFilter === c
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {c === 'all' ? 'Tous' : c}
              </button>
            ))}
          </div>
        </div>

        {/* Score threshold slider */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Score min: {minScore}%</span>
          <input
            type="range"
            min="0"
            max="90"
            step="10"
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="w-24 accent-emerald-500"
          />
        </div>
      </div>

      {/* Kanban Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 flex-1 overflow-x-auto overflow-y-hidden pb-2">
        {COLUMNS.map((col) => {
          const colJobs = filteredJobs.filter(j => j.status === col.id);
          const isAnswerCol = col.id === 'answer_received';

          return (
            <div
              key={col.id}
              className={`flex flex-col bg-slate-950/70 rounded-2xl border ${col.color} p-3 min-w-[280px] max-h-full ${
                isAnswerCol ? 'bg-gradient-to-b from-slate-950 to-emerald-950/20' : ''
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
                <div className="flex items-center gap-2 font-bold text-xs text-slate-200">
                  {col.icon}
                  <span>{col.title}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  isAnswerCol && colJobs.length > 0
                    ? 'bg-emerald-500 text-slate-950 animate-pulse'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {colJobs.length}
                </span>
              </div>

              {/* Cards Scroll Container */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
                {colJobs.length > 0 ? (
                  colJobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      onOpenDetails={onOpenDetails}
                      onApply={onApply}
                      onTailor={onTailor}
                      onSimulateReply={onSimulateReply}
                      onMoveStatus={onMoveStatus}
                    />
                  ))
                ) : (
                  <div className="h-32 flex flex-col items-center justify-center text-center text-xs text-slate-600 border border-dashed border-slate-800/80 rounded-xl p-4">
                    <Layers className="h-6 w-6 mb-1 stroke-1 text-slate-700" />
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
