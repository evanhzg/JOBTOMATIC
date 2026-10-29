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
  RefreshCw
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
  const [gmailAddress, setGmailAddress] = useState('');
  const [gmailAppPassword, setGmailAppPassword] = useState('');
  const [threshold, setThreshold] = useState(75);
  const [dailyLimit, setDailyLimit] = useState(20);
  const [testResult, setTestResult] = useState<{ status: string; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (settings) {
      setGmailAddress(settings.gmail_address || '');
      setGmailAppPassword(settings.gmail_app_password || '');
      setThreshold(settings.match_score_threshold || 75);
      setDailyLimit(settings.daily_application_limit || 20);
    }
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveSettings({
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
      // First save current inputs
      await onSaveSettings({
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
    <div className="max-w-4xl mx-auto py-6 space-y-8">
      {/* Header */}
      <div className="border-b border-slate-800 pb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Settings className="h-5 w-5 text-emerald-400" />
          Paramètres du Moteur & Connexion Gmail
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Configurez votre compte Gmail pour l'envoi direct de candidatures et la détection en temps réel des réponses reçues des recruteurs.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Gmail Direct Contact & IMAP Settings */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
              <Mail className="h-4 w-4 text-emerald-400" />
              Compte Gmail (SMTP & IMAP Détection de Réponse)
            </h3>
            <span className="text-[11px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">
              Chiffrement TLS / SSL 993 & 465
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                Adresse email Gmail
              </label>
              <input
                type="email"
                placeholder="votre-nom@gmail.com"
                value={gmailAddress}
                onChange={(e) => setGmailAddress(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                Mot de passe d'application Google (16 caractères)
              </label>
              <div className="relative">
                <Key className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  placeholder="xxxx xxxx xxxx xxxx"
                  value={gmailAppPassword}
                  onChange={(e) => setGmailAppPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Helper box explaining Google App Password */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs space-y-2 text-slate-400">
            <div className="font-semibold text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Comment générer votre mot de passe d'application en 30 secondes :
            </div>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-400">
              <li>Rendez-vous dans les paramètres de sécurité de votre compte Google : <strong>Validation en 2 étapes</strong>.</li>
              <li>Tout en bas, cliquez sur <strong>Mots de passe des applications</strong>.</li>
              <li>Donnez un nom (ex: <em>JobHunter AGY</em>) et générez la clé de 16 lettres.</li>
              <li>Copiez-collez cette clé ci-dessus (sans espaces).</li>
            </ol>
            <a
              href="https://myaccount.google.com/apppasswords"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 text-xs font-semibold pt-1"
            >
              <span>Ouvrir la page Sécurité Google App Passwords</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Test connection button and status */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 font-semibold px-4 py-2 rounded-xl text-xs flex items-center gap-2 self-start"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? 'Vérification IMAP & SMTP...' : 'Tester la connexion Gmail'}</span>
            </button>

            {testResult && (
              <div className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${
                testResult.status === 'success' 
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                  : testResult.status === 'warning'
                  ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                  : 'bg-red-500/10 text-red-300 border border-red-500/30'
              }`}>
                {testResult.status === 'success' && <CheckCircle2 className="h-4 w-4" />}
                {testResult.status === 'warning' && <AlertCircle className="h-4 w-4" />}
                {testResult.status === 'error' && <AlertCircle className="h-4 w-4" />}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>
        </div>

        {/* Automation & Autopilot Rules */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
            <Sliders className="h-4 w-4 text-emerald-400" />
            Règles du Pilote Automatique (Antigravity)
          </h3>

          <div className="space-y-6">
            {/* Threshold Slider */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-300">Seuil de correspondance minimum pour auto-candidature</span>
                <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
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
                className="w-full accent-emerald-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                L'agent Antigravity adapte automatiquement votre CV et postule uniquement aux offres avec un score de pertinence supérieur ou égal à {threshold}%.
              </p>
            </div>

            {/* Daily Cap */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-300">Quota quotidien maximum de candidatures</span>
                <span className="font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
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
              <p className="text-[11px] text-slate-500 mt-1">
                Limite de sécurité anti-spam pour préserver la réputation de votre adresse email et de vos comptes de plateformes.
              </p>
            </div>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-3 rounded-xl text-xs flex items-center gap-2 shadow-xl shadow-emerald-500/20 active:scale-95 transition-all"
          >
            {isSaved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            <span>{isSaved ? 'Paramètres sauvegardés !' : 'Enregistrer les paramètres'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
