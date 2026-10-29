import React from 'react';
import { 
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
  Cpu,
  CheckCheck
} from 'lucide-react';
import { SystemStats } from '../types';
import { WashRotomMascot } from './WashRotomMascot';

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
    <header className="bg-[#0C0C0C] border-b border-[#242424] sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          
          {/* Logo & Hand-drawn Motisma Dishwasher (Wash Rotom) Mascot */}
          <div className="flex items-center gap-3">
            <div className="border border-[#2A2A2A] bg-[#141414] p-1.5 flex items-center justify-center">
              <WashRotomMascot size={38} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-wider text-white font-mono uppercase">
                  JOB<span className="text-[#C5EA4B]">TOMATIC</span>
                </h1>
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest bg-[#1B1B1B] text-[#C5EA4B] border border-[#333333] px-2 py-0.5 flex items-center gap-1">
                  <Sparkles className="h-2.5 w-2.5 text-[#C5EA4B]" /> [AUTOPILOT]
                </span>
              </div>
              <p className="text-[11px] font-mono text-[#8E8E8E] tracking-tight">
                Mascotte Motisma Lave-Vaisselle — Candidatures Auto & CV Sur-Mesure
              </p>
            </div>
          </div>

          {/* AI Engine Switcher (AGY / Claude / Codex) - Pickles boxy brutalist selector */}
          <div className="flex items-center bg-[#141414] border border-[#262626] p-0.5 gap-0.5 self-start lg:self-auto">
            <span className="text-[10px] font-mono uppercase font-bold text-[#777777] px-2 flex items-center gap-1">
              <Cpu className="h-3 w-3 text-[#C5EA4B]" /> IA:
            </span>

            <button
              onClick={() => onSelectProvider('agy')}
              className={`px-3 py-1 font-mono text-xs font-bold transition-all border ${
                activeProvider === 'agy'
                  ? 'bg-[#C5EA4B] text-[#0C0C0C] border-[#C5EA4B]'
                  : 'bg-transparent text-[#8E8E8E] border-transparent hover:text-white'
              }`}
              title="Google Antigravity CLI (Gemini 3.8 Flash)"
            >
              [AGY]
            </button>

            <button
              onClick={() => onSelectProvider('claude')}
              className={`px-3 py-1 font-mono text-xs font-bold transition-all border ${
                activeProvider === 'claude'
                  ? 'bg-[#B070FF] text-black border-[#B070FF]'
                  : 'bg-transparent text-[#8E8E8E] border-transparent hover:text-white'
              }`}
              title="Anthropic Claude"
            >
              [CLAUDE]
            </button>

            <button
              onClick={() => onSelectProvider('codex')}
              className={`px-3 py-1 font-mono text-xs font-bold transition-all border ${
                activeProvider === 'codex'
                  ? 'bg-[#22C55E] text-black border-[#22C55E]'
                  : 'bg-transparent text-[#8E8E8E] border-transparent hover:text-white'
              }`}
              title="OpenAI Codex CLI"
            >
              [CODEX]
            </button>
          </div>

          {/* Master Action Controls: Batch Validation, Autopilot & Instant Pause */}
          <div className="flex items-center flex-wrap gap-2">
            
            {/* Batch Validation Toggle */}
            <button
              onClick={onToggleBatchValidation}
              disabled={isLoading}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs font-bold transition-all border ${
                isBatchValidation
                  ? 'bg-[#181818] text-[#C5EA4B] border-[#C5EA4B]'
                  : 'bg-[#141414] text-[#8E8E8E] border-[#262626] hover:border-[#444444]'
              }`}
              title="Si activé, l'IA génère les CVs et attend votre clic de validation avant d'envoyer la candidature"
            >
              <CheckCheck className={`h-3.5 w-3.5 ${isBatchValidation ? 'text-[#C5EA4B]' : 'text-neutral-500'}`} />
              <span>BATCH VALIDATION:</span>
              <span className={`px-1 font-mono text-[10px] ${isBatchValidation ? 'bg-[#C5EA4B] text-black font-black' : 'bg-[#222222] text-[#888888]'}`}>
                {isBatchValidation ? 'ON' : 'OFF'}
              </span>
            </button>

            {/* Master Autopilot Toggle */}
            <button
              onClick={onToggleAutopilot}
              disabled={isLoading}
              className={`flex items-center gap-2 px-3.5 py-1.5 font-mono text-xs font-black transition-all border ${
                isAuto
                  ? 'bg-[#C5EA4B] text-[#0C0C0C] border-[#C5EA4B] hover:bg-[#d6f859]'
                  : 'bg-[#141414] text-[#CCCCCC] border-[#262626] hover:border-[#444444]'
              }`}
              title={isAuto ? "Arrêter le cycle de prospection automatique" : "Lancer le cycle de prospection automatique"}
            >
              <Power className="h-3.5 w-3.5" />
              <span>{isAuto ? 'AUTOPILOT [ACTIF]' : 'AUTOPILOT [INACTIF]'}</span>
              <span className={`h-2 w-2 ${isAuto ? 'bg-black animate-ping' : 'bg-[#444444]'}`} />
            </button>

            {/* Instant Pause Button */}
            <button
              onClick={onTogglePause}
              disabled={isLoading}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs font-bold transition-all border ${
                isPaused
                  ? 'bg-[#FA5F11] text-black border-[#FA5F11] animate-pulse'
                  : 'bg-[#141414] text-[#CCCCCC] border-[#262626] hover:border-[#444444]'
              }`}
              title={isPaused ? "Reprendre les opérations" : "Mettre en pause immédiate toutes les actions"}
            >
              {isPaused ? <Play className="h-3.5 w-3.5 fill-black" /> : <Pause className="h-3.5 w-3.5" />}
              <span>{isPaused ? 'EN PAUSE' : 'PAUSE'}</span>
            </button>
          </div>

        </div>

        {/* Technical Brutalist Pickles Navigation Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-3 border-t border-[#242424] pt-2.5">
          <nav className="flex items-center gap-1 overflow-x-auto scrollbar-none font-mono">
            <button
              onClick={() => setActiveTab('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold transition-all border ${
                activeTab === 'kanban'
                  ? 'bg-[#1B1B1B] text-[#C5EA4B] border-[#C5EA4B]'
                  : 'bg-transparent text-[#8E8E8E] border-transparent hover:text-white hover:bg-[#141414]'
              }`}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span>[01] KANBAN</span>
            </button>

            <button
              onClick={() => setActiveTab('search')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold transition-all border ${
                activeTab === 'search'
                  ? 'bg-[#1B1B1B] text-[#C5EA4B] border-[#C5EA4B]'
                  : 'bg-transparent text-[#8E8E8E] border-transparent hover:text-white hover:bg-[#141414]'
              }`}
            >
              <Search className="h-3.5 w-3.5" />
              <span>[02] CIBLES</span>
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold transition-all border ${
                activeTab === 'profile'
                  ? 'bg-[#1B1B1B] text-[#C5EA4B] border-[#C5EA4B]'
                  : 'bg-transparent text-[#8E8E8E] border-transparent hover:text-white hover:bg-[#141414]'
              }`}
            >
              <UserCircle className="h-3.5 w-3.5" />
              <span>[03] CV ORIGINAL & AUDIT</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold transition-all border ${
                activeTab === 'settings'
                  ? 'bg-[#1B1B1B] text-[#C5EA4B] border-[#C5EA4B]'
                  : 'bg-transparent text-[#8E8E8E] border-transparent hover:text-white hover:bg-[#141414]'
              }`}
            >
              <Settings className="h-3.5 w-3.5" />
              <span>[04] PARAMÈTRES</span>
            </button>

            <button
              onClick={() => setActiveTab('console')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold transition-all border ${
                activeTab === 'console'
                  ? 'bg-[#1B1B1B] text-[#C5EA4B] border-[#C5EA4B]'
                  : 'bg-transparent text-[#8E8E8E] border-transparent hover:text-white hover:bg-[#141414]'
              }`}
            >
              <Terminal className="h-3.5 w-3.5" />
              <span>[05] CONSOLE</span>
            </button>
          </nav>

          {/* KPI Blocks (Not Rounded, Boxy Technical Grids) */}
          <div className="flex items-center gap-2 font-mono text-xs overflow-x-auto scrollbar-none">
            <span className="bg-[#141414] border border-[#242424] px-2.5 py-1 text-[#8E8E8E] flex items-center gap-1 text-[11px]">
              OFFRES: <strong className="text-white font-bold">{stats?.total_jobs ?? 0}</strong>
            </span>

            <span className="bg-[#141414] border border-[#242424] px-2.5 py-1 text-[#8E8E8E] flex items-center gap-1 text-[11px]">
              <Send className="h-3 w-3 text-blue-400" />
              CANDIDATÉS: <strong className="text-blue-400 font-bold">{stats?.applied ?? 0}</strong>
            </span>

            <span className={`px-2.5 py-1 text-[11px] font-bold flex items-center gap-1.5 border transition-all ${
              (stats?.answer_received ?? 0) > 0
                ? 'bg-[#1A2610] text-[#C5EA4B] border-[#C5EA4B]'
                : 'bg-[#141414] border-[#242424] text-[#8E8E8E]'
            }`}>
              <MessageSquareReply className="h-3 w-3" />
              RÉPONSES: <strong>{stats?.answer_received ?? 0}</strong>
            </span>
          </div>
        </div>

      </div>
    </header>
  );
};
