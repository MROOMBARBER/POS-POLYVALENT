import {NextResponse} from 'next/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
/**
 * This is a configuration inventory, NOT a live Firestore/Storage test.
 * Do not expose any credentials or personal information.
 */
export async function GET(){
 const id=process.env.FIREBASE_PROJECT_ID||process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
 const webKeys=['NEXT_PUBLIC_FIREBASE_API_KEY','NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN','NEXT_PUBLIC_FIREBASE_PROJECT_ID','NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET','NEXT_PUBLIC_FIREBASE_APP_ID'];
 const webConfigured=webKeys.every(key=>Boolean(process.env[key]));
 let adminConfigured=false,projectMatches=false;
 try{
  const credentials=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if(credentials){
   const service=JSON.parse(credentials);
   projectMatches=Boolean(id && service.project_id===id);
   adminConfigured=projectMatches && Boolean(service.client_email&&service.private_key);
  }
 }catch{ /* Do not reveal credential errors publicly */ }
 return NextResponse.json({
  application:'MAMOUN POS',firebaseProject:id||null,
  webConfigured,adminConfigured,projectMatches,
  servicesVerified:false,
  message:adminConfigured?'Configuration présente; vérification live des services requise.':'Configuration Firebase Admin manquante ou non valide.'
 },{headers:{'Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff'}});
}
