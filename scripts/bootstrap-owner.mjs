/**
 * One-time, operator-only owner provisioning.
 * Usage: FIREBASE_SERVICE_ACCOUNT_JSON=<secure secret> node scripts/bootstrap-owner.mjs owner@email.com
 * Never run this script in the browser, with a public token, or with credentials in source control.
 */
import {initializeApp,cert,getApps} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';

const project='pospolyvalent';
const email=process.argv[2]?.trim()?.toLowerCase();
if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
 console.error('Usage: node scripts/bootstrap-owner.mjs email@example.com');
 process.exit(2);
}
const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if(!raw){console.error('FIREBASE_SERVICE_ACCOUNT_JSON is required.');process.exit(2)}
let credentials;
try{credentials=JSON.parse(raw)}catch{console.error('Invalid credential JSON');process.exit(2)}
if(credentials.project_id!==project){console.error('Refusing cross-project operation: expected '+project);process.exit(2)}
if(!getApps().length)initializeApp({credential:cert(credentials),projectId:project});
try{
 const account=await getAuth().getUserByEmail(email);
 if(account.disabled)throw Error('Owner account is disabled');
 await getFirestore().collection('superadmins').doc(account.uid).set({
  enabled:true,email:account.email,grantedAt:FieldValue.serverTimestamp()
 },{merge:true});
 console.log('Super Admin enabled for existing Firebase Auth user in '+project);
}catch(error){console.error('Owner provisioning failed:',error.code||error.message);process.exitCode=1}
