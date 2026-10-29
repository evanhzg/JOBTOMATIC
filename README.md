# 🚀 JobHunter AGY — Autopilot Career Assistant

**JobHunter AGY** est une application graphique intelligente en style **Kanban** qui utilise votre abonnement **Google Antigravity (`agy`)** pour rechercher et postuler automatiquement à des offres d'emploi (Apprentissage, Alternance, Intérim, CDI/CDD) sur les plateformes courantes (France Travail, HelloWork, Indeed, agences Adecco, Manpower, Randstad).

---

## ✨ Fonctionnalités Principales

1. **Intégration Antigravity (`agy`) Gratuite** :
   - Exploite le CLI local `agy` déjà authentifié avec le modèle `Gemini 3.8 Flash (High)` sans surcoût d'API.
   - Analyse le matching offre / profil (0 à 100%).
   - Répond intelligemment aux questions personnalisées des formulaires recruteurs.

2. **Adaptation Automatique du CV & Lettre de Motivation** :
   - Reformule l'accroche et réordonne les compétences selon les mots-clés ATS de chaque annonce.
   - Compile en quelques secondes un **PDF A4 moderne et professionnel** prêt à être expédié via Playwright (Chromium headless).

3. **Candidatures Directes & Automatisées** :
   - **Envoi Direct par Email (Gmail)** : Envoie un email personnalisé avec le CV PDF adapté en pièce jointe via SMTP.
   - **Formulaires Web en Ligne** : Remplit automatiquement les champs (nom, email, téléphone, upload du CV adapté) et capture une capture d'écran de confirmation.

4. **Détection en Direct des Réponses Recruteurs ("Answer Happened")** :
   - Le travailleur de fond IMAP surveille votre boîte de réception Gmail.
   - Dès qu'un recruteur ou une entreprise répond :
     - La carte Kanban passe dans la colonne en surbrillance **"💬 Réponse Reçue !"**.
     - La réponse est classifiée par AGY (*Entretien*, *Demande d'info*, *Refus*).
     - La date et l'extrait du message s'affichent instantanément sur le tableau.

5. **Tableau Kanban Visuel & Contrôles Maîtres** :
   - Colonnes : *Découvertes* ➔ *CV Personnalisé* ➔ *Candidaté* ➔ *Réponse Reçue !* ➔ *Entretiens* ➔ *Archivées*.
   - **Bouton Master Toggle** : active/désactive le pilote automatique à tout moment.
   - **Bouton Pause Immédiate** : gèle les opérations en cours en un clic.

6. **Onglet de Veille & Choix des Recherches** :
   - Définissez vos critères précis : mots-clés (ex: *Alternance Développeur Web*, *Intérim Logistique*), ville (*Rouen*), rayon (km), types de contrats et plateformes ciblées.

---

## 🛠️ Démarrage Rapide

### 1. Lancer l'Application

Dans votre terminal :

```bash
cd /home/evan/projects/jobhunter-agy
./run.sh
```

- **Interface Graphique Web** : [http://localhost:5173](http://localhost:5173)
- **API Backend & Documentation** : [http://localhost:8000/docs](http://localhost:8000/docs)

### 2. Configuration Gmail (Optionnelle mais recommandée)

Dans l'onglet **Paramètres & Gmail** de l'interface :
1. Renseignez votre adresse Gmail.
2. Créez un mot de passe d'application Google (16 caractères) dans [Sécurité Google](https://myaccount.google.com/apppasswords).
3. Cliquez sur **Tester la connexion Gmail**.

---

## 🧪 Tests Automatisés

Pour lancer la suite de tests unitaires :

```bash
cd /home/evan/projects/jobhunter-agy/backend
./venv/bin/pytest -v
```
