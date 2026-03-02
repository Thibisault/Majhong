# Calcul Majhong PWA

Application web progressive (PWA) simple pour calculer `score / 2` apres chaque partie, avec historique local.

## Fonctions

- 2 champs: un positif (gain) et un negatif (perte)
- Affichage du resultat `score / 2` en grand
- Historique persistant en local avec IndexedDB:
  - date et heure
  - score saisi
  - argent gagne/perdu (`score / 2`)
  - cumul global
- Resume automatique:
  - total global
  - cumul des 5 dernieres parties
- Fonctionne hors ligne via service worker

## Lancer en local

Tu peux ouvrir `index.html` directement, mais pour un test PWA complet il vaut mieux un serveur statique.

## Publier sur GitHub Pages

1. Pousse tous les fichiers sur ton repo GitHub.
2. Sur GitHub: `Settings` -> `Pages`.
3. Source: `Deploy from a branch`.
4. Branch: `main` (ou `master`) et dossier `/ (root)`.
5. Sauvegarde.
6. Attends la publication puis ouvre l'URL GitHub Pages.

Le projet utilise uniquement des chemins relatifs (`./...`), donc il fonctionne sur GitHub Pages meme si ton repo est publie dans un sous-dossier.
