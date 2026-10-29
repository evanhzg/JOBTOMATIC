import React, { useState, useEffect } from 'react';
import { SystemSettings } from '../types';
import { 
  Settings, 
  Mail, 
  Key, 
  Sliders, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Cpu, 
  CheckCheck 
} from 'lucide-react';
import { testEmailConnection } from '../api';

interface SettingsTabProps {
  settings: SystemSettings | null;
  onSaveSettings: (settings: Partial<SystemSettings>) => Promise<void>;
  isLoading: boolean;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  settings,
  onSaveSettings,
  isLoading
}) => {
  const [provider, setProvider] = useState<'agy' | 'claude' | 'codex'>('agy');
  const [waitForBatch, setWaitForBatch] = useState(false);
  const [anthropicKey, setAnthropicKey] = useState('');
  const [gmailAddress, setGmailAddress] = useState('');
  const [gmailAppPassword, setGmailAppPassword] = useState('');
  const [threshold, setThreshold] = useState(75);
  const [dailyLimit, setDailyLimit] = useState(20);
  const [testResult, setTestResult] = useState<{ status: string; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (settings) {
      setProvider(settings.ai_provider || 'agy');
      setWaitForBatch(settings.wait_for_batch_validation ?? false);
      setAnthropicKey(settings.anthropic_api_key || '');
      setGmailAddress(settings.gmail_address || '');
      setGmailAppPassword(settings.gmail_app_password || '');
      setThreshold(settings.match_score_threshold || 75);
      setDailyLimit(settings.daily_application_limit || 20);
    }
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveSettings({
      ai_provider: provider,
      wait_for_batch_validation: waitForBatch,
      anthropic_api_key: anthropicKey.trim(),
      gmail_address: gmailAddress.trim(),
      gmail_app_password: gmailAppPassword.trim(),
      match_score_threshold: threshold,
      daily_application_limit: dailyLimit
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      await onSaveSettings({
        ai_provider: provider,
        wait_for_batch_validation: waitForBatch,
        anthropic_api_key: anthropicKey.trim(),
        gmail_address: gmailAddress.trim(),
        gmail_app_password: gmailAppPassword.trim(),
        match_score_threshold: threshold,
        daily_application_limit: dailyLimit
      });
      const result = await testEmailConnection();
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ status: 'error', message: err.message || 'Échec du test de connexion' });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-6 font-mono">
      {/* Header */}
      <div className="border-b border-[#242424] pb-4">
        <h2 className="text-xl font-black text-white flex items-center gap-2 uppercase tracking-wider">
          <Settings className="h-5 w-5 text-[#C5EA4B]" />
          PARAMÈTRES DU MOTEUR & INTÉGRATIONS
        </h2>
        <p className="text-xs text-[#8E8E8E] mt-1">
          Configurez votre moteur IA (AGY, Claude, Codex), les règles d'auto-envoi par lot et vos accès Gmail.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* AI Provider Selector Card */}
        <div className="bg-[#141414] border border-[#242424] p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-[#242424] pb-3">
            <h3 className="font-bold text-xs text-white uppercase tracking-wider flex items-center gap-2">
              <Cpu className="h-4 w-4 text-[#C5EA4B]" />
              Choix du Moteur d'Intelligence Artificielle
            </h3>
            <span className="text-[11px] bg-[#0C0C0C] text-[#C5EA4B] px-2.5 py-0.5 border border-[#262626] font-bold">
              ACTIF : {provider.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* AGY Option */}
            <div
              onClick={() => setProvider('agy')}
              className={`p-4 border cursor-pointer transition-all ${
                provider === 'agy'
                  ? 'bg-[#182610] border-[#C5EA4B]'
                  : 'bg-[#0C0C0C] border-[#262626] hover:border-[#444444]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-black text-white">[AGY]</span>
                <span className="text-[9px] bg-[#C5EA4B] text-black font-black px-1.5 py-0.2">
                  RECOMMANDÉ
                </span>
              </div>
              <p className="text-[11px] text-[#8E8E8E] leading-relaxed">
                Google Antigravity (`Gemini 3.8 Flash`). Utilise votre abonnement local actif sans coût de jetons.
              </p>
            </div>

            {/* Claude Option */}
            <div
              onClick={() => setProvider('claude')}
              className={`p-4 border cursor-pointer transition-all ${
                provider === 'claude'
                  ? 'bg-[#22102A] border-[#B070FF]'
                  : 'bg-[#0C0C0C] border-[#262626] hover:border-[#444444]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-black text-white">[CLAUDE]</span>
                <span className="text-[9px] bg-[#B070FF] text-black font-black px-1.5 py-0.2">
                  ANTHROPIC
                </span>
              </div>
              <p className="text-[11px] text-[#8E8E8E] leading-relaxed">
                Claude Code CLI ou Clé API Anthropic Sonnet 3.5. Excellent pour la personnalisation des candidatures.
              </p>
            </div>

            {/* Codex Option */}
            <div
              onClick={() => setProvider('codex')}
              className={`p-4 border cursor-pointer transition-all ${
                provider === 'codex'
                  ? 'bg-[#10241A] border-[#22C55E]'
                  : 'bg-[#0C0C0C] border-[#262626] hover:border-[#444444]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-black text-white">[CODEX]</span>
                <span className="text-[9px] bg-[#22C55E] text-black font-black px-1.5 py-0.2">
                  OPENAI
                </span>
              </div>
              <p className="text-[11px] text-[#8E8E8E] leading-relaxed">
                OpenAI Codex CLI (`codex exec`). Connecté directement à votre session OpenAI locale active.
              </p>
            </div>
          </div>

          {/* Claude API Key input if Claude is selected */}
          {provider === 'claude' && (
            <div className="pt-2 text-xs">
              <label className="block text-[#8E8E8E] font-bold mb-1">
                Clé API Anthropic (Optionnelle si Claude CLI est déjà installé)
              </label>
              <input
                type="password"
                placeholder="sk-ant-api03-..."
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
                className="w-full bg-[#0C0C0C] border border-[#282828] px-3 py-2 text-white focus:outline-none focus:border-[#C5EA4B]"
              />
            </div>
          )}
        </div>

        {/* Batch Validation & Safety Rules */}
        <div className="bg-[#141414] border border-[#242424] p-6 space-y-6">
          <h3 className="font-bold text-xs text-white uppercase tracking-wider flex items-center gap-2 border-b border-[#242424] pb-3">
            <Sliders className="h-4 w-4 text-[#C5EA4B]" />
            Mode d'Exécution & Validation par Lot
          </h3>

          {/* Batch Validation Toggle Box (Sharp) */}
          <div className="bg-[#0C0C0C] p-4 border border-[#242424] flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CheckCheck className="h-4 w-4 text-[#C5EA4B]" />
                <span className="font-bold text-xs text-white">
                  Attendre la validation manuelle pour chaque lot (Batch Validation)
                </span>
              </div>
              <p className="text-[11px] text-[#8E8E8E]">
                Si activé, l'IA prépare le CV et la lettre, les place dans "CV Prêts" et attend que vous cliquiez sur "Envoyer le Lot". Si désactivé, le moteur postule immédiatement en continu.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setWaitForBatch(!waitForBatch)}
              className={`px-4 py-2 text-xs font-black transition-all shrink-0 border ${
                waitForBatch
                  ? 'bg-[#C5EA4B] text-black border-[#C5EA4B]'
                  : 'bg-[#181818] text-[#8E8E8E] border-[#2D2D2D] hover:text-white'
              }`}
            >
              {waitForBatch ? 'ACTIVÉ (Attendre validation)' : 'DÉSACTIVÉ (Envoi continu)'}
            </button>
          </div>

          <div className="space-y-5 pt-2">
            {/* Threshold Slider */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-bold text-white">Seuil de correspondance minimum</span>
                <span className="font-black text-[#C5EA4B] bg-[#182610] px-2.5 py-0.5 border border-[#C5EA4B]">
                  {threshold}%
                </span>
              </div>
              <input
                type="range"
                min="50"
                max="95"
                step="5"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full accent-[#C5EA4B]"
              />
            </div>

            {/* Daily Limit */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-bold text-white">Quota quotidien de candidatures</span>
                <span className="font-black text-[#FA5F11] bg-[#2A1810] px-2.5 py-0.5 border border-[#FA5F11]">
                  {dailyLimit} par jour
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="50"
                step="5"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(Number(e.target.value))}
                className="w-full accent-[#FA5F11]"
              />
            </div>
          </div>
        </div>

        {/* Gmail Direct Contact & IMAP Settings */}
        <div className="bg-[#141414] border border-[#242424] p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-[#242424] pb-3">
            <h3 className="font-bold text-xs text-white uppercase tracking-wider flex items-center gap-2">
              <Mail className="h-4 w-4 text-[#C5EA4B]" />
              Compte Gmail (SMTP & Surveillance IMAP)
            </h3>
            <span className="text-[11px] bg-[#0C0C0C] text-[#8E8E8E] px-2 py-0.5 border border-[#262626]">
              Port 465 & 993 SSL
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-[#8E8E8E] font-bold mb-1">
                Adresse email Gmail
              </label>
              <input
                type="email"
                placeholder="votre-nom@gmail.com"
                value={gmailAddress}
                onChange={(e) => setGmailAddress(e.target.value)}
                className="w-full bg-[#0C0C0C] border border-[#282828] px-3 py-2 text-white focus:outline-none focus:border-[#C5EA4B]"
              />
            </div>

            <div>
              <label className="block text-[#8E8E8E] font-bold mb-1">
                Mot de passe d'application Google (16 caractères)
              </label>
              <div className="relative">
                <Key className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#666666]" />
                <input
                  type="password"
                  placeholder="xxxx xxxx xxxx xxxx"
                  value={gmailAppPassword}
                  onChange={(e) => setGmailAppPassword(e.target.value)}
                  className="w-full bg-[#0C0C0C] border border-[#282828] pl-9 pr-3 py-2 text-white focus:outline-none focus:border-[#C5EA4B]"
                />
              </div>
            </div>
          </div>

          {/* Test connection button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="bg-[#0C0C0C] hover:bg-[#1A1A1A] text-[#C5EA4B] border border-[#282828] font-bold px-4 py-2 text-xs flex items-center gap-2 self-start transition-all"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? 'VÉRIFICATION EN COURS...' : 'TESTER LA CONNEXION GMAIL'}</span>
            </button>

            {testResult && (
              <div className={`text-xs px-3 py-1.5 flex items-center gap-1.5 border ${
                testResult.status === 'success' 
                  ? 'bg-[#182610] text-[#C5EA4B] border-[#C5EA4B]'
                  : 'bg-[#2A1010] text-red-400 border-red-500'
              }`}>
                {testResult.status === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="bg-[#C5EA4B] hover:bg-[#d6f859] text-black font-black px-6 py-2.5 text-xs flex items-center gap-2 border border-[#C5EA4B] transition-all"
          >
            {isSaved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            <span>{isSaved ? 'PARAMÈTRES ENREGISTRÉS !' : 'ENREGISTRER TOUS LES PARAMÈTRES'}</span>
          </button>
        </div>

      </form>
    </div>
  );
};
