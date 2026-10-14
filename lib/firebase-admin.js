import 'server-only';
import {cert,getApps,initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
export function getAdminDb(){
 const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
 if(!raw) throw new Error('Firebase Admin credentials are not configured');
 let parsed;try{parsed=JSON.parse(raw)}catch{throw new Error('Invalid Firebase service account JSON')}
 if(!getApps().length)initializeApp({credential:cert(parsed)});
 return getFirestore();
}
