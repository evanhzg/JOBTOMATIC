# ⚡ JOBTOMATIC — Autopilot Career Hunter & CV Tailoring Platform

<div align="center">

```
     ⚡  ╭───────────────╮
    / \  │   JOBTOMATIC  │  Mascotte : Motisma Lave-Vaisselle (Wash Rotom)
   / ▲ \ │  [AUTOPILOT]  │  Style : Pickles.team (Matte Grays & Neon Lime)
  ( [o] )╰───────────────╯  IA : Antigravity (AGY) / Claude / Codex
   \___/
```

**JOBTOMATIC** est une plateforme autonome de veille, d'audit de CV, d'adaptation sur-mesure et de candidature automatique aux offres d'emploi (Alternance, Intérim, CDI, CDD, Stage) à Rouen et en Normandie.

*Conçue avec l'esthétique minimaliste et brutale de **pickles.team** : tons gris mats, arêtes vives sans arrondi, mascotte Motisma Lave-Vaisselle dessinée à la main, et typographie technique.*

---

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3+-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-Pickles_Style-C5EA4B?style=flat-square)](https://tailwindcss.com)
[![Playwright](https://img.shields.io/badge/Playwright-Headless_Chromium-45BA4B?style=flat-square&logo=playwright)](https://playwright.dev)
[![Google Antigravity](https://img.shields.io/badge/AI_Engine-AGY_Gemini_3.8_Flash-FFA000?style=flat-square)](https://antigravity.google)

</div>

---

## 🥒 1. Identité Visuelle & Direction Artistique (Style Pickles.team)

L'application adopte rigoureusement les codes de conception de **pickles.team** :

- **Palette de Tons Gris & Accents Fluo** :
  - Fond d'écran : `#0C0C0C` (Noir profond mat).
  - Surfaces des cartes & panneaux : `#141414` et `#181818`.
  - Bordures & séparateurs ultra-nets : `#242424` et `#333333`.
  - Accent primaire : **Neon Lime `#C5EA4B`** (signature Pickles).
  - Accent secondaire : **Safety Orange `#FA5F11`** (alertes et sous-seuils).
  - Texte : Blanc cassé `#F5F5F5` et gris feutré `#8E8E8E`.
- **Zéro Arrondi ("Things are not rounded")** :
  - Tous les composants, cartes, boutons, badges, modales et onglets ont un rayon de bordure strict de `0px` (`rounded-none`).
  - Grille brutale, encadrements techniques précis de 1px.
- **Mascotte Emblématique** :
  - **Motisma Lave-Vaisselle (Wash Rotom)** dessiné à la main façon croquis technique Pickles (corps d'appareil électroménager géométrique, porte vitrée avec visage expressif de Rotom, antenne plasma orange et bras tuyaux électriques crachant de l'énergie).
- **Navigation Technique Segmentée** :
  - Indices d'onglets entre crochets : `[01] KANBAN`, `[02] CIBLES`, `[03] CV ORIGINAL & AUDIT`, `[04] PARAMÈTRES`, `[05] CONSOLE`.

---

## 🎯 2. Fonctionnalités Clés

### 📄 Import du Vrai CV & Préservation du Design Original (100% Fidèle)
- Vous importez votre vrai document CV (PDF) via l'onglet `[03] CV ORIGINAL & AUDIT`.
- L'application **conserve intégralement votre design d'origine** (polices, couleurs, colonnes, graphismes personnels).
- La visionneuse intégrée haute résolution permet de vérifier le document exactement tel qu'il sera transmis aux recruteurs.

### 📊 Audit d'Efficacité Multi-Métriques par l'IA (5 Pourcentages Distincts)
L'IA (AGY, Claude ou Codex) analyse le CV importé selon **5 axes quantifiés de 0 à 100%** :
1. **Alignement Mots-Clés ATS** (`ats_keywords`) : Correspondance lexicale avec les robots de tri recruteurs.
2. **Impact & Quantification des Résultats** (`impact_metrics`) : Détection des chiffres, pourcentages, délais et méthode STAR.
3. **Clarté, Structure & Lisibilité** (`clarity_structure`) : Hiérarchie visuelle et facilité de lecture en < 10 secondes.
4. **Pertinence Marché & Cible** (`target_relevance`) : Adéquation avec les contrats (Alternance, Intérim, CDI) et la région (Rouen).
5. **Densité des Compétences Clés** (`skills_density`) : Équilibre et profondeur du socle technique.

### ⚡ Générateur de Variantes IA pour tout Score < 80% (Seuil d'Excellence)
- Tout sous-score inférieur au seuil de **80%** est automatiquement signalé par un badge d'attention orange.
- Un bouton dédié **`⚡ Proposer 3 Variantes (95-100%)`** permet de générer instantanément :
  - **Variante 1** : Formulation Directe & Précise (synthèse chirurgicale).
  - **Variante 2** : Impact & Chiffres Clés (Méthode STAR complète).
  - **Variante 3** : Densité Lexicale & ATS Optimisé (mots-clés ciblés à haute fréquence).
- Bouton de copie en 1 clic pour intégrer directement la variante retenue.

### 🎛️ Sélecteur de Moteur d'IA Tri-Moteur
Basculez à tout moment entre les trois moteurs d'IA :
- **`[AGY]` Google Antigravity CLI** : Utilise votre abonnement actif Google Antigravity via `agy -p` (modèle Gemini 3.8 Flash) sans frais de tokens.
- **`[CLAUDE]` Anthropic Claude** : Compatible avec Claude Code CLI ou clé API Anthropic Sonnet 3.5.
- **`[CODEX]` OpenAI Codex CLI** : Exécute `codex exec` via votre session OpenAI active.

### ⏸️ Commandes Autopilot & Toggle "Validation par Lot"
- **Master Autopilot Switch** : Active ou désactive le cycle de prospection en arrière-plan.
- **Bouton Pause Immédiate** : Gèle instantanément toute action en cours sans réinitialiser l'état.
- **Toggle Validation par Lot (`wait_for_batch_validation`)** :
  - Si **ACTIVÉ** : L'IA prépare les CV adaptés et les lettres, les dépose dans la colonne *"CV Prêts / Validation"*, et attend votre clic sur **"VALIDER LE LOT"** avant d'envoyer.
  - Si **DÉSACTIVÉ** : Le moteur envoie les candidatures en continu dès qu'une offre dépasse le seuil de matching.

### 📋 Tableau Kanban Interactif en 6 Colonnes
1. **Découvertes** : Offres détectées par les scrapers (France Travail, Indeed, HelloWork, Intérim Rouen).
2. **CV Prêts / Validation** : Dossiers préparés sur-mesure par l'IA en attente d'envoi.
3. **Candidaté** : Candidatures soumises par formulaire web ou envoyées par e-mail direct.
4. **Réponse Reçue !** : Détection automatique des réponses des recruteurs avec bandeau fluo et extrait du message.
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
│   │   ├── agy_bridge.py      # Pont IA unifié (AGY, Claude, Codex & Audit CV)
│   │   ├── cv_renderer.py     # Compilateur PDF Playwright Chromium
│   │   ├── apply_engine.py    # Moteur d'envoi SMTP Gmail & Playwright Auto-fill
│   │   ├── inbox_tracker.py   # Surveillance IMAP des réponses recruteurs
│   │   ├── scheduler.py       # Tâches périodiques (Scraping, Batch, IMAP)
│   │   └── scrapers/          # Scrapers France Travail, HelloWork, Indeed, Intérim
│   ├── storage/
│   │   ├── imported_cv/       # Vrais CV originaux téléversés
│   │   ├── cvs/               # CV PDF adaptés par offre
│   │   └── screenshots/       # Preuves de soumission de formulaires
│   └── tests/                 # Suite de tests unitaires et d'intégration
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ControlBar.tsx         # Barre de commande & Navigation Pickles
│   │   │   ├── WashRotomMascot.tsx    # Mascotte SVG Motisma Lave-Vaisselle
│   │   │   ├── KanbanBoard.tsx        # Tableau Kanban 6 colonnes
│   │   │   ├── JobCard.tsx            # Carte d'offre brutale non-arrondie
│   │   │   ├── ProfileTab.tsx         # Import CV original & Audit d'Efficacité
│   │   │   ├── CVPreviewModal.tsx     # Visionneuse CV & Outil d'amélioration
│   │   │   ├── JobDetailModal.tsx     # Fiche détaillée de l'offre
│   │   │   ├── SearchTab.tsx          # Gestion des cibles et localisations
│   │   │   ├── SettingsTab.tsx        # Moteur IA, Gmail et règles de sécurité
│   │   │   └── LiveConsole.tsx        # Terminal d'activité en temps réel
│   │   ├── api.ts                     # Client d'API typé
│   │   ├── types.ts                   # Interfaces TypeScript
│   │   └── App.tsx                    # Composant racine
│   ├── tailwind.config.js             # Thème de couleurs Pickles.team
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

## 🛠️ 5. Configuration Manuelle

### Backend (Python)
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend (React / Vite)
```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

### Configuration Gmail (Optionnel pour l'envoi d'e-mails réels)
1. Activez la validation en deux étapes sur votre compte Google.
2. Créez un mot de passe d'application dans **Sécurité > Mots de passe des applications**.
3. Renseignez l'adresse e-mail et le mot de passe de 16 caractères dans l'onglet `[04] PARAMÈTRES`.
4. Cliquez sur **`TESTER LA CONNEXION GMAIL`** pour vérifier la liaison SSL SMTP et IMAP.

---

## 🔌 6. Spécification des Endpoints d'API

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/stats` | Métriques globales (offres, candidatures, réponses, statut autopilot) |
| `GET` | `/api/jobs` | Liste exhaustive des offres avec statut Kanban |
| `POST` | `/api/jobs/{id}/tailor` | Adaptation du CV et de la lettre pour une offre spécifique |
| `POST` | `/api/jobs/{id}/apply` | Déclenchement de la candidature (formulaire web ou e-mail) |
| `POST` | `/api/jobs/batch-validate` | Envoi groupé de toutes les candidatures prêtes |
| `POST` | `/api/jobs/{id}/improve-cv` | Audit IA et génération de suggestions de boost de score |
| `POST` | `/api/profile/upload-cv` | Téléversement d'un CV original (PDF) et calcul d'efficacité |
| `GET` | `/api/profile/original-cv` | Rendu haute fidélité du fichier PDF original importé |
| `POST` | `/api/profile/inspect-efficiency` | Recalcul des 5 pourcentages d'efficacité du CV |
| `POST` | `/api/profile/generate-variants` | Génération de 3 variantes rédigées pour un sous-score < 80% |
| `POST` | `/api/settings/set-provider` | Modification du moteur d'IA actif (`agy`, `claude`, `codex`) |
| `POST` | `/api/settings/toggle-batch-validation`| Bascule de l'attente de validation par lot |
| `POST` | `/api/settings/toggle-autopilot` | Activation / désactivation du pilote automatique |
| `POST` | `/api/settings/toggle-pause` | Mise en pause / reprise immédiate du moteur |

---

## 🧪 7. Tests Unitaires & Intégration

Exécutez la suite de tests automatisés :
```bash
cd backend
source venv/bin/activate
pytest -v
```

Tests inclus :
- `test_api.py` : Couverture des routes REST et gestion des statuts.
- `test_scrapers.py` : Parsing et normalisation des flux d'offres d'emploi.
- `test_agy_bridge.py` : Exécution du pont IA et extraction JSON.
- `test_cv_renderer.py` : Génération et compilation des PDF A4.
- `test_inbox_tracker.py` : Analyse et classification des e-mails recruteurs.

---

## 📜 Licence & Auteur

- Conçu et développé par **Evan** (`evanhzg`)
- Développé en pair programming avec **Google DeepMind Antigravity (AGY)**
- Style & Direction Artistique inspirés de **[pickles.team](https://pickles.team)**
- Licence : MIT
