# ⚡ JOBTOMATIC — Autopilot Career Hunter & CV Tailoring Platform

<div align="center">

```
     ⚡  ╭───────────────╮
    / \  │   JOBTOMATIC  │  Mascotte : Emblème Motisma Lave-Vaisselle (Rotom Modern Brand)
   / ▲ \ │  [AUTOPILOT]  │  Style : Pickles.app (Gris clair mat #F4F4F0 & Olive #5F7A48)
  ( [o] )╰───────────────╯  IA : Antigravity (AGY) / Claude / Codex
   \___/
```

**JOBTOMATIC** est une plateforme autonome de veille, d'audit de CV, d'adaptation sur-mesure et de candidature automatique aux offres d'emploi (Alternance, Intérim, CDI, CDD, Stage) à Rouen, en Normandie, multi-villes et en télétravail.

*Conçue avec l'esthétique minimaliste et brutale de **pickles.app** : tons gris clairs mats, texte anthracite, arêtes vives sans arrondi, logo de marque Motisma géométrique, et typographie technique suisse.*

---

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3+-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-Pickles.app_Style-5F7A48?style=flat-square)](https://tailwindcss.com)
[![Playwright](https://img.shields.io/badge/Playwright-Headless_Chromium-45BA4B?style=flat-square&logo=playwright)](https://playwright.dev)
[![Google Antigravity](https://img.shields.io/badge/AI_Engine-AGY_Gemini_3.8_Flash-FFA000?style=flat-square)](https://antigravity.google)

</div>

---

## 🥒 1. Identité Visuelle & Direction Artistique (Style Pickles.app)

L'application adopte rigoureusement les codes de conception de **pickles.app** :

- **Palette de Tons Gris Clairs & Vert Olive Mâté** :
  - Fond d'écran : `#F4F4F0` (Gris blanc cassé minéral texturé).
  - Surfaces des cartes & panneaux : `#FFFFFF` (Blanc pur net).
  - Bordures & séparateurs ultra-nets : `#D4D4D8` et `#E4E4E7` (1px brutal).
  - Accent primaire : **Vert Olive Mâté `#5F7A48`** (fond doux `#EEF3E9`).
  - Accent d'alerte : **Ambre Mâté `#B45309`** (fond doux `#FEF3C7`).
  - Texte : Anthracite profond `#18181B` et gris sous-titre `#52525B`.
- **Zéro Arrondi ("Things are not rounded")** :
  - Tous les composants, cartes, boutons, badges, modales et onglets ont un rayon de bordure strict de `0px` (`rounded-none`).
  - Grille suisse brutale, encadrements techniques précis.
- **Logo Emblème Motisma Tech Brand** :
  - Logo moderne stylisé inspiré de Motisma Lave-Vaisselle : écusson géométrique plasma en losange biseauté, turbine d'aspiration rotative, nexus d'étincelles électriques et châssis technique épuré.
- **Tableau Kanban 100% Fluide Sans Défilement Horizontal** :
  - Grille responsive fluide à 6 colonnes (`min-w-0 w-full`) calibrée pour s'adapter sans scroll horizontal indésirable sur les résolutions d'écran standards.
- **Bascule Bilingue Instantanée `[FR / EN]`** :
  - Toggle dans la barre de navigation permettant de basculer l'ensemble de l'interface utilisateur entre Français et Anglais sans impacter les critères de recherche.

---

## 🎯 2. Fonctionnalités Clés

### 📄 Consultation Inline du CV Original (Sans Téléchargement Automatique)
- Vous importez votre vrai document CV (PDF) via l'onglet `[03] CV ORIGINAL & AUDIT`.
- L'application **conserve intégralement votre design d'origine** (polices, couleurs, colonnes, graphismes personnels).
- Le visualiseur intégré haute résolution s'affiche directement dans le navigateur (`content_disposition_type="inline"`), **sans déclencher de téléchargement involontaire**.

### 📑 Propositions de Variantes en PDF Visuels Haute Définition
- L'IA ne se contente pas de retourner du simple texte brut : chaque suggestion d'amélioration génère une **fiche proposition PDF visuelle A4 complète** intégrant en-tête d'audit, comparaison avant/après, diagnostic chiffré et mise en page soignée prête à l'emploi.
- Prévisualisation immédiate dans l'interface et téléchargement possible en 1 clic.

### 🌐 Traducteur de CV Bilingue (Français ⇄ Anglais ATS)
- Module de traduction intelligent capable de convertir le CV complet en Anglais de recrutement international ou en Français avec reformulation en verbes d'action.
- Compilation instantanée en **PDF A4 bilingue stylisé** avec prévisualisation directe.

### 🚫 Filtre Anti-Écoles / CFAs ("Organismes de Formation")
- Détection automatique et blocage des annonces d'écoles privées et centres de formation qui polluent les plateformes d'alternance avec des fausses offres de poste.
- Analyse heuristique + validation par l'IA : les offres d'écoles reçoivent un flag d'avertissement `⚠️ Publicité formation / école` et leur score est plafonné à 15-20%, empêchant tout envoi automatique involontaire.

### 🏙️ Recherche Multi-Villes et Télétravail / Remote
- Saisie flexible de multiples localités séparées par des virgules (ex: `Rouen, Le Havre, Paris, Télétravail`).
- Puces d'accès rapide pour ajouter en un clic les bassins d'emploi normands ou le mode 100% Remote.
- Le planificateur interroge automatiquement l'ensemble des localités spécifiées.

### 📊 Audit d'Efficacité Multi-Métriques par l'IA (5 Pourcentages Distincts)
L'IA (AGY, Claude ou Codex) analyse le CV importé selon **5 axes quantifiés de 0 à 100%** :
1. **Alignement Mots-Clés ATS** (`ats_keywords`) : Correspondance lexicale avec les robots de tri recruteurs.
2. **Impact & Quantification des Résultats** (`impact_metrics`) : Détection des chiffres, pourcentages, délais et méthode STAR.
3. **Clarté, Structure & Lisibilité** (`clarity_structure`) : Hiérarchie visuelle et facilité de lecture en < 10 secondes.
4. **Pertinence Marché & Cible** (`target_relevance`) : Adéquation avec les contrats (Alternance, Intérim, CDI) et la région.
5. **Densité des Compétences Clés** (`skills_density`) : Équilibre et profondeur du socle technique.

### 🎛️ Sélecteur de Moteur d'IA Tri-Moteur
Basculez à tout moment entre les trois moteurs d'IA :
- **`[AGY]` Google Antigravity CLI** : Utilise votre abonnement actif Google Antigravity via `agy -p` (modèle Gemini 3.8 Flash) sans frais de tokens.
- **`[CLAUDE]` Anthropic Claude** : Compatible avec Claude Code CLI ou clé API Anthropic Sonnet 3.5.
- **`[CODEX]` OpenAI Codex CLI** : Exécute `codex exec` via votre session OpenAI active.

### ⏸️ Commandes Autopilot & Toggle "Validation par Lot"
- **Master Autopilot Switch** : Active ou désactive le cycle de prospection en arrière-plan.
- **Bouton Pause Immédiate** : Gèle instantanément toute action en cours sans réinitialiser l'état.
- **Toggle Validation par Lot (`wait_for_batch_validation`)** :
  - Si **ACTIVÉ** : L'IA prépare les CV adaptés et les lettres, les dépose dans la colonne *"CV Prêts / Validation"*, et attend votre validation manuelle avant envoi.
  - Si **DÉSACTIVÉ** : Le moteur envoie les candidatures en continu dès qu'une offre dépasse le seuil de matching.

### 📋 Tableau Kanban Interactif en 6 Colonnes Fluides
1. **Découvertes** : Offres détectées par les scrapers (France Travail, Indeed, HelloWork, Intérim Normandie).
2. **CV Prêts / Validation** : Dossiers préparés sur-mesure par l'IA en attente d'envoi.
3. **Candidaté** : Candidatures soumises par formulaire web ou envoyées par e-mail direct.
4. **Réponse Reçue !** : Détection automatique des réponses des recruteurs avec bandeau et extrait du message.
5. **Entretiens** : Dossiers qualifiés ayant débouché sur un entretien d'embauche.
6. **Archivées** : Historique des candidatures classées ou clôturées.

### 📬 Boîte E-mail Gmail Directe & Surveillance IMAP
- Connexion sécurisée en SSL (port 465 SMTP / 993 IMAP) avec mot de passe d'application Google.
- Détection et classification automatique des retours recruteurs (`INTERVIEW`, `INFO_REQUEST`, `ACKNOWLEDGMENT`, `REJECTION`).

### 🤖 Remplissage de Formulaires Web via Playwright Headless
- Automatisation du parcours de candidature sur les sites d'emploi (téléversement du PDF, remplissage des champs de formulaire).
- Prise de capture d'écran de confirmation stockée comme preuve de soumission.

---

## 🏗️ 3. Architecture Technique

```
jobhunter-agy/
├── backend/
│   ├── app/
│   │   ├── main.py            # API REST FastAPI & WebSockets
│   │   ├── config.py          # Répertoires, base SQLite & constantes
│   │   ├── database.py        # Schémas et migrations SQLite (aiosqlite)
│   │   ├── agy_bridge.py      # Pont IA unifié (AGY, Claude, Codex, Anti-School & Audit CV)
│   │   ├── cv_renderer.py     # Compilateur PDF (Chromium & ReportLab ATS / Propositions)
│   │   ├── apply_engine.py    # Moteur d'envoi SMTP Gmail & Playwright Auto-fill
│   │   ├── inbox_tracker.py   # Surveillance IMAP des réponses recruteurs
│   │   ├── scheduler.py       # Tâches périodiques multi-villes (Scraping, Batch, IMAP)
│   │   └── scrapers/          # Scrapers France Travail, HelloWork, Indeed, Intérim
│   ├── storage/
│   │   ├── imported_cv/       # Vrais CV originaux téléversés
│   │   ├── cvs/               # CV PDF adaptés, bilingues et fiches propositions
│   │   └── screenshots/       # Preuves de soumission de formulaires
│   └── tests/                 # Suite de tests unitaires et d'intégration
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ControlBar.tsx         # Barre de commande, toggle langue [FR/EN] & statut
│   │   │   ├── WashRotomMascot.tsx    # Logo emblème Motisma Tech Brand
│   │   │   ├── KanbanBoard.tsx        # Tableau Kanban 6 colonnes fluides (sans scroll H)
│   │   │   ├── JobCard.tsx            # Carte d'offre brutale pickles avec alertes écoles
│   │   │   ├── ProfileTab.tsx         # Import CV, audit, variantes PDF & traducteur FR/EN
│   │   │   ├── CVPreviewModal.tsx     # Visionneuse CV inline & suggestions IA
│   │   │   ├── JobDetailModal.tsx     # Fiche détaillée de l'offre
│   │   │   ├── SearchTab.tsx          # Gestion multi-villes et télétravail
│   │   │   ├── SettingsTab.tsx        # Moteur IA, Gmail et règles de sécurité
│   │   │   └── LiveConsole.tsx        # Terminal d'activité en temps réel
│   │   ├── i18n.ts                    # Dictionnaire bilingue Français / Anglais
│   │   ├── api.ts                     # Client d'API typé
│   │   ├── types.ts                   # Interfaces TypeScript
│   │   └── App.tsx                    # Composant racine
│   ├── tailwind.config.js             # Thème de couleurs Pickles.app
│   └── package.json
└── run.sh                             # Script de lancement tout-en-un
```

---

## 🚀 4. Installation & Démarrage Rapide

### Prérequis
- **Linux** (testé sur Ubuntu / Debian)
- **Python 3.12+**
- **Node.js 18+ & npm**
- **Playwright Chromium**
- Un abonnement local actif parmi :
  - `agy` (Google Antigravity CLI)
  - ou `claude` (Anthropic Claude Code CLI)
  - ou `codex` (OpenAI Codex CLI)

### 1. Cloner le Projet
```bash
git clone https://github.com/evanhzg/JOBTOMATIC.git
cd JOBTOMATIC
```

### 2. Démarrage Automatique via `run.sh`
```bash
chmod +x run.sh
./run.sh
```

Le script installe automatiquement les dépendances Python et Node, initialise la base SQLite, configure Chromium headless et lance :
- Le Backend FastAPI sur `http://localhost:8000` (Documentation Swagger sur `/docs`)
- Le Frontend Vite sur `http://localhost:5173`

---

## 🔌 5. Spécification des Endpoints d'API

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/stats` | Métriques globales (offres, candidatures, réponses, statut autopilot) |
| `GET` | `/api/jobs` | Liste exhaustive des offres avec statut Kanban et indicateur anti-école |
| `POST` | `/api/jobs/{id}/tailor` | Adaptation du CV et de la lettre pour une offre spécifique |
| `POST` | `/api/jobs/{id}/apply` | Déclenchement de la candidature (formulaire web ou e-mail) |
| `POST` | `/api/jobs/batch-validate` | Envoi groupé de toutes les candidatures prêtes |
| `POST` | `/api/jobs/{id}/improve-cv` | Audit IA et génération de suggestions de boost de score |
| `POST` | `/api/profile/upload-cv` | Téléversement d'un CV original (PDF) et calcul d'efficacité |
| `GET` | `/api/profile/original-cv` | Rendu inline du fichier PDF original importé (sans téléchargement forcé) |
| `POST` | `/api/profile/inspect-efficiency` | Recalcul des 5 pourcentages d'efficacité du CV |
| `POST` | `/api/profile/generate-variants` | Génération de 3 variantes rédigées avec fiches PDF visuelles associées |
| `GET` | `/api/profile/proposal-pdf` | Rendu inline du PDF visuel de proposition de variante |
| `POST` | `/api/profile/translate-cv` | Traduction du CV complet en Anglais/Français avec compilation PDF ATS |
| `GET` | `/api/profile/translated-pdf` | Rendu inline du PDF traduit |
| `POST` | `/api/settings/set-provider` | Modification du moteur d'IA actif (`agy`, `claude`, `codex`) |
| `POST` | `/api/settings/toggle-batch-validation`| Bascule de l'attente de validation par lot |
| `POST` | `/api/settings/toggle-autopilot` | Activation / désactivation du pilote automatique |
| `POST` | `/api/settings/toggle-pause` | Mise en pause / reprise immédiate du moteur |

---

## 🧪 6. Tests Automatisés

Exécutez la suite de tests automatisés :
```bash
cd backend
source venv/bin/activate
pytest -v
```

---

## 📜 Licence & Auteur

- Conçu et développé par **Evan** (`evanhzg`)
- Développé en pair programming avec **Google DeepMind Antigravity (AGY)**
- Style & Direction Artistique inspirés de **[pickles.app](https://pickles.app)**
- Licence : MIT
