// Read-only, explicitly flagged diagnostic of POS Firebase Cloud Storage.
// Prints only project-bucket names; never writes files, provisions billing, or exposes credentials.
import {cert,initializeApp,getApps} from 'firebase-admin/app';
import {getStorage} from 'firebase-admin/storage';
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const report={project:'pospolyvalent',attempted:false,result:'not-requested',matchingBuckets:[],configuredBucket:null,configuredBucketExists:false};
if(process.env.MAMOUN_DISCOVER_STORAGE_ON_BUILD==='yes'){
 report.attempted=true;
 try{
  const project='pospolyvalent';
  if(process.env.VERCEL_ENV!=='production' || process.env.FIREBASE_PROJECT_ID!==project || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!==project)throw Error('project-mismatch');
  let credentials;
  try{credentials=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON||'{}')}catch{throw Error('invalid-credentials')}
  if(credentials.project_id!==project||!credentials.client_email||!credentials.private_key)throw Error('wrong-service-account');
  const bucketName=String(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET||'');
  report.configuredBucket=bucketName.replace(/[^a-zA-Z0-9._-]/g,'').slice(0,120);
  const app=getApps()[0]||initializeApp({credential:cert(credentials),projectId:project,storageBucket:bucketName});
  const storage=getStorage(app).bucket(bucketName).storage;
  try{
   const [buckets]=await storage.getBuckets({project,maxResults:50,autoPaginate:false});
   report.matchingBuckets=buckets.map(b=>b.name).filter(n=>n.startsWith(project+'.')||n===project).slice(0,20);
   report.result='list-success';
  }catch(e){
   report.result='bucket-list-not-authorized';
   report.listErrorCode=String(e.code||e.name||'unknown').slice(0,45);
  }
  try{
   await getStorage(app).bucket(bucketName).getMetadata();
   report.configuredBucketExists=true;
   if(report.result==='bucket-list-not-authorized')report.result='configured-bucket-confirmed';
  }catch(e){report.metadataErrorCode=String(e.code||e.name||'unknown').slice(0,45)}
  if(report.result==='list-success'&&report.matchingBuckets.length===0)report.result='no-pos-project-bucket';
 }catch(e){report.result=String(e.message||'failed').slice(0,100)}
}
await mkdir(resolve('public'),{recursive:true});
await writeFile(resolve('public/pos-storage-discovery.json'),JSON.stringify(report));
console.log('MAMOUN POS Storage bucket inventory:',report.result,report.configuredBucketExists);
