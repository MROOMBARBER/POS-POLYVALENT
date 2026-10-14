# MAMOUN POS — réseau de cafés et restaurants

Projet séparé de tous les anciens projets.
- GitHub : https://github.com/MROOMBARBER/POS-POLYVALENT
- Production : https://pos-polyvalent.vercel.app
- Firebase : pospolyvalent

## Vérification de l'installation (14 octobre 2026)
- Le déploiement Vercel est READY.
- Configuration Firebase Web et credentials Firebase Admin présents et correspondant à pospolyvalent.
- Les règles Firestore ont été publiées avec succès via Firebase Admin SDK.
- Les règles Storage n'ont pas été publiées : refus Firebase lors de la tentative.
- **Diagnostic confirmé : le bucket pospolyvalent.firebasestorage.app n'existe pas.** L'ancien nom pospolyvalent.appspot.com ne répond pas non plus. Le Storage doit être réellement provisionné dans la console Firebase, avec facturation Blaze si nécessaire. Ne pas considérer le téléchargement d'images comme fonctionnel avant création du bucket et test d'une image réelle.
- Un endpoint authentifié `POST /api/staff-upload` est prêt à gérer des photos sur le serveur (types JPEG/PNG/WebP/GIF, maximum 3,5 Mo) et à vérifier le rôle du personnel et l'établissement. Il est indépendant des règles Storage côté client mais dépend d'un bucket réel et des permissions Google Cloud Storage.
- L'activation initiale du Super Admin se fait sur `/setup-owner` et nécessite `MAMOUN_OWNER_EMAIL` dans l'environnement Production, égal à l'e-mail vérifié dans Firebase Authentication. Elle est verrouillée par une transaction Firestore à usage unique. Aucun e-mail propriétaire n'a été désigné à ce jour.
- Les options temporaires `MAMOUN_DEPLOY_RULES_ON_BUILD` et `MAMOUN_PROBE_STORAGE_ON_BUILD` sont désactivées sur Vercel.

## Procédure de finalisation
1. Ouvrir https://console.firebase.google.com/project/pospolyvalent/storage et créer réellement le bucket par défaut (la version Blaze peut être exigée), puis vérifier l'onglet « Fichiers » et le nom exact.
2. Configurer la variable Vercel `MAMOUN_OWNER_EMAIL` (Production uniquement). Ne jamais enregistrer de mot de passe ou clé privée dans GitHub.
3. Sur https://pos-polyvalent.vercel.app/setup-owner : créer le compte, vérifier l'adresse e-mail via Firebase, puis choisir « Activer mon compte ». Seule l'adresse e-mail autorisée peut être Super Admin.
4. Tester une vraie connexion, créer deux établissements, ajouter leurs administrateurs, leurs tables et leurs produits; vérifier que les données de chaque établissement sont séparées et que leurs QR fonctionnent.
5. Tester un vrai upload de logo/photo avec le nouveau backend, puis passer une commande, vérifier la cuisine, le paiement marqué et l'appel serveur.
6. Tester les scénarios adverses et le taux limite public avant l'ouverture à de nombreux restaurants.

## Sécurité
- `FIREBASE_SERVICE_ACCOUNT_JSON` : variable chiffrée/sensible de Vercel, côté serveur exclusivement; le backend vérifie que `project_id` correspond à `pospolyvalent`.
- Aucune clé privée ne doit être copiée dans le dépôt.
- En l'absence de bucket réel, la fonction photo ne peut pas réussir.
- Le champ TPE signifie demande au serveur d'apporter son terminal de paiement, pas encaissement TPE intégré.
- Pour commercialiser à grande échelle : sauvegardes, limitation des abus par identité/IP, vérification des permissions et des journaux, impression fiscale applicable et tests d'isolation multi-tenants.
