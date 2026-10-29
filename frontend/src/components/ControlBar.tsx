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
  MessageSquareReply, 
  Sparkles,
  Send,
  Layers,
  Cpu,
  CheckCheck
} from 'lucide-react';
import { SystemStats } from '../types';

interface ControlBarProps {
  stats: SystemStats | null;
  activeTab: 'kanban' | 'search' | 'profile' | 'settings' | 'console';
  setActiveTab: (tab: 'kanban' | 'search' | 'profile' | 'settings' | 'console') => void;
  onToggleAutopilot: () => void;
  onTogglePause: () => void;
  onToggleBatchValidation: () => void;
  onSelectProvider: (provider: 'agy' | 'claude' | 'codex') => void;
  isLoading: boolean;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  stats,
  activeTab,
  setActiveTab,
  onToggleAutopilot,
  onTogglePause,
  onToggleBatchValidation,
  onSelectProvider,
  isLoading
}) => {
  const isAuto = stats?.autopilot_enabled ?? false;
  const isPaused = stats?.is_paused ?? false;
  const isBatchValidation = stats?.wait_for_batch_validation ?? false;
  const activeProvider = stats?.ai_provider || 'agy';

  return (
    <header className="bg-pickle-dark/95 border-b border-pickle-border sticky top-0 z-40 backdrop-blur-md shadow-2xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          
          {/* Logo & Pickles.team Brand Ethos */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-pickle-lime flex items-center justify-center shadow-lg shadow-pickle-lime/20 text-slate-950 text-xl font-black">
              🥒
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-1.5 font-['Inter_Tight',sans-serif]">
                  JobHunter <span className="text-pickle-lime font-black">Pickles</span>
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-widest bg-pickle-lime/10 text-pickle-lime border border-pickle-lime/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="h-2.5 w-2.5" /> AI Autopilot
                </span>
              </div>
              <p className="text-xs text-pickle-subtle">
                Style Pickles.team — Chasseur d'emploi & CV sur-mesure
              </p>
            </div>
          </div>

          {/* AI Engine Selector (AGY, Claude, Codex) */}
          <div className="flex items-center bg-pickle-card border border-pickle-border rounded-full p-1 gap-1 self-start lg:self-auto">
            <span className="text-[10px] uppercase font-bold text-pickle-subtle px-2.5 flex items-center gap-1">
              <Cpu className="h-3 w-3 text-pickle-lime" /> Moteur :
            </span>

            <button
              onClick={() => onSelectProvider('agy')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                activeProvider === 'agy'
                  ? 'bg-pickle-lime text-pickle-dark shadow-sm'
                  : 'text-pickle-subtle hover:text-white'
              }`}
              title="Google Antigravity (Gemini 3.8 Flash via abonnement agy)"
            >
              🥒 AGY
            </button>

            <button
              onClick={() => onSelectProvider('claude')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                activeProvider === 'claude'
                  ? 'bg-purple-500 text-white shadow-sm'
                  : 'text-pickle-subtle hover:text-white'
              }`}
              title="Anthropic Claude Code"
            >
              🟣 Claude
            </button>

            <button
              onClick={() => onSelectProvider('codex')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                activeProvider === 'codex'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-pickle-subtle hover:text-white'
              }`}
              title="OpenAI Codex CLI"
            >
              🟢 Codex
            </button>
          </div>

          {/* Master Controls: Batch Validation, Autopilot Toggle & Pause Button */}
          <div className="flex items-center flex-wrap gap-2">
            
            {/* Batch Validation Toggle */}
            <button
              onClick={onToggleBatchValidation}
              disabled={isLoading}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold transition-all border ${
                isBatchValidation
                  ? 'bg-pickle-card text-pickle-lime border-pickle-lime/50 shadow-sm'
                  : 'bg-pickle-card text-pickle-subtle border-pickle-border hover:border-neutral-700'
              }`}
              title="Si activé, le moteur prépare les candidatures et attend votre validation par lot avant l'envoi"
            >
              <CheckCheck className={`h-3.5 w-3.5 ${isBatchValidation ? 'text-pickle-lime' : 'text-neutral-500'}`} />
              <span>Validation par lot :</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-extrabold ${isBatchValidation ? 'bg-pickle-lime/20 text-pickle-lime' : 'bg-neutral-800 text-neutral-400'}`}>
                {isBatchValidation ? 'OUI' : 'NON'}
              </span>
            </button>

            {/* Master Toggle */}
            <button
              onClick={onToggleAutopilot}
              disabled={isLoading}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black transition-all shadow-md active:scale-95 ${
                isAuto
                  ? 'bg-pickle-lime hover:bg-pickle-limeHover text-pickle-dark shadow-pickle-lime/20'
                  : 'bg-pickle-card hover:bg-pickle-cardHover text-slate-300 border border-pickle-border'
              }`}
              title={isAuto ? "Désactiver le pilote automatique" : "Activer le pilote automatique"}
            >
              <Power className="h-3.5 w-3.5" />
              <span>{isAuto ? 'AUTOPILOT ACTIF' : 'AUTOPILOT OFF'}</span>
              <span className={`h-2 w-2 rounded-full ${isAuto ? 'bg-pickle-dark animate-ping' : 'bg-neutral-600'}`} />
            </button>

            {/* Pause Button */}
            <button
              onClick={onTogglePause}
              disabled={isLoading}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold transition-all active:scale-95 border ${
                isPaused
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md animate-pulse'
                  : 'bg-pickle-card hover:bg-pickle-cardHover text-slate-300 border-pickle-border'
              }`}
              title={isPaused ? "Reprendre les activités" : "Mettre en pause immédiatement"}
            >
              {isPaused ? <Play className="h-3.5 w-3.5 text-amber-400 fill-amber-400" /> : <Pause className="h-3.5 w-3.5" />}
              <span>{isPaused ? 'EN PAUSE' : 'PAUSE'}</span>
            </button>
          </div>

        </div>

        {/* Tab Navigation Menu & KPI Pills */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 border-t border-pickle-border pt-3">
          <nav className="flex items-center gap-1 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveTab('kanban')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors shrink-0 ${
                activeTab === 'kanban'
                  ? 'bg-pickle-lime text-pickle-dark'
                  : 'text-pickle-subtle hover:text-white hover:bg-pickle-card'
              }`}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span>Tableau Kanban</span>
            </button>

            <button
              onClick={() => setActiveTab('search')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors shrink-0 ${
                activeTab === 'search'
                  ? 'bg-pickle-lime text-pickle-dark'
                  : 'text-pickle-subtle hover:text-white hover:bg-pickle-card'
              }`}
            >
              <Search className="h-3.5 w-3.5" />
              <span>Cibles & Métiers (Rouen...)</span>
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors shrink-0 ${
                activeTab === 'profile'
                  ? 'bg-pickle-lime text-pickle-dark'
                  : 'text-pickle-subtle hover:text-white hover:bg-pickle-card'
              }`}
            >
              <UserCircle className="h-3.5 w-3.5" />
              <span>CV Maître & Aperçu</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors shrink-0 ${
                activeTab === 'settings'
                  ? 'bg-pickle-lime text-pickle-dark'
                  : 'text-pickle-subtle hover:text-white hover:bg-pickle-card'
              }`}
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Paramètres & Gmail</span>
            </button>

            <button
              onClick={() => setActiveTab('console')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors shrink-0 ${
                activeTab === 'console'
                  ? 'bg-pickle-lime text-pickle-dark'
                  : 'text-pickle-subtle hover:text-white hover:bg-pickle-card'
              }`}
            >
              <Terminal className="h-3.5 w-3.5" />
              <span>Moniteur & Logs</span>
            </button>
          </nav>

          {/* Quick Counter Chips */}
          <div className="flex items-center gap-2 text-xs overflow-x-auto scrollbar-none">
            <span className="bg-pickle-card border border-pickle-border rounded-full px-3 py-1 text-pickle-subtle flex items-center gap-1.5 text-[11px]">
              Offres: <strong className="text-white font-bold">{stats?.total_jobs ?? 0}</strong>
            </span>

            <span className="bg-pickle-card border border-pickle-border rounded-full px-3 py-1 text-pickle-subtle flex items-center gap-1.5 text-[11px]">
              <Send className="h-3 w-3 text-blue-400" />
              Candidatés: <strong className="text-blue-400 font-bold">{stats?.applied ?? 0}</strong>
            </span>

            <span className={`rounded-full px-3 py-1 text-[11px] font-bold flex items-center gap-1.5 border transition-all ${
              (stats?.answer_received ?? 0) > 0
                ? 'bg-pickle-lime text-pickle-dark border-pickle-lime shadow-md shadow-pickle-lime/30 animate-pulse'
                : 'bg-pickle-card border-pickle-border text-pickle-subtle'
            }`}>
              <MessageSquareReply className="h-3 w-3" />
              Réponses : {stats?.answer_received ?? 0}
            </span>
          </div>
        </div>

      </div>
    </header>
  );
};
