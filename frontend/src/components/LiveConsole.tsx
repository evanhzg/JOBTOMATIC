import React, { useState } from 'react';
import { ActivityLog } from '../types';
import { Terminal, RefreshCw, CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react';

interface LiveConsoleProps {
  logs: ActivityLog[];
  onRefresh: () => void;
  isLoading: boolean;
}

export const LiveConsole: React.FC<LiveConsoleProps> = ({
  logs,
  onRefresh,
  isLoading
}) => {
  const [filterLevel, setFilterLevel] = useState<string>('ALL');

  const filteredLogs = logs.filter(log => {
    if (filterLevel === 'ALL') return true;
    return log.level === filterLevel;
  });

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'SUCCESS':
        return <span className="text-[#5F7A48] bg-[#EEF3E9] px-1.5 py-0.1 text-[9.5px] font-bold border border-[#C8DAC0] flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> SUCCESS</span>;
      case 'WARNING':
        return <span className="text-[#B45309] bg-[#FEF3C7] px-1.5 py-0.1 text-[9.5px] font-bold border border-[#FDE68A] flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> WARNING</span>;
      case 'ERROR':
        return <span className="text-red-700 bg-red-50 px-1.5 py-0.1 text-[9.5px] font-bold border border-red-200 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> ERROR</span>;
      default:
        return <span className="text-blue-700 bg-blue-50 px-1.5 py-0.1 text-[9.5px] font-bold border border-blue-200 flex items-center gap-1"><Info className="h-3 w-3" /> INFO</span>;
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-5 space-y-5 font-mono">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D4D4D8] pb-3 bg-white p-4 shadow-xs">
        <div>
          <h2 className="text-base font-black text-[#18181B] flex items-center gap-2 uppercase tracking-wider">
            <Terminal className="h-4 w-4 text-[#5F7A48]" />
            CONSOLE D'ACTIVITÉ & MONITEUR IA
          </h2>
          <p className="text-xs text-[#71717A] mt-0.5">
            Suivi temps réel des actions du moteur : scraping, scoring IA, adaptation de CV, envois Gmail et détection de réponses.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Severity filter (Sharp) */}
          <div className="flex items-center bg-[#FAF9F6] border border-[#D4D4D8] p-0.5 text-xs">
            {['ALL', 'SUCCESS', 'INFO', 'WARNING', 'ERROR'].map(lvl => (
              <button
                key={lvl}
                onClick={() => setFilterLevel(lvl)}
                className={`px-2 py-0.5 text-[10px] font-bold transition-all border ${
                  filterLevel === lvl
                    ? 'bg-[#18181B] text-white border-[#18181B]'
                    : 'bg-transparent text-[#71717A] border-transparent hover:text-[#18181B]'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1 bg-[#FAF9F6] hover:bg-[#F2F2EC] text-[#71717A] hover:text-[#18181B] border border-[#D4D4D8]"
            title="Rafraîchir"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Terminal View (Sharp boxy brutalist, dark interior for contrast) */}
      <div className="bg-[#18181B] border border-[#27272A] p-4 font-mono text-xs shadow-md">
        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#27272A] text-[#A1A1AA] text-[10.5px]">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 bg-[#5F7A48] animate-pulse" />
            jobtomatic-daemon@host:~#
          </span>
          <span>{filteredLogs.length} événements enregistrés</span>
        </div>

        <div className="space-y-1 max-h-[580px] overflow-y-auto pr-1 scrollbar-thin">
          {filteredLogs.length > 0 ? (
            filteredLogs.map(log => (
              <div
                key={log.id}
                className="flex items-start gap-2.5 p-1.5 hover:bg-[#27272A] transition-colors border-b border-[#202022]"
              >
                <span className="text-[#71717A] text-[10.5px] shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className="shrink-0">{getLevelBadge(log.level)}</span>
                <span className="text-[#E4E4E7] flex-1 leading-relaxed text-[11px]">
                  {log.message}
                </span>
              </div>
            ))
          ) : (
            <div className="py-10 text-center text-[#71717A]">
              Aucun journal correspondant pour le filtre actuel.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
