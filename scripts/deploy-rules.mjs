import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {cert,initializeApp,getApps} from 'firebase-admin/app';
import {getSecurityRules} from 'firebase-admin/security-rules';

const status={project:'pospolyvalent',attempted:false,firestore:'not-tested',storage:'not-tested',errorCode:null};
if(process.env.MAMOUN_DEPLOY_RULES_ON_BUILD==='yes'){
 status.attempted=true;
 try{
  const projectId='pospolyvalent',bucket='pospolyvalent.firebasestorage.app';
  if(process.env.VERCEL_ENV!=='production')throw Error('not-production');
  if(process.env.FIREBASE_PROJECT_ID!==projectId||process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!==projectId)throw Error('project-mismatch');
  if(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!==bucket)throw Error('bucket-mismatch');
  const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if(!raw)throw Error('missing-admin-credentials');
  let account;try{account=JSON.parse(raw)}catch{throw Error('invalid-admin-json')}
  if(account.project_id!==projectId||!account.private_key||!account.client_email)throw Error('wrong-project-credentials');
  const app=getApps()[0]||initializeApp({credential:cert(account),projectId,storageBucket:bucket});
  const rules=getSecurityRules(app);
  const firestoreSource=await readFile(resolve('firestore.rules'),'utf8');
  const storageSource=await readFile(resolve('storage.rules'),'utf8');
  try{
   await rules.releaseFirestoreRulesetFromSource(firestoreSource);
   status.firestore='released';
  }catch(error){
   status.firestore='failed';
   status.errorCode=String(error.code||error.name||'firestore-error').slice(0,80);
   console.error('Firestore rules release error:',status.errorCode,String(error.message||'').slice(0,220));
  }
  try{
   await rules.releaseStorageRulesetFromSource(storageSource,bucket);
   status.storage='released';
  }catch(error){
   status.storage='failed';
   status.errorCode=String(error.code||error.name||'storage-error').slice(0,80);
   status.storageError=String(error.message||'Firebase Storage rules publication failed').slice(0,350).replace(/AIza[0-9A-Za-z_-]{30,}/g,'[redacted]');
   console.error('Storage rules release error:',status.errorCode,String(error.message||'').slice(0,220));
  }
 }catch(error){
  status.errorCode=String(error.message||error.code||'invalid-config').slice(0,80);
  console.error('Rules configuration error:',status.errorCode);
 }
}
await mkdir(resolve('public'),{recursive:true});
await writeFile(resolve('public/pos-firebase-deploy.json'),JSON.stringify(status));
console.log('Firebase rules release status:',JSON.stringify(status));
