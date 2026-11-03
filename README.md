<p align="center"><img src="frontend/public/plonge-logo.svg" width="120" alt="Plonge"></p>

# Plonge

Recherche d'emploi automatisée, en local. Plonge trouve les offres, les fait noter par l'IA,
adapte **votre vrai CV** à chaque offre sans toucher à son design, envoie les candidatures
par Gmail, programme les relances et repère les réponses.

```bash
./run.sh          # installe ce qui manque au premier lancement, puis ouvre http://localhost:5173
```

## Ce que fait Plonge

| | |
|---|---|
| **Offres** | France Travail et La bonne alternance sans clé ; Adzuna et Jooble avec une clé gratuite. Plusieurs villes par recherche, rayon, contrats, ancienneté, télétravail, mots exclus/requis. Doublons fusionnés entre sources. Les pubs d'écoles/CFA déguisées en alternance sont écartées. Une offre vue sur Indeed/LinkedIn s'importe par son lien ou son texte. **Aucune offre n'est inventée** : une source en échec est affichée comme telle. |
| **CV adapté à chaque offre** | Le texte du PDF importé (Canva, Word…) est réécrit bloc par bloc à sa place exacte : mêmes polices, couleurs, colonnes, photo. Les faits (postes, employeurs, dates, disponibilités, permis, langues) sont verrouillés. Le taux de mots-clés de l'offre présents dans le CV est **mesuré** avant/après. L'email du CV est remplacé par celui du profil (`evhoizey@gmail.com` par défaut). |
| **Optimiseur de CV** | Audit sur 5 axes pour une cible, mesures calculées (mots-clés, puces chiffrées, verbes d'action), propositions de réécriture à cocher avec aperçu en direct dans le vrai design, versions du CV. Ce qui manquerait pour aller plus loin devient une question, jamais une invention. |
| **Envoi & relances** | Envoi par Gmail (mot de passe d'application) uniquement quand l'offre publie un email ; sinon lien + bouton « J'ai postulé ». Relances à J+7 et J+14 (réglables), jours ouvrés, dans le fil de la candidature ; annulées dès qu'une réponse arrive. |
| **Comptes IA & limites** | Claude Code, Codex, Antigravity ou clé API. Plusieurs comptes peuvent être liés : quand l'un atteint sa limite de session, le suivant prend le relais. Si tous sont limités, la file d'attente (persistante) reprend toute seule à l'heure de réinitialisation. |
| **Pilote automatique** | Recherches relancées seules, offres notées, CV adaptés au-dessus d'un seuil, envoi automatique ou après votre feu vert, limite quotidienne. |

## Lier plusieurs comptes IA

Onglet **IA & comptes → Lier un compte** :

- **Claude** : `claude setup-token` avec l'autre compte, puis collez le jeton ; ou « compte séparé » et lancez la commande affichée (`CLAUDE_CONFIG_DIR=… claude auth login`).
- **Codex** : « compte séparé » puis **Se connecter** : Plonge affiche le code à saisir sur le site d'OpenAI.
- **API Anthropic / OpenAI** : collez la clé.

Les comptes déjà connectés sur la machine sont ajoutés automatiquement.

## Développement

```
backend/   FastAPI · SQLite (data/plonge.db) · PyMuPDF
  app/ai/        pool de comptes, détection des limites, prompts
  app/cv/        moteur d'édition du PDF, adaptation, optimiseur
  app/scrapers/  sources, filtres, détection d'écoles, exécution
  app/tasks.py   file d'attente IA persistante (reprise après limite)
  app/applications.py  envoi, relances · app/inbox.py  réponses (IMAP)
frontend/  React · Vite · Tailwind
```

```bash
cd backend && ./venv/bin/python -m pytest          # tests hors ligne
LIVE=1 ./venv/bin/python -m pytest tests/test_sources_live.py   # sources réelles
```

Les données (base, CV, polices téléchargées) restent dans `backend/data` et `backend/storage`, hors git.
L'ancienne base `jobhunter.db` n'est pas réutilisée (ses offres étaient fictives) ; seul le CV importé est repris.
