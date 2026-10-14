// One-time, production-only, project-pinned Super Admin provisioning.
// No owner IDs, emails or service account secrets are committed to source.
import {cert,initializeApp,getApps} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';

const status={project:'pospolyvalent',attempted:false,result:'not-requested'};
if(process.env.MAMOUN_BOOTSTRAP_OWNER_ON_BUILD==='yes'){
 status.attempted=true;
 try{
  const project='pospolyvalent';
  if(process.env.VERCEL_ENV!=='production')throw Error('not-production');
  if(process.env.FIREBASE_PROJECT_ID!==project||process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!==project)throw Error('wrong-project');
  const uid=process.env.MAMOUN_OWNER_UID||'';
  const email=(process.env.MAMOUN_OWNER_EMAIL||'').trim().toLowerCase();
  if(!/^[a-zA-Z0-9_-]{10,128}$/.test(uid)||!email.includes('@'))throw Error('missing-owner-identity');
  const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if(!raw)throw Error('missing-admin-credentials');
  let service;
  try{service=JSON.parse(raw)}catch{throw Error('invalid-credentials-json')}
  if(service.project_id!==project||!service.client_email||!service.private_key)throw Error('wrong-service-project');
  const app=getApps()[0]||initializeApp({credential:cert(service),projectId:project});
  const auth=getAuth(app);
  const account=await auth.getUser(uid);
  if(account.disabled)throw Error('firebase-user-disabled');
  if(!account.email||account.email.toLowerCase()!==email)throw Error('owner-email-mismatch');
  if(!account.emailVerified)throw Error('owner-email-unverified');
  const db=getFirestore(app);
  const marker=db.doc('system/ownerBootstrap');
  const owner=db.doc('superadmins/'+uid);
  status.result=await db.runTransaction(async tx=>{
   const [saved,savedOwner]=await Promise.all([tx.get(marker),tx.get(owner)]);
   if(saved.exists){
    if(saved.data()?.uid!==uid)throw Error('different-owner-already-provisioned');
    if(savedOwner.exists&&savedOwner.data()?.enabled===true&&savedOwner.data()?.email===email)return 'already-active';
    throw Error('owner-bootstrap-marker-inconsistent');
   }
   const existing=await db.collection('superadmins').limit(2).get();
   if(existing.docs.some(doc=>doc.id!==uid&&doc.data()?.enabled===true))throw Error('another-active-owner-exists');
   if(savedOwner.exists&&savedOwner.data()?.email&&savedOwner.data().email!==email)throw Error('owner-record-email-mismatch');
   tx.set(owner,{enabled:true,email,createdAt:FieldValue.serverTimestamp()},{merge:true});
   tx.create(marker,{uid,createdAt:FieldValue.serverTimestamp()});
   return 'activated';
  },{maxAttempts:3});
 }catch(err){
  const allowed=['not-production','wrong-project','missing-owner-identity','missing-admin-credentials','invalid-credentials-json','wrong-service-project','firebase-user-disabled','owner-email-mismatch','owner-email-unverified','different-owner-already-provisioned','owner-bootstrap-marker-inconsistent','another-active-owner-exists','owner-record-email-mismatch'];
  const code=String(err.code||err.message||'unknown-error');
  status.result=allowed.includes(code)?code:(code==='auth/user-not-found'?'firebase-user-not-found':'firebase-error');
  console.error('Super Admin bootstrap:',status.result);
 }
}
await mkdir(resolve('public'),{recursive:true});
await writeFile(resolve('public/pos-owner-bootstrap-status.json'),JSON.stringify(status));
console.log('Super Admin setup:',status.result);
