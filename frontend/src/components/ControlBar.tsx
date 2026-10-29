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
  CheckCheck,
  Globe
} from 'lucide-react';
import { SystemStats } from '../types';
import { Language, translations } from '../i18n';
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
  currentLang: Language;
  onToggleLang: () => void;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  stats,
  activeTab,
  setActiveTab,
  onToggleAutopilot,
  onTogglePause,
  onToggleBatchValidation,
  onSelectProvider,
  isLoading,
  currentLang,
  onToggleLang
}) => {
  const isAuto = stats?.autopilot_enabled ?? false;
  const isPaused = stats?.is_paused ?? false;
  const isBatchValidation = stats?.wait_for_batch_validation ?? false;
  const activeProvider = stats?.ai_provider || 'agy';
  const t = translations[currentLang];

  return (
    <header className="bg-[#FFFFFF] border-b border-[#E2E2DC] sticky top-0 z-40 shadow-sm font-mono">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-2.5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          
          {/* Logo & Motisma Brand Emblem */}
          <div className="flex items-center gap-3">
            <div className="border border-[#D4D4CE] bg-[#FAF9F6] p-1.5 flex items-center justify-center">
              <WashRotomMascot size={36} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-wider text-[#18181B] font-mono uppercase">
                  JOB<span className="text-[#5F7A48]">TOMATIC</span>
                </h1>
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest bg-[#EEF3E9] text-[#5F7A48] border border-[#D4E0CD] px-2 py-0.5 flex items-center gap-1">
                  <Sparkles className="h-2.5 w-2.5 text-[#5F7A48]" /> [AUTOPILOT]
                </span>
              </div>
              <p className="text-[11px] font-mono text-[#71717A] tracking-tight">
                {t.app_subtitle}
              </p>
            </div>
          </div>

          {/* AI Engine Switcher (AGY / Claude / Codex) & Language Switcher */}
          <div className="flex items-center gap-3 flex-wrap">
            
            {/* AI Engine Selector */}
            <div className="flex items-center bg-[#FAF9F6] border border-[#E2E2DC] p-0.5 gap-0.5">
              <span className="text-[10px] font-mono uppercase font-bold text-[#71717A] px-2 flex items-center gap-1">
                <Cpu className="h-3 w-3 text-[#5F7A48]" /> {t.moteur_label}
              </span>

              <button
                onClick={() => onSelectProvider('agy')}
                className={`px-2.5 py-1 font-mono text-xs font-bold transition-all border ${
                  activeProvider === 'agy'
                    ? 'bg-[#5F7A48] text-[#FFFFFF] border-[#5F7A48]'
                    : 'bg-transparent text-[#71717A] border-transparent hover:text-[#18181B]'
                }`}
                title="Google Antigravity CLI (Gemini 3.8 Flash)"
              >
                [AGY]
              </button>

              <button
                onClick={() => onSelectProvider('claude')}
                className={`px-2.5 py-1 font-mono text-xs font-bold transition-all border ${
                  activeProvider === 'claude'
                    ? 'bg-[#8A5FB8] text-[#FFFFFF] border-[#8A5FB8]'
                    : 'bg-transparent text-[#71717A] border-transparent hover:text-[#18181B]'
                }`}
                title="Anthropic Claude"
              >
                [CLAUDE]
              </button>

              <button
                onClick={() => onSelectProvider('codex')}
                className={`px-2.5 py-1 font-mono text-xs font-bold transition-all border ${
                  activeProvider === 'codex'
                    ? 'bg-[#18181B] text-[#FFFFFF] border-[#18181B]'
                    : 'bg-transparent text-[#71717A] border-transparent hover:text-[#18181B]'
                }`}
                title="OpenAI Codex CLI"
              >
                [CODEX]
              </button>
            </div>

            {/* Language Switcher (FR / EN) */}
            <button
              onClick={onToggleLang}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-[#FAF9F6] hover:bg-[#F2F2EC] text-[#18181B] border border-[#E2E2DC] text-xs font-bold transition-all"
              title="Changer la langue du site (FR / EN)"
            >
              <Globe className="h-3.5 w-3.5 text-[#5F7A48]" />
              <span className={currentLang === 'fr' ? 'font-black text-[#5F7A48]' : 'text-[#71717A]'}>FR</span>
              <span className="text-[#D4D4CE]">/</span>
              <span className={currentLang === 'en' ? 'font-black text-[#5F7A48]' : 'text-[#71717A]'}>EN</span>
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
                  ? 'bg-[#EEF3E9] text-[#5F7A48] border-[#5F7A48]'
                  : 'bg-[#FAF9F6] text-[#71717A] border-[#E2E2DC] hover:border-[#A1A1AA]'
              }`}
              title="Si activé, l'IA prépare les CVs et attend votre clic de validation avant d'envoyer la candidature"
            >
              <CheckCheck className={`h-3.5 w-3.5 ${isBatchValidation ? 'text-[#5F7A48]' : 'text-neutral-400'}`} />
              <span>{t.batch_validation}</span>
              <span className={`px-1.5 py-0.2 font-mono text-[10px] ${isBatchValidation ? 'bg-[#5F7A48] text-white font-black' : 'bg-[#E4E4E7] text-[#71717A]'}`}>
                {isBatchValidation ? t.batch_on : t.batch_off}
              </span>
            </button>

            {/* Master Autopilot Toggle */}
            <button
              onClick={onToggleAutopilot}
              disabled={isLoading}
              className={`flex items-center gap-2 px-3.5 py-1.5 font-mono text-xs font-black transition-all border ${
                isAuto
                  ? 'bg-[#5F7A48] text-white border-[#5F7A48] hover:bg-[#4E653A]'
                  : 'bg-[#FAF9F6] text-[#18181B] border-[#D4D4D8] hover:border-[#18181B]'
              }`}
            >
              <Power className="h-3.5 w-3.5" />
              <span>{isAuto ? t.autopilot_active : t.autopilot_inactive}</span>
              <span className={`h-2 w-2 ${isAuto ? 'bg-white animate-ping' : 'bg-[#A1A1AA]'}`} />
            </button>

            {/* Instant Pause Button */}
            <button
              onClick={onTogglePause}
              disabled={isLoading}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs font-bold transition-all border ${
                isPaused
                  ? 'bg-[#B45309] text-white border-[#B45309] animate-pulse'
                  : 'bg-[#FAF9F6] text-[#18181B] border-[#D4D4D8] hover:border-[#18181B]'
              }`}
            >
              {isPaused ? <Play className="h-3.5 w-3.5 fill-white" /> : <Pause className="h-3.5 w-3.5" />}
              <span>{isPaused ? t.pause_active : t.pause_btn}</span>
            </button>
          </div>

        </div>

        {/* Technical Navigation Bar & KPI Blocks */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-2.5 border-t border-[#E2E2DC] pt-2">
          <nav className="flex items-center gap-1 overflow-x-auto scrollbar-none font-mono">
            <button
              onClick={() => setActiveTab('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold transition-all border ${
                activeTab === 'kanban'
                  ? 'bg-[#18181B] text-[#FFFFFF] border-[#18181B]'
                  : 'bg-transparent text-[#71717A] border-transparent hover:text-[#18181B] hover:bg-[#F2F2EC]'
              }`}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span>{t.tab_kanban}</span>
            </button>

            <button
              onClick={() => setActiveTab('search')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold transition-all border ${
                activeTab === 'search'
                  ? 'bg-[#18181B] text-[#FFFFFF] border-[#18181B]'
                  : 'bg-transparent text-[#71717A] border-transparent hover:text-[#18181B] hover:bg-[#F2F2EC]'
              }`}
            >
              <Search className="h-3.5 w-3.5" />
              <span>{t.tab_search}</span>
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold transition-all border ${
                activeTab === 'profile'
                  ? 'bg-[#18181B] text-[#FFFFFF] border-[#18181B]'
                  : 'bg-transparent text-[#71717A] border-transparent hover:text-[#18181B] hover:bg-[#F2F2EC]'
              }`}
            >
              <UserCircle className="h-3.5 w-3.5" />
              <span>{t.tab_profile}</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold transition-all border ${
                activeTab === 'settings'
                  ? 'bg-[#18181B] text-[#FFFFFF] border-[#18181B]'
                  : 'bg-transparent text-[#71717A] border-transparent hover:text-[#18181B] hover:bg-[#F2F2EC]'
              }`}
            >
              <Settings className="h-3.5 w-3.5" />
              <span>{t.tab_settings}</span>
            </button>

            <button
              onClick={() => setActiveTab('console')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold transition-all border ${
                activeTab === 'console'
                  ? 'bg-[#18181B] text-[#FFFFFF] border-[#18181B]'
                  : 'bg-transparent text-[#71717A] border-transparent hover:text-[#18181B] hover:bg-[#F2F2EC]'
              }`}
            >
              <Terminal className="h-3.5 w-3.5" />
              <span>{t.tab_console}</span>
            </button>
          </nav>

          {/* KPI Blocks (Pickles.app crisp style) */}
          <div className="flex items-center gap-2 font-mono text-xs overflow-x-auto scrollbar-none">
            <span className="bg-[#FAF9F6] border border-[#E2E2DC] px-2.5 py-1 text-[#71717A] flex items-center gap-1 text-[11px]">
              {t.stat_jobs} <strong className="text-[#18181B] font-bold">{stats?.total_jobs ?? 0}</strong>
            </span>

            <span className="bg-[#FAF9F6] border border-[#E2E2DC] px-2.5 py-1 text-[#71717A] flex items-center gap-1 text-[11px]">
              <Send className="h-3 w-3 text-blue-600" />
              {t.stat_applied} <strong className="text-blue-700 font-bold">{stats?.applied ?? 0}</strong>
            </span>

            <span className={`px-2.5 py-1 text-[11px] font-bold flex items-center gap-1.5 border transition-all ${
              (stats?.answer_received ?? 0) > 0
                ? 'bg-[#EEF3E9] text-[#5F7A48] border-[#5F7A48]'
                : 'bg-[#FAF9F6] border-[#E2E2DC] text-[#71717A]'
            }`}>
              <MessageSquareReply className="h-3 w-3" />
              {t.stat_replies} <strong>{stats?.answer_received ?? 0}</strong>
            </span>
          </div>
        </div>

      </div>
    </header>
  );
};
