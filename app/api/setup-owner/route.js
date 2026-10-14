import {NextResponse} from 'next/server';
import {FieldValue} from 'firebase-admin/firestore';
import {getAuth} from 'firebase-admin/auth';
import {getAdminDb} from '../../../lib/firebase-admin';

export const runtime='nodejs';
export const dynamic='force-dynamic';

function reply(message,status=400){
 return NextResponse.json({error:message},{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
export async function POST(request){
 try{
  const expectedEmail=(process.env.MAMOUN_OWNER_EMAIL||'').trim().toLowerCase();
  if(!expectedEmail||!expectedEmail.includes('@'))return reply('Activation du propriétaire non configurée',503);
  const authorization=request.headers.get('authorization')||'';
  if(!authorization.startsWith('Bearer '))return reply('Connexion requise',401);
  let decoded;
  try{decoded=await getAuthForRequest().verifyIdToken(authorization.slice(7),true)}
  catch{return reply('Connexion expirée',401)}
  const account=await getAuthForRequest().getUser(decoded.uid);
  if(account.disabled||!account.email||account.email.toLowerCase()!==expectedEmail)return reply('Compte non autorisé',403);
  if(!account.emailVerified)return reply('Vérifiez votre adresse e-mail avant activation',403);
  const db=getAdminDb();
  const marker=db.doc('system/ownerBootstrap');
  const owner=db.doc('superadmins/'+account.uid);
  try{
   await db.runTransaction(async tx=>{
    const prev=await tx.get(marker);
    if(prev.exists)throw Object.assign(new Error('Installation déjà terminée'),{isComplete:true});
    tx.create(owner,{enabled:true,email:expectedEmail,createdAt:FieldValue.serverTimestamp()});
    tx.create(marker,{uid:account.uid,createdAt:FieldValue.serverTimestamp()});
   });
  }catch(e){if(e.isComplete)return reply('Le propriétaire est déjà activé',409);throw e}
  return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 }catch(e){
  console.error('owner bootstrap',e?.code||e?.name||'unknown');
  return reply('Service indisponible',503);
 }
}
function getAuthForRequest(){
 // Ensure credentials are validated against the strictly pinned pospolyvalent project
 getAdminDb();
 return getAuth();
}
