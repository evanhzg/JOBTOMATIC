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
  MapPin, 
  Phone, 
  Mail 
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

  useEffect(() => {
    if (profile) {
      setFormData(JSON.parse(JSON.stringify(profile)));
    }
  }, [profile]);

  if (!formData) {
    return <div className="text-slate-400 p-8 text-center text-xs">Chargement du profil...</div>;
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
      degree: 'Diplôme / Certification',
      school: 'Établissement ou Organisme',
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
    <div className="max-w-4xl mx-auto py-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <UserCircle className="h-5 w-5 text-emerald-400" />
            Profil Candidat & CV Maître
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Ce profil de référence sert de socle à Antigravity (`agy`) pour adapter sur-mesure votre CV et vos lettres de motivation pour chaque offre.
          </p>
        </div>

        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all self-start md:self-auto"
        >
          {savedSuccess ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          <span>{savedSuccess ? 'Enregistré avec succès !' : 'Enregistrer le Profil'}</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Details */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
            <UserCircle className="h-4 w-4 text-emerald-400" />
            Informations Personnelles & Coordonnées
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Nom complet & Prénom</label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Email de contact</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Téléphone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Ville & Code Postal</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-slate-400 font-semibold text-xs mb-1">Titre de profil / Headline par défaut</label>
              <input
                type="text"
                value={formData.headline}
                onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold text-xs mb-1">Accroche / Résumé de présentation</label>
              <textarea
                rows={3}
                value={formData.summary}
                onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Skills */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
            <Wrench className="h-4 w-4 text-emerald-400" />
            Compétences Maîtresses (Techniques & Métiers)
          </h3>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Ajouter une compétence (ex: React, Python, Rigueur, Logistique...)"
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSkill(); } }}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={handleAddSkill}
              className="bg-slate-800 hover:bg-slate-700 text-emerald-400 px-4 py-2 rounded-xl text-xs font-semibold border border-slate-700"
            >
              Ajouter
            </button>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {formData.skills.map((skill) => (
              <span
                key={skill}
                className="bg-slate-800 text-emerald-300 border border-slate-700 rounded-xl px-3 py-1 text-xs font-medium flex items-center gap-2 group"
              >
                <span>{skill}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveSkill(skill)}
                  className="text-slate-500 hover:text-red-400 transition-colors"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Experiences */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-emerald-400" />
              Expériences Professionnelles
            </h3>
            <button
              type="button"
              onClick={handleAddExperience}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> Ajouter une expérience
            </button>
          </div>

          <div className="space-y-4">
            {formData.experiences.map((exp, index) => (
              <div key={index} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 relative group">
                <button
                  type="button"
                  onClick={() => handleRemoveExperience(index)}
                  className="absolute top-3 right-3 text-slate-500 hover:text-red-400 p-1 rounded transition-colors"
                  title="Supprimer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">Poste / Rôle</label>
                    <input
                      type="text"
                      value={exp.role}
                      onChange={(e) => {
                        const exps = [...formData.experiences];
                        exps[index].role = e.target.value;
                        setFormData({ ...formData, experiences: exps });
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Entreprise</label>
                    <input
                      type="text"
                      value={exp.company}
                      onChange={(e) => {
                        const exps = [...formData.experiences];
                        exps[index].company = e.target.value;
                        setFormData({ ...formData, experiences: exps });
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Période (ex: 2023 - Présent)</label>
                    <input
                      type="text"
                      value={exp.period}
                      onChange={(e) => {
                        const exps = [...formData.experiences];
                        exps[index].period = e.target.value;
                        setFormData({ ...formData, experiences: exps });
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 text-xs mb-1">Missions et réalisations (une par ligne)</label>
                  <textarea
                    rows={2}
                    value={exp.details.join('\n')}
                    onChange={(e) => {
                      const exps = [...formData.experiences];
                      exps[index].details = e.target.value.split('\n').filter(Boolean);
                      setFormData({ ...formData, experiences: exps });
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Education */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-emerald-400" />
              Formations & Diplômes
            </h3>
            <button
              type="button"
              onClick={handleAddEducation}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> Ajouter une formation
            </button>
          </div>

          <div className="space-y-3">
            {formData.education.map((edu, index) => (
              <div key={index} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between gap-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
                  <div>
                    <label className="block text-slate-400 mb-1">Diplôme</label>
                    <input
                      type="text"
                      value={edu.degree}
                      onChange={(e) => {
                        const edus = [...formData.education];
                        edus[index].degree = e.target.value;
                        setFormData({ ...formData, education: edus });
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">École / Établissement</label>
                    <input
                      type="text"
                      value={edu.school}
                      onChange={(e) => {
                        const edus = [...formData.education];
                        edus[index].school = e.target.value;
                        setFormData({ ...formData, education: edus });
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Année</label>
                    <input
                      type="text"
                      value={edu.year}
                      onChange={(e) => {
                        const edus = [...formData.education];
                        edus[index].year = e.target.value;
                        setFormData({ ...formData, education: edus });
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveEducation(index)}
                  className="text-slate-500 hover:text-red-400 p-1.5 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Preferences / Constraints */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h3 className="font-bold text-sm text-slate-200 border-b border-slate-800 pb-3">
            Préférences & Réponses Automatiques aux Formulaires
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Permis de conduire</label>
              <input
                type="text"
                value={formData.preferences?.driver_license || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  preferences: { ...formData.preferences, driver_license: e.target.value }
                })}
                placeholder="Permis B, Véhiculé..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Disponibilité</label>
              <input
                type="text"
                value={formData.preferences?.availability || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  preferences: { ...formData.preferences, availability: e.target.value }
                })}
                placeholder="Immédiate, Préavis 1 mois..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Prétentions salariales</label>
              <input
                type="text"
                value={formData.preferences?.min_salary || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  preferences: { ...formData.preferences, min_salary: e.target.value }
                })}
                placeholder="Selon grille conventionnelle..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
              />
            </div>
          </div>
        </div>

        {/* Bottom Save Bar */}
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={isLoading}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-3 rounded-xl text-xs flex items-center gap-2 shadow-xl shadow-emerald-500/20 active:scale-95 transition-all"
          >
            {savedSuccess ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            <span>{savedSuccess ? 'Enregistré avec succès !' : 'Enregistrer mon Profil & CV'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
