# Darts Friends V0.9 — Orientation des fléchettes corrigée

Version construite sur la V0.9. Application Web Android installable (PWA) ; 301/501, solo ou salons privés à 2–4, visée partagée Firebase, grande zone de lancer, sensibilités communes, effets au ralenti et avatars sont conservés.

## Correctif V0.9 — sans changer le gameplay

- **Orientation continue pendant tout le vol** : la fléchette suit l'axe général du lancer avec une oscillation subtile au lieu de suivre la tangente de la courbe décorative, qui pouvait s'inverser brusquement près de la cible.
- **Impact sans rotation brusque** : l'angle exact au dernier instant de vol est mémorisé et appliqué à la fléchette plantée, à l'identique.
- **Taille identique à l'impact** : la fléchette a la même échelle entre la dernière image en vol et sa position plantée.
- La courbe du vol, le point d'impact, les tirs ralentis, le lancer, les bruits, les voix, les scores et le multijoueur sont conservés. La physique n'est pas recalculée.

## Ce qui change

- **Fléchette de compétition** dessinée avec pointe effilée en acier, fût tungstène rainuré (grip croisé et bagues), col de liaison, tige, ailettes facettées. Le projectile est désormais visible en entier avant le lancer, pendant le vol et planté dans la cible.
- **Trois finitions personnalisées** : rouge acier pour Franck, or/champagne pour Stéphane, anthracite et turquoise pour Mathias ; finition neutre pour l'invité.
- **Vol légèrement incurvé** : trajectoire cubique avec dérive douce. En V0.9, orientation stabilisée sans modifier la position sur la courbe. La position de l'impact reste rigoureusement celle calculée avec le geste.
- **Bruitages originaux** : décoche, souffle de vol, impact sur la cible, impact fort, fléchette hors cible, réaction de foule, grognement. Fichiers OGG locaux, sans publicité ni téléchargement de sons externes.
- **Réactions des amis** : les répliques de Darts Friends (« Tocar ! », « Miskine ! », « Hihihi, 26 ! », « Triple buse ! », etc.) sont affichées dans une bulle avec le portrait de l'adversaire et peuvent être lues par une voix française de synthèse, **pas par la vraie voix des personnes**. Les voix et intonations peuvent varier selon les moteurs vocaux Android ; elles ne sont pas garanties sur tous les navigateurs. De très courts sons vocaux synthétiques locaux sont fournis comme secours.
- **Options dans le menu** : bruitages et voix activés par défaut sur une nouvelle installation, interrupteurs indépendants, bouton « Tester les sons et les voix ».
- **Multijoueur** : chaque téléphone reproduit les effets localement lorsque Firebase confirme un tir. Aucune vidéo ni audio en direct n'est transmis : pas de modification des règles Firebase nécessaire depuis la V0.7.
- Aucun changement apporté aux règles des points, à la sensibilité ou aux règles du 301/501.

## Tester gratuitement la démo HTML

Télécharger `Darts_Friends_Demo_V09.html`, puis l'ouvrir directement dans Chrome ou Edge : le mode solo est fonctionnel sans Internet ni serveur. Le bouton « Voir le triple 20 au ralenti » permet de tester le vol, l'impact et « Tocar ! ». Le bouton « Tester les sons et les voix » permet de vérifier le volume sur le téléphone.

**Important** : le navigateur Android peut bloquer les sons avant un premier toucher. Appuyer sur le bouton de démonstration ou commencer à jouer active l'audio. Vérifier aussi le volume multimédia et que les cases « Sons réalistes » / « Voix des copains » sont cochées ; une préférence d'une ancienne version peut avoir été conservée.

## Installer la mise à jour sur GitHub Pages (jeu à distance)

Adresse actuelle : https://schevalard38460-stack.github.io/dartiflette/
Dépôt existant : https://github.com/schevalard38460-stack/dartiflette

1. Télécharger et décompresser `Darts_Friends_V09_Android_En_Ligne.zip`.
2. Dans le dépôt Dartiflette, déposer/remplacer les fichiers et dossiers contenus dans le ZIP **à la racine**. Ajouter notamment les nouveaux fichiers `dart-render.mjs`, `flight-path.mjs`, `audio.mjs`, `reactions.mjs` et le dossier `audio/` complet.
3. **Ne pas écraser le `firebase-config.js` déjà configuré** : le ZIP contient un fichier exemple. Conserver celui de ton site actif. Ne pas mettre de clé d'administration Firebase côté client.
4. **Ne pas modifier les règles Firebase de Realtime Database** si la V0.7 jouait correctement : cette mise à jour est visuelle et sonore. Les fichiers de règles sont conservés à titre de référence dans le ZIP ; si Firebase héberge aussi le Uno, ne pas écraser les règles combinées publiées.
5. Attendre le déploiement de GitHub Pages, puis tester en navigation privée `https://schevalard38460-stack.github.io/dartiflette/?v=9`. Pour les applications installées sur Android, fermer/recharger, voire supprimer les données de site si l'ancien cache persiste.
6. Activer les options de son sur chaque téléphone. Dans une salle multijoueur, les effets sont joués par chaque téléphone à partir du résultat reçu.

## Dossiers et scripts

- `app.mjs` : interface, visée et affichage des tirs.
- `dart-render.mjs` : rendu vectoriel d'une fléchette en plusieurs parties.
- `flight-path.mjs` : interpolation 2D cubique sans effet sur le résultat du lancer.
- `audio.mjs` : bruitages OGG et voix du navigateur.
- `audio/*.ogg` : bruitages et courtes exclamations de secours.
- `reactions.mjs` : choix déterministe du commentateur parmi les adversaires.
- `rules.mjs` : règles 301 / 501 inchangées.
- `show.mjs` : durées normales/ralenties déjà utilisées en V0.7.
- `firebase-net.mjs` : connexion et diffusion d'état Firebase existantes.

## Vérifications

- Tests Node de la V0.8 + tests de non-régression de l’orientation (y compris courbure, fléchettes personnalisées, répliques et absence de modification des scores).
- Démo HTML autonome ouverte dans Chromium aux tailles 390×844, 360×640 et 1280×800 : pas d'erreur JavaScript, tir triple 20 et bulle « Tocar ! » vérifiés.
- Clips OGG produits localement et contrôlés avec ffprobe. Qualité sonore à ajuster éventuellement après essai sur un vrai Android.
- Connexion réelle entre plusieurs Android via Firebase **non retestée** dans cet environnement. Aucun APK natif n'est livré : il s'agit d'une PWA Android (installation depuis Chrome).
