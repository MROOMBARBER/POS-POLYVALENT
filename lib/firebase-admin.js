import 'server-only';
import {cert,getApps,initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';

// Never allow this multi-tenant POS to write into an unrelated Firebase project.
export function getAdminDb(){
 const expected=process.env.FIREBASE_PROJECT_ID||process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
 if(!expected)throw new Error('Firebase project ID not configured');
 const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
 if(!raw)throw new Error('Firebase Admin credentials are not configured');
 let parsed;
 try{parsed=JSON.parse(raw)}catch{throw new Error('Invalid Firebase service account JSON')}
 if(parsed.project_id!==expected)throw new Error('Firebase service account project mismatch');
 if(!getApps().length)initializeApp({credential:cert(parsed),projectId:expected});
 return getFirestore();
}
