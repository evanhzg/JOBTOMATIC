import React, { useState } from 'react';
import { ActivityLog } from '../types';
import { Terminal, RefreshCw, Filter, CheckCircle2, AlertTriangle, AlertCircle, Info, Sparkles } from 'lucide-react';

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
        return <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-500/30 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> SUCCESS</span>;
      case 'WARNING':
        return <span className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded text-[10px] font-bold border border-amber-500/30 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> WARNING</span>;
      case 'ERROR':
        return <span className="text-red-400 bg-red-500/10 px-2 py-0.5 rounded text-[10px] font-bold border border-red-500/30 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> ERROR</span>;
      default:
        return <span className="text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-500/30 flex items-center gap-1"><Info className="h-3 w-3" /> INFO</span>;
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Terminal className="h-5 w-5 text-emerald-400" />
            Console d'Activité & Moniteur IA Antigravity
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Suivi en direct des actions du moteur : scraping, scoring Gemini, adaptation de CV, envois de candidatures et surveillance des réponses.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Severity filter */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs">
            {['ALL', 'SUCCESS', 'INFO', 'WARNING', 'ERROR'].map(lvl => (
              <button
                key={lvl}
                onClick={() => setFilterLevel(lvl)}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  filterLevel === lvl
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800"
            title="Rafraîchir"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Terminal View */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 font-mono text-xs shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-900 text-slate-500 text-[11px]">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            antigravity-agent@jobhunter-worker:~#
          </span>
          <span>{filteredLogs.length} événements enregistrés</span>
        </div>

        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-800">
          {filteredLogs.length > 0 ? (
            filteredLogs.map(log => (
              <div
                key={log.id}
                className="flex items-start gap-3 p-2 rounded hover:bg-slate-900/60 transition-colors border-b border-slate-900/50"
              >
                <span className="text-slate-500 text-[11px] shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className="shrink-0">{getLevelBadge(log.level)}</span>
                <span className="text-slate-200 flex-1 leading-relaxed">
                  {log.message}
                </span>
                {log.job_id && (
                  <span className="text-slate-500 text-[10px] shrink-0 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                    job #{log.job_id}
                  </span>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-slate-600">
              Aucun événement ne correspond à ce filtre.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
