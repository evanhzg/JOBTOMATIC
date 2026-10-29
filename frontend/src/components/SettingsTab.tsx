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
    <div className="max-w-4xl mx-auto py-5 space-y-5 font-mono">
      {/* Header */}
      <div className="border-b border-[#D4D4D8] pb-3 bg-white p-4 shadow-xs">
        <h2 className="text-base font-black text-[#18181B] flex items-center gap-2 uppercase tracking-wider">
          <Settings className="h-4 w-4 text-[#5F7A48]" />
          PARAMÈTRES DU MOTEUR & INTÉGRATIONS
        </h2>
        <p className="text-xs text-[#71717A] mt-0.5">
          Configurez votre moteur IA (AGY, Claude, Codex), les règles d'auto-envoi par lot et vos accès Gmail.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        
        {/* AI Provider Selector Card */}
        <div className="bg-[#FFFFFF] border border-[#D4D4D8] p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-[#E4E4E7] pb-2.5">
            <h3 className="font-bold text-xs text-[#18181B] uppercase tracking-wider flex items-center gap-2">
              <Cpu className="h-4 w-4 text-[#5F7A48]" />
              Choix du Moteur d'Intelligence Artificielle
            </h3>
            <span className="text-[11px] bg-[#EEF3E9] text-[#5F7A48] px-2.5 py-0.2 border border-[#C8DAC0] font-bold">
              ACTIF : {provider.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {/* AGY Option */}
            <div
              onClick={() => setProvider('agy')}
              className={`p-3.5 border cursor-pointer transition-all ${
                provider === 'agy'
                  ? 'bg-[#EEF3E9] border-[#5F7A48] ring-1 ring-[#5F7A48]/30'
                  : 'bg-[#FAF9F6] border-[#D4D4D8] hover:border-[#18181B]'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-black text-[#18181B]">[AGY]</span>
                <span className="text-[9px] bg-[#5F7A48] text-white font-black px-1.5 py-0.2">
                  RECOMMANDÉ
                </span>
              </div>
              <p className="text-[10.5px] text-[#71717A] leading-relaxed">
                Google Antigravity (`Gemini 3.8 Flash`). Utilise votre abonnement local actif sans coût de jetons.
              </p>
            </div>

            {/* Claude Option */}
            <div
              onClick={() => setProvider('claude')}
              className={`p-3.5 border cursor-pointer transition-all ${
                provider === 'claude'
                  ? 'bg-[#F3EFF8] border-[#8A5FB8] ring-1 ring-[#8A5FB8]/30'
                  : 'bg-[#FAF9F6] border-[#D4D4D8] hover:border-[#18181B]'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-black text-[#18181B]">[CLAUDE]</span>
                <span className="text-[9px] bg-[#8A5FB8] text-white font-black px-1.5 py-0.2">
                  ANTHROPIC
                </span>
              </div>
              <p className="text-[10.5px] text-[#71717A] leading-relaxed">
                Claude Code CLI ou Clé API Anthropic Sonnet 3.5. Idéal pour la rédaction idiomatique de lettres.
              </p>
            </div>

            {/* Codex Option */}
            <div
              onClick={() => setProvider('codex')}
              className={`p-3.5 border cursor-pointer transition-all ${
                provider === 'codex'
                  ? 'bg-[#F2F2EC] border-[#18181B] ring-1 ring-[#18181B]/30'
                  : 'bg-[#FAF9F6] border-[#D4D4D8] hover:border-[#18181B]'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-black text-[#18181B]">[CODEX]</span>
                <span className="text-[9px] bg-[#18181B] text-white font-black px-1.5 py-0.2">
                  OPENAI
                </span>
              </div>
              <p className="text-[10.5px] text-[#71717A] leading-relaxed">
                OpenAI Codex CLI (`codex exec`). Connecté directement à votre session OpenAI locale active.
              </p>
            </div>
          </div>

          {provider === 'claude' && (
            <div className="pt-1 text-xs">
              <label className="block text-[#71717A] font-bold mb-1">
                Clé API Anthropic (Optionnelle si Claude CLI est déjà installé)
              </label>
              <input
                type="password"
                placeholder="sk-ant-api03-..."
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
                className="w-full bg-[#FAF9F6] border border-[#D4D4D8] px-3 py-1.5 text-xs text-[#18181B] focus:outline-none focus:border-[#5F7A48]"
              />
            </div>
          )}
        </div>

        {/* Batch Validation & Safety Rules */}
        <div className="bg-[#FFFFFF] border border-[#D4D4D8] p-5 space-y-5 shadow-xs">
          <h3 className="font-bold text-xs text-[#18181B] uppercase tracking-wider flex items-center gap-2 border-b border-[#E4E4E7] pb-2.5">
            <Sliders className="h-4 w-4 text-[#5F7A48]" />
            Mode d'Exécution & Validation par Lot
          </h3>

          <div className="bg-[#FAF9F6] p-3.5 border border-[#E2E2DC] flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <CheckCheck className="h-4 w-4 text-[#5F7A48]" />
                <span className="font-bold text-xs text-[#18181B]">
                  Attendre la validation manuelle pour chaque lot (Batch Validation)
                </span>
              </div>
              <p className="text-[10.5px] text-[#71717A]">
                Si activé, l'IA prépare le CV et la lettre, les place dans "CV Prêts" et attend votre validation. Si désactivé, le moteur postule en continu.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setWaitForBatch(!waitForBatch)}
              className={`px-3 py-1.5 text-xs font-black transition-all shrink-0 border ${
                waitForBatch
                  ? 'bg-[#5F7A48] text-white border-[#5F7A48]'
                  : 'bg-white text-[#71717A] border-[#D4D4D8] hover:text-[#18181B]'
              }`}
            >
              {waitForBatch ? 'ACTIVÉ (Attendre validation)' : 'DÉSACTIVÉ (Envoi continu)'}
            </button>
          </div>

          <div className="space-y-4 pt-1">
            {/* Threshold Slider */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-bold text-[#18181B]">Seuil de correspondance minimum</span>
                <span className="font-black text-[#5F7A48] bg-[#EEF3E9] px-2 py-0.2 border border-[#C8DAC0]">
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
                className="w-full accent-[#5F7A48]"
              />
            </div>

            {/* Daily Limit */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-bold text-[#18181B]">Quota quotidien de candidatures</span>
                <span className="font-black text-[#B45309] bg-[#FEF3C7] px-2 py-0.2 border border-[#FDE68A]">
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
                className="w-full accent-[#B45309]"
              />
            </div>
          </div>
        </div>

        {/* Gmail Direct Contact & IMAP Settings */}
        <div className="bg-[#FFFFFF] border border-[#D4D4D8] p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-[#E4E4E7] pb-2.5">
            <h3 className="font-bold text-xs text-[#18181B] uppercase tracking-wider flex items-center gap-2">
              <Mail className="h-4 w-4 text-[#5F7A48]" />
              Compte Gmail (SMTP & Surveillance IMAP)
            </h3>
            <span className="text-[10px] bg-[#FAF9F6] text-[#71717A] px-2 py-0.5 border border-[#D4D4D8]">
              Port 465 & 993 SSL
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[#71717A] font-bold mb-1">
                Adresse email Gmail
              </label>
              <input
                type="email"
                placeholder="votre-nom@gmail.com"
                value={gmailAddress}
                onChange={(e) => setGmailAddress(e.target.value)}
                className="w-full bg-[#FAF9F6] border border-[#D4D4D8] px-3 py-1.5 text-xs text-[#18181B] focus:outline-none focus:border-[#5F7A48]"
              />
            </div>

            <div>
              <label className="block text-[#71717A] font-bold mb-1">
                Mot de passe d'application Google (16 caractères)
              </label>
              <div className="relative">
                <Key className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#A1A1AA]" />
                <input
                  type="password"
                  placeholder="xxxx xxxx xxxx xxxx"
                  value={gmailAppPassword}
                  onChange={(e) => setGmailAppPassword(e.target.value)}
                  className="w-full bg-[#FAF9F6] border border-[#D4D4D8] pl-8 pr-3 py-1.5 text-xs text-[#18181B] focus:outline-none focus:border-[#5F7A48]"
                />
              </div>
            </div>
          </div>

          {/* Test connection button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="bg-[#FAF9F6] hover:bg-[#F2F2EC] text-[#18181B] border border-[#D4D4D8] font-bold px-3 py-1.5 text-xs flex items-center gap-1.5 self-start transition-all"
            >
              <RefreshCw className={`h-3 w-3 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? 'VÉRIFICATION EN COURS...' : 'TESTER LA CONNEXION GMAIL'}</span>
            </button>

            {testResult && (
              <div className={`text-xs px-2.5 py-1 flex items-center gap-1 border ${
                testResult.status === 'success' 
                  ? 'bg-[#EEF3E9] text-[#5F7A48] border-[#C8DAC0]'
                  : 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]'
              }`}>
                {testResult.status === 'success' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={isLoading}
            className="bg-[#5F7A48] hover:bg-[#4E653A] text-white font-black px-6 py-2 text-xs flex items-center gap-1.5 border border-[#5F7A48] transition-all"
          >
            {isSaved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            <span>{isSaved ? 'PARAMÈTRES ENREGISTRÉS !' : 'ENREGISTRER TOUS LES PARAMÈTRES'}</span>
          </button>
        </div>

      </form>
    </div>
  );
};
