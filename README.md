# Darts Friends — jeu Android en ligne et gratuit

Lire d'abord [LISEZ_MOI_INSTALLATION.txt](LISEZ_MOI_INSTALLATION.txt) pour la procédure complète en français.

**Application Web installable (PWA), pas un APK natif.** Les joueurs utilisent Chrome sur Android et peuvent l'ajouter à l'écran d'accueil. Une fois le jeu configuré et publié, un ordinateur n'est pas nécessaire pour les parties.

## Fonctions

- 301 / 501, double-out optionnel, 3 fléchettes par tour, bust, victoires.
- 3 joueurs à distance, salons privés de sept caractères, lien WhatsApp.
- Contrôles de lancer approuvés : déplacement horizontal de la fléchette, swipe ascendant dont vitesse = hauteur et pente = dérive. Les sensibilités Force et Direction sont communes à la salle et réglées par l'organisateur.
- Portraits fixes de Franck, Mathias et Stéphane. Pas d'animations d'avatar.
- Bouton Chambrer et réactions textuelles (« Tocar », « Atika », « Miskine », etc.).
- Entraînement solo sans connexion Firebase (après chargement de la page).
- Firebase Authentication anonyme et Realtime Database, GitHub Pages pour les fichiers.

## Configuration

1. Activer une base Firebase Realtime Database Spark et Authentication anonyme.
2. Publier les règles de `firebase-rules.json` dans Firebase > Realtime Database > Règles.
3. Remplir `firebase-config.js` avec les paramètres de votre application Web Firebase.
4. Publier le **contenu** de ce dossier dans un dépôt GitHub public, puis activer GitHub Pages (`main` → `/root`).
5. Copier le lien HTTPS à vos deux amis, ou partager un code de salle dans le jeu.

**Confidentialité :** les personnages sont des illustrations de personnes réelles. Un dépôt GitHub Pages gratuit est public. Demander l'accord de toutes les personnes représentées avant de publier leurs images. La base est destinée à trois amis de confiance, pas à une application compétitive anti-triche.

## Tests

```bash
node --test tests/game.test.mjs
```

Tests des règles : 14 réussis. Test Firebase de bout en bout et test natif Android non effectués : nécessitent une configuration Firebase fonctionnelle et de vrais appareils.
