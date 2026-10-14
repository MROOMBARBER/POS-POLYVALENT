import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {cert,initializeApp,getApps} from 'firebase-admin/app';
import {getSecurityRules} from 'firebase-admin/security-rules';

// One-time, tightly scoped deployment during an explicitly flagged Vercel production build.
// This never deploys to any project other than the standalone POS Firebase project.
if(process.env.MAMOUN_DEPLOY_RULES_ON_BUILD!=='yes'){
 console.log('Firebase rules release: skipped (flag disabled).');
 process.exit(0);
}
const projectId='pospolyvalent';
const bucket='pospolyvalent.firebasestorage.app';
if(process.env.VERCEL_ENV!=='production')throw Error('Rules release only allowed in Vercel production');
if(process.env.FIREBASE_PROJECT_ID!==projectId||process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!==projectId)throw Error('Firebase project ID mismatch');
if(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!==bucket)throw Error('Firebase bucket mismatch');
const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if(!raw)throw Error('Firebase service credentials missing');
let account;
try{account=JSON.parse(raw)}catch{throw Error('Invalid service account JSON')}
if(account.project_id!==projectId||!account.private_key||!account.client_email)throw Error('Firebase service account project mismatch');
const app=getApps()[0]||initializeApp({credential:cert(account),projectId,storageBucket:bucket});
const rules=getSecurityRules(app);
const firestoreSource=await readFile(resolve('firestore.rules'),'utf8');
const storageSource=await readFile(resolve('storage.rules'),'utf8');
console.log('Publishing Firestore rules to',projectId);
await rules.releaseFirestoreRulesetFromSource(firestoreSource);
console.log('Firestore rules released.');
console.log('Publishing Storage rules to',bucket);
await rules.releaseStorageRulesetFromSource(storageSource,bucket);
console.log('Storage rules released.');
