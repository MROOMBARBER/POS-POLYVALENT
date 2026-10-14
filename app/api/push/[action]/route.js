import {NextResponse} from 'next/server';
import {getAuth} from 'firebase-admin/auth';
import {FieldValue} from 'firebase-admin/firestore';
import {getAdminDb} from '../../../../lib/firebase-admin';
import {canOperate} from '../../../../lib/subscriptions';
import {PUSH_ROLES,pushConfigAvailable,pushDocId,validSubscription} from '../../../../lib/push';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const err=(error,status=400)=>NextResponse.json({error},{status,headers});
export async function GET(request,{params}){
 const {action}=await params;
 if(action!=='config')return err('Route inconnue',404);
 return NextResponse.json({enabled:pushConfigAvailable(),publicKey:pushConfigAvailable()?process.env.WEB_PUSH_PUBLIC_KEY:null},{headers});
}
export async function POST(request,{params}){
 const {action}=await params;
 if(action!=='subscribe'&&action!=='unsubscribe')return err('Route inconnue',404);
 try{
  if(!pushConfigAvailable())return err('Notifications non configurées',503);
  const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if(!token)return err('Connexion requise',401);
  const db=getAdminDb();
  let decoded;
  try{decoded=await getAuth().verifyIdToken(token,true)}catch{return err('Session expirée',401)}
  const body=await request.json();
  const tenantId=String(body?.tenantId||'');
  if(!/^[A-Za-z0-9_-]{5,100}$/.test(tenantId))return err('Restaurant invalide',400);
  const tenantRef=db.collection('tenants').doc(tenantId);
  const [tenant,superDoc,profileDoc]=await Promise.all([
   tenantRef.get(),db.collection('superadmins').doc(decoded.uid).get(),db.collection('users').doc(decoded.uid).get()
  ]);
  if(!tenant.exists||!canOperate(tenant.data()))return err('Restaurant indisponible',403);
  let role=null;
  const owner=superDoc.exists&&superDoc.data()?.enabled===true;
  const profile=profileDoc.data();
  if(owner)role='owner';
  else if(profileDoc.exists&&profile.active===true&&profile.tenantId===tenantId&&['waiter','admin'].includes(profile.role))role=profile.role;
  if(!PUSH_ROLES.includes(role))return err('Accès interdit',403);
  const s=body?.subscription;
  if(!validSubscription(s))return err('Abonnement de notification invalide',400);
  const ref=tenantRef.collection('pushSubscriptions').doc(pushDocId(s.endpoint));
  if(action==='unsubscribe'){
   const old=await ref.get();
   if(old.exists&&old.data()?.uid===decoded.uid)await ref.delete();
   return NextResponse.json({ok:true},{headers});
  }
  const exists=await ref.get();
  // The same browser endpoint can be re-linked after staff switches accounts on a shared device.
  // Only the physically held browser subscription (including its keys) may be re-registered.
  if(exists.exists&&exists.data()?.uid!==decoded.uid&&(
    exists.data()?.keys?.auth!==s.keys.auth||exists.data()?.keys?.p256dh!==s.keys.p256dh
  ))return err('Cet appareil est déjà lié à un autre compte',409);
  const active=await tenantRef.collection('pushSubscriptions').where('uid','==',decoded.uid).limit(8).get();
  if(!exists.exists&&active.size>=5)return err('Maximum 5 appareils. Retirez un ancien abonnement.',429);
  await ref.set({uid:decoded.uid,role,endpoint:s.endpoint,keys:{p256dh:s.keys.p256dh,auth:s.keys.auth},
   updatedAt:FieldValue.serverTimestamp(),createdAt:exists.exists?(exists.data()?.createdAt||FieldValue.serverTimestamp()):FieldValue.serverTimestamp()});
  return NextResponse.json({ok:true},{headers});
 }catch(e){console.error('push registration',e?.code||e?.name||'unknown');return err('Service de notification indisponible',503)}
}
