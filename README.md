# MAMOUN POS — POS multi-restaurants / cafés

Application Next.js + Firebase indépendante. Références exactes :
- **Source GitHub** : MROOMBARBER/POS-POLYVALENT (branche main)
- **Vercel** : pos-polyvalent — https://pos-polyvalent.vercel.app
- **Firebase** : pospolyvalent (ce projet uniquement)

## Déploiement actuel
Les variables de configuration Firebase Web (apiKey, authDomain, projectId, storageBucket, appId) sont installées dans Vercel. Cela configure le SDK client, **mais ne donne pas les droits administratifs au serveur**.

### Il reste à activer avant tout usage réel
1. Dans Firebase **pospolyvalent**, activer **Authentication > Sign-in method > Email/Password**, **Cloud Firestore** et **Storage**. Le bucket Storage peut nécessiter l'activation de la facturation.
2. Déployer les règles livrées avec ce dépôt (uniquement sur **pospolyvalent**) à partir d'un terminal administrateur authentifié :
   `firebase deploy --project pospolyvalent --only firestore:rules,storage`
3. Dans Vercel **pos-polyvalent**, définir **FIREBASE_SERVICE_ACCOUNT_JSON** comme variable d'environnement **encrypted/sensitive**, avec la clé JSON générée pour **pospolyvalent**. Ne jamais la publier dans GitHub, une conversation, ni un navigateur. L'application rejette une clé d'un autre projet.
4. Dans Firebase Authentication, créer le compte **propriétaire**, sur une adresse e-mail contrôlée. Dans un environnement de confiance ayant accès à la clé de service, exécuter :
   `node scripts/bootstrap-owner.mjs votre-email@example.com`
   Cet utilitaire nécessite **FIREBASE_SERVICE_ACCOUNT_JSON** dans son environnement sécurisé et n'autorise que le projet **pospolyvalent**.
5. Redéployer Vercel après ajout des variables, ouvrir `/api/setup-status` et vérifier les indicateurs. Cet endpoint ne teste pas à lui seul les connexions réelles.
6. Tester la connexion propriétaire, création d'un établissement, création d'un admin, modification du menu et du logo, création d'une table, parcours QR/NFC, commande client, réception en cuisine, encaissement, isolation des données entre deux établissements.

## Fonctionnalités du code
- Propriétaire (Super Admin) et comptes isolés par établissement.
- Gestion du catalogue, des prix, images, catégories, tables et identité visuelle dans le dashboard.
- Caisse POS, affichage cuisine et gestion des commandes.
- Menu public QR/NFC; ajout au panier, appel serveur et demande d'addition (espèces/TPE).
- Prix recalculés côté serveur à partir de la base. Préférence « carte » ≠ paiement TPE traité.
- Rôles : propriétaire, admin, serveur, caissier, cuisine.

## Sécurité
- Le code et les rules **ne s'appliquent à Firebase que lorsqu'elles sont déployées** : committer un fichier `.rules` dans GitHub ne les active pas.
- Garder les credentials du Firebase Admin SDK exclusivement côté serveur, chiffrés dans Vercel.
- Firebase web `apiKey` est une clé publique de configuration SDK, pas une clé d'administration. Restreindre les APIs/domaines autorisés selon les bonnes pratiques Firebase.
- Avant vente à grande échelle : App Check, protection anti-abus, sauvegardes, audit des flux de paiements, RGPD/données personnelles, tests d'isolation entre tenants et surveillance des quotas.
- Les paiements par TPE et les reçus fiscaux certifiés ne sont **pas** intégrés.

## Diagnostic
- `GET /api/setup-status` : présence de la configuration publique et Firebase Admin (sans secrets).
- Si `adminConfigured=false`, le backend des commandes publiques et de création des comptes ne peut pas fonctionner.
- `readyState=READY` sur Vercel signifie **build réussi**, pas que Firebase Authentication/Firestore/Storage fonctionnent.
