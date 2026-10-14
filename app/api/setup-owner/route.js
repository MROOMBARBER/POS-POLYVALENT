import {NextResponse} from 'next/server';
import {FieldValue} from 'firebase-admin/firestore';
import {getAuth} from 'firebase-admin/auth';
import {getAdminDb} from '../../../lib/firebase-admin';

export const runtime='nodejs';
export const dynamic='force-dynamic';

function reply(message,status=400){
 return NextResponse.json({error:message},{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
// This endpoint does NOT trust IDs or emails supplied by the browser.
// All owner identity checks are performed against verified Firebase Auth and
// the project-scoped protected Vercel configuration.
export async function POST(request){
 try{
  const expectedEmail=(process.env.MAMOUN_OWNER_EMAIL||'').trim().toLowerCase();
  const expectedUid=process.env.MAMOUN_OWNER_UID||'';
  if(!expectedEmail.includes('@')||!/^[a-zA-Z0-9_-]{10,128}$/.test(expectedUid)){
   return reply('Activation du propriétaire non configurée',503);
  }
  const authorization=request.headers.get('authorization')||'';
  if(!authorization.startsWith('Bearer '))return reply('Connexion requise',401);
  const db=getAdminDb(); // Pinned to Firebase project pospolyvalent
  const auth=getAuth();
  let decoded;
  try{decoded=await auth.verifyIdToken(authorization.slice(7),true)}
  catch{return reply('Connexion expirée',401)}
  if(decoded.uid!==expectedUid)return reply('Ce compte n’est pas le propriétaire autorisé',403);
  const account=await auth.getUser(expectedUid);
  if(account.disabled||!account.email||account.email.trim().toLowerCase()!==expectedEmail){
   return reply('Identité du propriétaire incorrecte',403);
  }
  if(!account.emailVerified)return reply('Vérifiez votre adresse e-mail avant activation',403);
  const marker=db.doc('system/ownerBootstrap');
  const owner=db.doc('superadmins/'+expectedUid);
  try{
   const state=await db.runTransaction(async tx=>{
    const [existingMarker,existingOwner,allOwners]=await Promise.all([
     tx.get(marker),tx.get(owner),tx.get(db.collection('superadmins').limit(20))
    ]);
    if(existingMarker.exists){
     if(existingMarker.data()?.uid===expectedUid&&existingOwner.exists&&existingOwner.data()?.enabled===true){
      return 'already-active';
     }
     throw Object.assign(new Error('Owner bootstrap locked'),{isComplete:true});
    }
    if(allOwners.docs.some(doc=>doc.id!==expectedUid&&doc.data()?.enabled===true)){
     throw Object.assign(new Error('A different owner exists'),{isComplete:true});
    }
    if(existingOwner.exists&&existingOwner.data()?.email&&existingOwner.data()?.email!==expectedEmail){
     throw Object.assign(new Error('Owner email mismatch'),{isComplete:true});
    }
    tx.set(owner,{enabled:true,email:expectedEmail,createdAt:FieldValue.serverTimestamp()},{merge:true});
    tx.create(marker,{uid:expectedUid,createdAt:FieldValue.serverTimestamp()});
    return 'activated';
   },{maxAttempts:3});
   return NextResponse.json({ok:true,state},{headers:{'Cache-Control':'no-store'}});
  }catch(e){if(e.isComplete)return reply('Installation déjà attribuée à un propriétaire',409);throw e}
 }catch(e){
  console.error('owner bootstrap',e?.code||e?.name||'unknown');
  return reply('Service indisponible',503);
 }
}
