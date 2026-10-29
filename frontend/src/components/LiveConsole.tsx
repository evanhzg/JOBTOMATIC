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
        return <span className="text-[#C5EA4B] bg-[#182610] px-1.5 py-0.2 text-[10px] font-bold border border-[#C5EA4B] flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> SUCCESS</span>;
      case 'WARNING':
        return <span className="text-[#FA5F11] bg-[#2A1810] px-1.5 py-0.2 text-[10px] font-bold border border-[#FA5F11] flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> WARNING</span>;
      case 'ERROR':
        return <span className="text-red-400 bg-red-950/60 px-1.5 py-0.2 text-[10px] font-bold border border-red-800 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> ERROR</span>;
      default:
        return <span className="text-blue-400 bg-blue-950/60 px-1.5 py-0.2 text-[10px] font-bold border border-blue-800 flex items-center gap-1"><Info className="h-3 w-3" /> INFO</span>;
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-6 space-y-6 font-mono">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#242424] pb-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2 uppercase tracking-wider">
            <Terminal className="h-5 w-5 text-[#C5EA4B]" />
            CONSOLE D'ACTIVITÉ & MONITEUR IA
          </h2>
          <p className="text-xs text-[#8E8E8E] mt-1">
            Suivi temps réel des actions du moteur : scraping, scoring IA, adaptation de CV, envois Gmail et détection de réponses.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Severity filter (Sharp) */}
          <div className="flex items-center bg-[#141414] border border-[#242424] p-0.5 text-xs">
            {['ALL', 'SUCCESS', 'INFO', 'WARNING', 'ERROR'].map(lvl => (
              <button
                key={lvl}
                onClick={() => setFilterLevel(lvl)}
                className={`px-2 py-1 text-[10px] font-bold transition-all border ${
                  filterLevel === lvl
                    ? 'bg-[#C5EA4B] text-black border-[#C5EA4B]'
                    : 'bg-transparent text-[#8E8E8E] border-transparent hover:text-white'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1.5 bg-[#141414] hover:bg-[#202020] text-[#8E8E8E] hover:text-white border border-[#242424]"
            title="Rafraîchir"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Terminal View (Sharp boxy brutalist) */}
      <div className="bg-[#0C0C0C] border border-[#242424] p-4 font-mono text-xs shadow-2xl">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#1E1E1E] text-[#666666] text-[11px]">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 bg-[#C5EA4B] animate-pulse" />
            jobtomatic-daemon@host:~#
          </span>
          <span>{filteredLogs.length} événements enregistrés</span>
        </div>

        <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-neutral-800">
          {filteredLogs.length > 0 ? (
            filteredLogs.map(log => (
              <div
                key={log.id}
                className="flex items-start gap-3 p-2 hover:bg-[#141414] transition-colors border-b border-[#181818]"
              >
                <span className="text-[#666666] text-[11px] shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className="shrink-0">{getLevelBadge(log.level)}</span>
                <span className="text-[#CCCCCC] flex-1 leading-relaxed">
                  {log.message}
                </span>
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-[#555555]">
              Aucun journal correspondant pour le filtre actuel.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
