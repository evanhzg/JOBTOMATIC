import React, { useState, useEffect } from 'react';
import { CandidateProfile, Experience, Education } from '../types';
import { 
  UserCircle, 
  Briefcase, 
  GraduationCap, 
  Wrench, 
  Save, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Sparkles, 
  FileText,
  Download,
  Eye,
  SlidersHorizontal
} from 'lucide-react';

interface ProfileTabProps {
  profile: CandidateProfile | null;
  onSaveProfile: (profile: CandidateProfile) => Promise<void>;
  isLoading: boolean;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  profile,
  onSaveProfile,
  isLoading
}) => {
  const [formData, setFormData] = useState<CandidateProfile | null>(null);
  const [newSkill, setNewSkill] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [viewMode, setViewMode] = useState<'editor' | 'preview'>('editor');

  useEffect(() => {
    if (profile) {
      setFormData(JSON.parse(JSON.stringify(profile)));
    }
  }, [profile]);

  if (!formData) {
    return <div className="text-pickle-subtle p-8 text-center text-xs">Chargement du profil...</div>;
  }

  const handleAddSkill = () => {
    if (newSkill.trim() && !formData.skills.includes(newSkill.trim())) {
      setFormData({
        ...formData,
        skills: [...formData.skills, newSkill.trim()]
      });
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setFormData({
      ...formData,
      skills: formData.skills.filter(s => s !== skillToRemove)
    });
  };

  const handleAddExperience = () => {
    const newExp: Experience = {
      role: 'Nouveau Poste',
      company: 'Entreprise',
      period: '2023 - 2024',
      location: formData.city || 'Rouen',
      details: ['Missions réalisées et réalisations clés...']
    };
    setFormData({
      ...formData,
      experiences: [newExp, ...formData.experiences]
    });
  };

  const handleRemoveExperience = (index: number) => {
    setFormData({
      ...formData,
      experiences: formData.experiences.filter((_, i) => i !== index)
    });
  };

  const handleAddEducation = () => {
    const newEdu: Education = {
      degree: 'Diplôme / Formation',
      school: 'Établissement',
      year: '2024',
      details: 'Spécialisation'
    };
    setFormData({
      ...formData,
      education: [newEdu, ...formData.education]
    });
  };

  const handleRemoveEducation = (index: number) => {
    setFormData({
      ...formData,
      education: formData.education.filter((_, i) => i !== index)
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;
    await onSaveProfile(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="max-w-5xl mx-auto py-6 space-y-6">
      {/* Header with Switcher: Editor vs Live Preview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-pickle-border pb-4">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2 font-['Inter_Tight',sans-serif]">
            <UserCircle className="h-5 w-5 text-pickle-lime" />
            CV d'Origine & Profil Maître
          </h2>
          <p className="text-xs text-pickle-subtle mt-1">
            Visualisez et modifiez directement votre CV original servant de référence à l'IA.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggle: Edit vs Preview */}
          <div className="flex items-center bg-pickle-card border border-pickle-border rounded-full p-1 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('editor')}
              className={`px-3.5 py-1.5 rounded-full font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'editor'
                  ? 'bg-pickle-lime text-pickle-dark shadow-sm'
                  : 'text-pickle-subtle hover:text-white'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Modifier le CV</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`px-3.5 py-1.5 rounded-full font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'preview'
                  ? 'bg-pickle-lime text-pickle-dark shadow-sm'
                  : 'text-pickle-subtle hover:text-white'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Aperçu Document</span>
            </button>
          </div>

          <a
            href="/api/profile/preview-pdf"
            target="_blank"
            rel="noreferrer"
            className="bg-neutral-900 hover:bg-neutral-800 text-pickle-lime border border-pickle-border px-3.5 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all"
            title="Télécharger le PDF original"
          >
            <Download className="h-3.5 w-3.5" />
            <span>PDF</span>
          </a>

          {viewMode === 'editor' && (
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="bg-pickle-lime hover:bg-pickle-limeHover text-pickle-dark font-black px-4 py-2 rounded-full text-xs flex items-center gap-1.5 shadow-md shadow-pickle-lime/20 active:scale-95 transition-all"
            >
              {savedSuccess ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              <span>{savedSuccess ? 'Enregistré !' : 'Enregistrer'}</span>
            </button>
          )}
        </div>
      </div>

      {/* VIEW MODE: LIVE PREVIEW OF ORIGINAL CV */}
      {viewMode === 'preview' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-pickle-subtle px-2">
            <span>Aperçu stylisé du document tel qu'il est compilé en PDF A4 :</span>
            <button
              onClick={() => setViewMode('editor')}
              className="text-pickle-lime hover:underline font-bold"
            >
              Modifier les informations du CV ➔
            </button>
          </div>

          <div className="bg-white text-slate-900 rounded-3xl p-8 sm:p-12 shadow-2xl max-w-3xl mx-auto border border-neutral-300 font-sans leading-relaxed">
            {/* Header */}
            <div className="border-b-2 border-slate-950 pb-4 mb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-black text-slate-950 tracking-tight">
                  {formData.full_name}
                </h1>
                <p className="text-sm font-bold text-blue-700 mt-1">
                  {formData.headline}
                </p>
              </div>

              <div className="text-xs text-slate-600 sm:text-right space-y-0.5">
                <div>📍 {formData.city}</div>
                <div>✉️ {formData.email}</div>
                <div>📞 {formData.phone}</div>
                {formData.preferences?.driver_license && (
                  <div>🚗 {formData.preferences.driver_license}</div>
                )}
              </div>
            </div>

            {/* Summary */}
            <div className="mb-5">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-2">
                Profil & Objectifs
              </h3>
              <p className="text-xs text-slate-700 leading-relaxed text-justify">
                {formData.summary}
              </p>
            </div>

            {/* Skills */}
            <div className="mb-5">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-2">
                Compétences Clés
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {formData.skills.map((skill, i) => (
                  <span key={i} className="bg-slate-100 text-slate-900 border border-slate-200 px-2.5 py-0.5 rounded-md text-[11px] font-semibold">
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {/* Experiences */}
            <div className="mb-5">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-2">
                Expériences Professionnelles
              </h3>
              <div className="space-y-3">
                {formData.experiences.map((exp, i) => (
                  <div key={i} className="text-xs">
                    <div className="flex justify-between font-bold text-slate-950">
                      <span>{exp.role}</span>
                      <span className="text-slate-500 font-normal">{exp.period}</span>
                    </div>
                    <div className="text-blue-700 font-medium text-[11px] mb-1">
                      {exp.company} — {exp.location || formData.city}
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-700 text-[11px]">
                      {exp.details.map((d, di) => (
                        <li key={di}>{d}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* Education */}
            {formData.education && formData.education.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-2">
                  Formations & Diplômes
                </h3>
                <div className="space-y-2">
                  {formData.education.map((edu, i) => (
                    <div key={i} className="text-xs flex justify-between">
                      <div>
                        <div className="font-bold text-slate-950">{edu.degree}</div>
                        <div className="text-slate-600 text-[11px]">{edu.school}</div>
                      </div>
                      <span className="text-slate-500 text-[11px]">{edu.year}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8 pt-3 border-t border-dashed border-slate-200 text-center text-[10px] text-slate-400">
              CV Maître Original — JobHunter AGY
            </div>
          </div>
        </div>
      ) : (
        /* VIEW MODE: IN-PLACE EDITOR */
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Details */}
          <div className="bg-pickle-card border border-pickle-border rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="font-extrabold text-sm text-white flex items-center gap-2 border-b border-pickle-border pb-3 font-['Inter_Tight',sans-serif]">
              <UserCircle className="h-4 w-4 text-pickle-lime" />
              Coordonnées du Candidat
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-pickle-subtle font-semibold mb-1">Nom & Prénom</label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full bg-pickle-dark border border-pickle-border rounded-xl px-3 py-2 text-white focus:outline-none focus:border-pickle-lime"
                />
              </div>

              <div>
                <label className="block text-pickle-subtle font-semibold mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-pickle-dark border border-pickle-border rounded-xl px-3 py-2 text-white focus:outline-none focus:border-pickle-lime"
                />
              </div>

              <div>
                <label className="block text-pickle-subtle font-semibold mb-1">Téléphone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-pickle-dark border border-pickle-border rounded-xl px-3 py-2 text-white focus:outline-none focus:border-pickle-lime"
                />
              </div>

              <div>
                <label className="block text-pickle-subtle font-semibold mb-1">Ville</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full bg-pickle-dark border border-pickle-border rounded-xl px-3 py-2 text-white focus:outline-none focus:border-pickle-lime"
                />
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-pickle-subtle font-semibold text-xs mb-1">Titre de profil par défaut</label>
                <input
                  type="text"
                  value={formData.headline}
                  onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
                  className="w-full bg-pickle-dark border border-pickle-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pickle-lime"
                />
              </div>

              <div>
                <label className="block text-pickle-subtle font-semibold text-xs mb-1">Accroche / Résumé</label>
                <textarea
                  rows={3}
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  className="w-full bg-pickle-dark border border-pickle-border rounded-xl p-3 text-xs text-white focus:outline-none focus:border-pickle-lime"
                />
              </div>
            </div>
          </div>

          {/* Skills */}
          <div className="bg-pickle-card border border-pickle-border rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="font-extrabold text-sm text-white flex items-center gap-2 border-b border-pickle-border pb-3 font-['Inter_Tight',sans-serif]">
              <Wrench className="h-4 w-4 text-pickle-lime" />
              Compétences Clés
            </h3>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ajouter une compétence (ex: React, Python, Rigueur...)"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSkill(); } }}
                className="flex-1 bg-pickle-dark border border-pickle-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pickle-lime"
              />
              <button
                type="button"
                onClick={handleAddSkill}
                className="bg-neutral-900 hover:bg-neutral-800 text-pickle-lime px-4 py-2 rounded-full text-xs font-bold border border-pickle-border"
              >
                Ajouter
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {formData.skills.map((skill) => (
                <span
                  key={skill}
                  className="bg-neutral-900 text-pickle-lime border border-neutral-800 rounded-full px-3 py-1 text-xs font-bold flex items-center gap-2"
                >
                  <span>{skill}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSkill(skill)}
                    className="text-neutral-500 hover:text-red-400"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Experiences */}
          <div className="bg-pickle-card border border-pickle-border rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-pickle-border pb-3">
              <h3 className="font-extrabold text-sm text-white flex items-center gap-2 font-['Inter_Tight',sans-serif]">
                <Briefcase className="h-4 w-4 text-pickle-lime" />
                Expériences Professionnelles
              </h3>
              <button
                type="button"
                onClick={handleAddExperience}
                className="text-xs text-pickle-lime hover:underline font-bold flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Ajouter
              </button>
            </div>

            <div className="space-y-4">
              {formData.experiences.map((exp, index) => (
                <div key={index} className="bg-pickle-dark p-4 rounded-2xl border border-pickle-border space-y-3 relative">
                  <button
                    type="button"
                    onClick={() => handleRemoveExperience(index)}
                    className="absolute top-3 right-3 text-neutral-500 hover:text-red-400 p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block text-pickle-subtle mb-1">Rôle</label>
                      <input
                        type="text"
                        value={exp.role}
                        onChange={(e) => {
                          const exps = [...formData.experiences];
                          exps[index].role = e.target.value;
                          setFormData({ ...formData, experiences: exps });
                        }}
                        className="w-full bg-pickle-card border border-pickle-border rounded-xl px-2.5 py-1.5 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-pickle-subtle mb-1">Entreprise</label>
                      <input
                        type="text"
                        value={exp.company}
                        onChange={(e) => {
                          const exps = [...formData.experiences];
                          exps[index].company = e.target.value;
                          setFormData({ ...formData, experiences: exps });
                        }}
                        className="w-full bg-pickle-card border border-pickle-border rounded-xl px-2.5 py-1.5 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-pickle-subtle mb-1">Période</label>
                      <input
                        type="text"
                        value={exp.period}
                        onChange={(e) => {
                          const exps = [...formData.experiences];
                          exps[index].period = e.target.value;
                          setFormData({ ...formData, experiences: exps });
                        }}
                        className="w-full bg-pickle-card border border-pickle-border rounded-xl px-2.5 py-1.5 text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-pickle-subtle text-xs mb-1">Missions (une par ligne)</label>
                    <textarea
                      rows={2}
                      value={exp.details.join('\n')}
                      onChange={(e) => {
                        const exps = [...formData.experiences];
                        exps[index].details = e.target.value.split('\n').filter(Boolean);
                        setFormData({ ...formData, experiences: exps });
                      }}
                      className="w-full bg-pickle-card border border-pickle-border rounded-xl p-2 text-xs text-white"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Save Bar */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="bg-pickle-lime hover:bg-pickle-limeHover text-pickle-dark font-black px-6 py-3 rounded-full text-xs flex items-center gap-2 shadow-xl shadow-pickle-lime/20 active:scale-95 transition-all"
            >
              {savedSuccess ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              <span>{savedSuccess ? 'Modifications enregistrées !' : 'Enregistrer mon Profil'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
