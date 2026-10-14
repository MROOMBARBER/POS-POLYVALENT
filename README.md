# MAMOUN POS — Multi-establishment cafe and restaurant SaaS

Fresh standalone Next.js + Firebase project. No existing repositories, Firebase projects, or Vercel projects are reused.

## Features
- Platform owner sees all establishments, creates restaurant admin accounts, enables/suspends establishments.
- Restaurant admin edits logo, banner, colors, menu pictures, categories, prices and tables without touching code.
- Staff roles: kitchen, cashier, waiter; realtime order handling, restaurant POS, bill and server requests.
- Public NFC/QR menu and server-verified order totals, cash/card preference, waiter call.
- Orders and data partitioned by tenant ID with Firebase security rules.

## Setup (REQUIRED before using real accounts)
1. Create a NEW Firebase project. Enable Authentication > Email/Password, Cloud Firestore, and Storage (Firebase Storage may require a billing plan).
2. Deploy `firestore.rules` and `storage.rules` under Firebase Console > Rules. The public API uses Admin SDK and validates prices against stored products.
3. Set the 5 NEXT_PUBLIC_FIREBASE_* environment variables in Vercel from Firebase Project Settings > Web App.
4. Create a service account for this NEW Firebase project and set `FIREBASE_SERVICE_ACCOUNT_JSON` as one line of JSON in Vercel's encrypted environment variables. Never put credentials in GitHub source. Deploy again.
5. In Firebase Authentication, create your owner user with Email/Password. Copy its UID. In Firestore, create collection `superadmins`, document ID = exactly the UID; use field `enabled: true` (boolean). This step intentionally requires direct owner action to prevent anyone claiming ownership via public registration.
6. Open the Vercel app and log in with the owner account. Create cafes from the Owner dashboard. Admin accounts are created through authenticated server routes with Firebase Authentication and profile documents. There is NO public sign-up.
7. For production, set your domain; print each table's URL as QR or program it to NFC cards.

## Important production caveats
- Firebase pricing/quotas apply. Enable App Check, advanced rate limiting, backups, monitoring and automated tests before deploying at large scale.
- Only one API-layer best-effort throttle currently protects customer events; use edge WAF/App Check for abuse resistance.
- Both browser POS and public orders are server-priced. Review status transitions, refund policy, and fiscal compliance before large-scale rollout.
- Admin can delete Firebase Auth users manually; disabling a staff user is a Firestore permission revoke, not an Auth deletion. For comprehensive account removal, add secure back-office Firebase Admin API flows.
- Does not interface with payment terminals or tax-certified receipt/fiscal systems. 'Card' is a payment preference/record, not payment processing.
