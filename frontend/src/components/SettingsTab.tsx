import React, { useState, useEffect } from 'react';
import { SystemSettings } from '../types';
import { 
  Settings, 
  Mail, 
  Key, 
  ShieldCheck, 
  Sliders, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  Sparkles,
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
    <div className="max-w-4xl mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="border-b border-pickle-border pb-4">
        <h2 className="text-xl font-extrabold text-white flex items-center gap-2 font-['Inter_Tight',sans-serif]">
          <Settings className="h-5 w-5 text-pickle-lime" />
          Paramètres du Moteur & Intégrations
        </h2>
        <p className="text-xs text-pickle-subtle mt-1">
          Configurez votre moteur IA (AGY, Claude, Codex), les règles d'auto-envoi par lot et vos accès Gmail.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* AI Provider Selector Card */}
        <div className="bg-pickle-card border border-pickle-border rounded-3xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-pickle-border pb-3">
            <h3 className="font-extrabold text-sm text-white flex items-center gap-2 font-['Inter_Tight',sans-serif]">
              <Cpu className="h-4 w-4 text-pickle-lime" />
              Choix du Moteur d'Intelligence Artificielle
            </h3>
            <span className="text-[11px] bg-neutral-900 text-pickle-lime px-2.5 py-0.5 rounded-full border border-pickle-border font-bold">
              Actif : {provider.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* AGY Option */}
            <div
              onClick={() => setProvider('agy')}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                provider === 'agy'
                  ? 'bg-pickle-lime/10 border-pickle-lime ring-1 ring-pickle-lime/30'
                  : 'bg-pickle-dark border-pickle-border hover:border-neutral-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-base font-black text-white">🥒 AGY</span>
                <span className="text-[10px] bg-pickle-lime text-pickle-dark font-extrabold px-2 py-0.5 rounded-full">
                  Recommandé
                </span>
              </div>
              <p className="text-xs text-pickle-subtle leading-relaxed">
                Google Antigravity (`Gemini 3.8 Flash`). Utilise votre abonnement local actif sans coût de jetons.
              </p>
            </div>

            {/* Claude Option */}
            <div
              onClick={() => setProvider('claude')}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                provider === 'claude'
                  ? 'bg-purple-500/10 border-purple-500 ring-1 ring-purple-500/30'
                  : 'bg-pickle-dark border-pickle-border hover:border-neutral-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-base font-black text-white">🟣 Claude</span>
                <span className="text-[10px] bg-purple-500 text-white font-bold px-2 py-0.5 rounded-full">
                  Anthropic
                </span>
              </div>
              <p className="text-xs text-pickle-subtle leading-relaxed">
                Claude Code CLI ou Clé API Anthropic Sonnet 3.5. Excellent pour la rédaction de lettres de motivation.
              </p>
            </div>

            {/* Codex Option */}
            <div
              onClick={() => setProvider('codex')}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                provider === 'codex'
                  ? 'bg-emerald-500/10 border-emerald-500 ring-1 ring-emerald-500/30'
                  : 'bg-pickle-dark border-pickle-border hover:border-neutral-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-base font-black text-white">🟢 Codex</span>
                <span className="text-[10px] bg-emerald-500 text-slate-950 font-bold px-2 py-0.5 rounded-full">
                  OpenAI
                </span>
              </div>
              <p className="text-xs text-pickle-subtle leading-relaxed">
                OpenAI Codex CLI (`codex exec`). Connecté avec votre session OpenAI locale active.
              </p>
            </div>
          </div>

          {/* Claude API Key input if Claude is selected */}
          {provider === 'claude' && (
            <div className="pt-2 text-xs">
              <label className="block text-pickle-subtle font-semibold mb-1">
                Clé API Anthropic (Optionnelle si Claude CLI authentifié)
              </label>
              <input
                type="password"
                placeholder="sk-ant-api03-..."
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
                className="w-full bg-pickle-dark border border-pickle-border rounded-xl px-3 py-2 text-white focus:outline-none focus:border-pickle-lime"
              />
            </div>
          )}
        </div>

        {/* Batch Validation & Safety Rules */}
        <div className="bg-pickle-card border border-pickle-border rounded-3xl p-6 shadow-xl space-y-6">
          <h3 className="font-extrabold text-sm text-white flex items-center gap-2 border-b border-pickle-border pb-3 font-['Inter_Tight',sans-serif]">
            <Sliders className="h-4 w-4 text-pickle-lime" />
            Mode d'Exécution & Validation par Lot
          </h3>

          {/* Batch Validation Toggle Box */}
          <div className="bg-pickle-dark p-4 rounded-2xl border border-pickle-border flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CheckCheck className="h-4 w-4 text-pickle-lime" />
                <span className="font-bold text-xs text-white">
                  Attendre la validation manuelle pour chaque lot (Batch Validation)
                </span>
              </div>
              <p className="text-[11px] text-pickle-subtle">
                Si activé, l'IA prépare le CV et la lettre, les place dans "CV Prêts" et attend que vous cliquiez sur "Envoyer le Lot". Si désactivé, le moteur postule immédiatement en continu.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setWaitForBatch(!waitForBatch)}
              className={`px-4 py-2 rounded-full text-xs font-black transition-all shrink-0 border ${
                waitForBatch
                  ? 'bg-pickle-lime text-pickle-dark border-pickle-lime shadow-md shadow-pickle-lime/20'
                  : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
              }`}
            >
              {waitForBatch ? 'ACTIVÉ (Attendre validation)' : 'DÉSACTIVÉ (Envoi immédiat)'}
            </button>
          </div>

          <div className="space-y-6 pt-2">
            {/* Threshold Slider */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-bold text-white">Seuil de correspondance minimum</span>
                <span className="font-black text-pickle-lime bg-pickle-lime/10 px-2.5 py-0.5 rounded-full border border-pickle-lime/30">
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
                className="w-full accent-pickle-lime"
              />
            </div>

            {/* Daily Limit */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-bold text-white">Quota quotidien de candidatures</span>
                <span className="font-black text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/30">
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
                className="w-full accent-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Gmail Direct Contact & IMAP Settings */}
        <div className="bg-pickle-card border border-pickle-border rounded-3xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-pickle-border pb-3">
            <h3 className="font-extrabold text-sm text-white flex items-center gap-2 font-['Inter_Tight',sans-serif]">
              <Mail className="h-4 w-4 text-pickle-lime" />
              Compte Gmail (SMTP & IMAP Surveillance)
            </h3>
            <span className="text-[11px] bg-neutral-900 text-pickle-subtle px-2.5 py-0.5 rounded-full border border-pickle-border">
              Port 465 & 993 SSL
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-pickle-subtle font-semibold mb-1">
                Adresse email Gmail
              </label>
              <input
                type="email"
                placeholder="votre-nom@gmail.com"
                value={gmailAddress}
                onChange={(e) => setGmailAddress(e.target.value)}
                className="w-full bg-pickle-dark border border-pickle-border rounded-xl px-3 py-2 text-white focus:outline-none focus:border-pickle-lime"
              />
            </div>

            <div>
              <label className="block text-pickle-subtle font-semibold mb-1">
                Mot de passe d'application Google (16 caractères)
              </label>
              <div className="relative">
                <Key className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  type="password"
                  placeholder="xxxx xxxx xxxx xxxx"
                  value={gmailAppPassword}
                  onChange={(e) => setGmailAppPassword(e.target.value)}
                  className="w-full bg-pickle-dark border border-pickle-border rounded-xl pl-9 pr-3 py-2 text-white focus:outline-none focus:border-pickle-lime"
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
              className="bg-neutral-900 hover:bg-neutral-800 text-pickle-lime border border-pickle-border font-bold px-4 py-2 rounded-full text-xs flex items-center gap-2 self-start"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? 'Vérification en cours...' : 'Tester la connexion Gmail'}</span>
            </button>

            {testResult && (
              <div className={`text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 ${
                testResult.status === 'success' 
                  ? 'bg-pickle-lime/10 text-pickle-lime border border-pickle-lime/30'
                  : 'bg-red-500/10 text-red-300 border border-red-500/30'
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
            className="bg-pickle-lime hover:bg-pickle-limeHover text-pickle-dark font-black px-6 py-3 rounded-full text-xs flex items-center gap-2 shadow-xl shadow-pickle-lime/20 active:scale-95 transition-all"
          >
            {isSaved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            <span>{isSaved ? 'Paramètres sauvegardés !' : 'Enregistrer tous les paramètres'}</span>
          </button>
        </div>

      </form>
    </div>
  );
};
