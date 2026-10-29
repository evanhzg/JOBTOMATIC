import React from 'react';
import { 
  Bot, 
  Pause, 
  Play, 
  Power, 
  LayoutDashboard, 
  Search, 
  UserCircle, 
  Settings, 
  Terminal, 
  CheckCircle2, 
  MessageSquareReply, 
  Sparkles,
  Send
} from 'lucide-react';
import { SystemStats } from '../types';

interface ControlBarProps {
  stats: SystemStats | null;
  activeTab: 'kanban' | 'search' | 'profile' | 'settings' | 'console';
  setActiveTab: (tab: 'kanban' | 'search' | 'profile' | 'settings' | 'console') => void;
  onToggleAutopilot: () => void;
  onTogglePause: () => void;
  isLoading: boolean;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  stats,
  activeTab,
  setActiveTab,
  onToggleAutopilot,
  onTogglePause,
  isLoading
}) => {
  const isAuto = stats?.autopilot_enabled ?? false;
  const isPaused = stats?.is_paused ?? false;

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 shadow-xl">
      {/* Top Bar: Brand, Global Automation Controls, Stats */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* Logo & Status Indicator */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Bot className="h-6 w-6 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                  JobHunter <span className="text-emerald-400 font-extrabold">AGY</span>
                </h1>
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="h-2.5 w-2.5" /> Antigravity Sub
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Chasseur d'emploi & candidatures en pilote automatique
              </p>
            </div>
          </div>

          {/* Quick Stats KPI Badges */}
          <div className="flex items-center flex-wrap gap-2 text-xs">
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <span className="text-slate-400">Offres:</span>
              <span className="font-bold text-white text-sm">{stats?.total_jobs ?? 0}</span>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/60 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <Send className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-slate-400">Candidatures:</span>
              <span className="font-bold text-blue-400 text-sm">{stats?.applied ?? 0}</span>
            </div>

            {/* Glowing Answer Received KPI */}
            <div className={`rounded-lg px-3 py-1.5 flex items-center gap-2 border transition-all ${
              (stats?.answer_received ?? 0) > 0 
                ? 'bg-emerald-950/80 border-emerald-500/50 shadow-lg shadow-emerald-500/10 animate-pulse' 
                : 'bg-slate-800/80 border-slate-700/60'
            }`}>
              <MessageSquareReply className={`h-4 w-4 ${(stats?.answer_received ?? 0) > 0 ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span className={(stats?.answer_received ?? 0) > 0 ? 'text-emerald-300 font-medium' : 'text-slate-400'}>
                Réponses Reçues:
              </span>
              <span className={`font-extrabold text-sm ${(stats?.answer_received ?? 0) > 0 ? 'text-emerald-300' : 'text-slate-300'}`}>
                {stats?.answer_received ?? 0}
              </span>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/60 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <span className="text-slate-400">Quota:</span>
              <span className="font-semibold text-amber-400">
                {stats?.applications_today ?? 0} / {stats?.daily_limit ?? 20}
              </span>
            </div>
          </div>

          {/* Master Controls: Autopilot Toggle & Pause Button */}
          <div className="flex items-center gap-2">
            {/* Master Toggle */}
            <button
              onClick={onToggleAutopilot}
              disabled={isLoading}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 ${
                isAuto
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
              title={isAuto ? "Désactiver le pilote automatique" : "Activer le pilote automatique"}
            >
              <Power className={`h-4 w-4 ${isAuto ? 'animate-spin-slow' : ''}`} />
              <span>{isAuto ? 'AUTOPILOT ACTIF' : 'AUTOPILOT INACTIF'}</span>
              <span className={`h-2 w-2 rounded-full ${isAuto ? 'bg-slate-950' : 'bg-slate-500'}`} />
            </button>

            {/* Instant Pause Button */}
            <button
              onClick={onTogglePause}
              disabled={isLoading}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 border ${
                isPaused
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md shadow-amber-500/20 animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
              title={isPaused ? "Reprendre les activités" : "Mettre en pause immédiatement"}
            >
              {isPaused ? <Play className="h-4 w-4 text-amber-400 fill-amber-400" /> : <Pause className="h-4 w-4" />}
              <span>{isPaused ? 'EN PAUSE' : 'PAUSE'}</span>
            </button>
          </div>

        </div>

        {/* Tab Navigation Menu */}
        <nav className="flex items-center gap-1 mt-4 overflow-x-auto border-t border-slate-800/80 pt-2 scrollbar-none">
          <button
            onClick={() => setActiveTab('kanban')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
              activeTab === 'kanban'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Tableau Kanban</span>
          </button>

          <button
            onClick={() => setActiveTab('search')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
              activeTab === 'search'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Search className="h-4 w-4" />
            <span>Recherche & Cibles (Rouen...)</span>
            {stats && stats.active_queries > 0 && (
              <span className="bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded-full text-[10px]">
                {stats.active_queries}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
              activeTab === 'profile'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <UserCircle className="h-4 w-4" />
            <span>Mon Profil & CV Maître</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
              activeTab === 'settings'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Settings className="h-4 w-4" />
            <span>Paramètres & Gmail</span>
          </button>

          <button
            onClick={() => setActiveTab('console')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
              activeTab === 'console'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Terminal className="h-4 w-4" />
            <span>Logs & Moniteur AGY</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
