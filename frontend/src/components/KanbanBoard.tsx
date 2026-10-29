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
import { Language, translations } from '../i18n';

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
  currentLang?: Language;
}

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
  onBatchValidate,
  currentLang = 'fr'
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [contractFilter, setContractFilter] = useState<string>('all');
  const [minScore, setMinScore] = useState<number>(0);
  const [isValidatingBatch, setIsValidatingBatch] = useState(false);

  const t = translations[currentLang];

  const COLUMNS: { id: JobStatus; title: string; icon: React.ReactNode; color: string }[] = [
    { id: 'discovered', title: t.col_discovered, icon: <Inbox className="h-3.5 w-3.5 text-[#71717A]" />, color: 'border-[#D4D4D8]' },
    { id: 'tailored', title: t.col_tailored, icon: <Sparkles className="h-3.5 w-3.5 text-[#5F7A48]" />, color: 'border-[#5F7A48]/50' },
    { id: 'applied', title: t.col_applied, icon: <Send className="h-3.5 w-3.5 text-blue-600" />, color: 'border-blue-300' },
    { id: 'answer_received', title: t.col_answer, icon: <MessageSquareReply className="h-3.5 w-3.5 text-[#5F7A48]" />, color: 'border-[#5F7A48]' },
    { id: 'interview', title: t.col_interview, icon: <CheckCircle2 className="h-3.5 w-3.5 text-purple-600" />, color: 'border-purple-300' },
    { id: 'archived', title: t.col_archived, icon: <Archive className="h-3.5 w-3.5 text-[#A1A1AA]" />, color: 'border-[#E4E4E7]' },
  ];

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
    <div className="flex flex-col h-[calc(100vh-140px)] w-full font-mono">
      {/* Search & Filter Toolbar (Pickles.app clean style, No horizontal scroll) */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 bg-[#FFFFFF] p-2.5 border border-[#D4D4D8] shadow-xs shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-[220px]">
          <div className="relative flex-1">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#71717A]" />
            <input
              type="text"
              placeholder={t.filter_placeholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#FAF9F6] border border-[#D4D4D8] pl-8 pr-2.5 py-1 text-xs text-[#18181B] focus:outline-none focus:border-[#5F7A48]"
            />
          </div>

          {/* Contract Filter Buttons (Sharp) */}
          <div className="flex items-center gap-1 text-xs">
            {['all', 'Alternance', 'Intérim', 'CDI'].map((c) => (
              <button
                key={c}
                onClick={() => setContractFilter(c)}
                className={`px-2 py-0.5 text-[10.5px] font-bold transition-all border ${
                  contractFilter === c
                    ? 'bg-[#18181B] text-[#FFFFFF] border-[#18181B]'
                    : 'bg-[#FAF9F6] text-[#71717A] border-[#D4D4D8] hover:text-[#18181B]'
                }`}
              >
                {c === 'all' ? t.all_contracts : c.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Score filter slider & Batch Button */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-[#71717A] text-[11px]">
            <span>{t.score_min} {minScore}%</span>
            <input
              type="range"
              min="0"
              max="90"
              step="10"
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-20 accent-[#5F7A48]"
            />
          </div>

          {/* Quick Batch Apply Button if tailored jobs ready */}
          {tailoredCount > 0 && (
            <button
              onClick={handleBatchClick}
              disabled={isValidatingBatch}
              className="bg-[#5F7A48] hover:bg-[#4E653A] text-white font-black px-3 py-1 text-[11px] flex items-center gap-1 border border-[#5F7A48] transition-all"
            >
              <CheckCheck className={`h-3.5 w-3.5 ${isValidatingBatch ? 'animate-spin' : ''}`} />
              <span>{t.batch_validate_btn} ({tailoredCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Kanban Columns: Fluid 6-column grid on desktop WITHOUT horizontal scrolling */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 flex-1 min-h-0 w-full overflow-hidden">
        {COLUMNS.map((col) => {
          const colJobs = filteredJobs.filter(j => j.status === col.id);
          const isAnswerCol = col.id === 'answer_received';
          const isTailoredCol = col.id === 'tailored';

          return (
            <div
              key={col.id}
              className={`flex flex-col bg-[#FFFFFF] border ${col.color} p-2 min-w-0 h-full overflow-hidden shadow-2xs ${
                isAnswerCol ? 'bg-[#FCFDFB]' : ''
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-1.5 border-b border-[#E4E4E7] mb-2 shrink-0">
                <div className="flex items-center gap-1 font-bold text-[11px] text-[#18181B] uppercase tracking-tight truncate">
                  {col.icon}
                  <span className="truncate">{col.title}</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.1 font-mono font-bold border shrink-0 ${
                  isAnswerCol && colJobs.length > 0
                    ? 'bg-[#5F7A48] text-white border-[#5F7A48]'
                    : 'bg-[#F4F4F0] text-[#71717A] border-[#D4D4D8]'
                }`}>
                  {colJobs.length}
                </span>
              </div>

              {/* Special Batch Action Button inside 'tailored' column header */}
              {isTailoredCol && colJobs.length > 0 && (
                <div className="mb-2 shrink-0">
                  <button
                    onClick={handleBatchClick}
                    disabled={isValidatingBatch}
                    className="w-full bg-[#EEF3E9] hover:bg-[#5F7A48] text-[#5F7A48] hover:text-white border border-[#C8DAC0] py-1 text-[10.5px] font-black flex items-center justify-center gap-1 transition-all"
                  >
                    <CheckCheck className="h-3 w-3" />
                    <span>{t.batch_validate_btn} ({colJobs.length})</span>
                  </button>
                </div>
              )}

              {/* Cards Scroll Container (Vertical scroll ONLY, zero horizontal scroll) */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 scrollbar-thin">
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
                      currentLang={currentLang}
                    />
                  ))
                ) : (
                  <div className="h-28 flex flex-col items-center justify-center text-center text-[10.5px] text-[#A1A1AA] border border-dashed border-[#E4E4E7] p-2 font-mono">
                    <Layers className="h-5 w-5 mb-1 stroke-1 text-[#D4D4D8]" />
                    <span>{t.empty_column}</span>
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
