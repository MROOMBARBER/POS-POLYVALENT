import {NextResponse} from 'next/server';
import {getAuth} from 'firebase-admin/auth';
import {FieldValue,Timestamp} from 'firebase-admin/firestore';
import {getAdminDb} from '../../../../lib/firebase-admin';
import {normalizeSubscription,subscriptionStatus,moroccoExpiryExclusive} from '../../../../lib/subscriptions';

export const runtime='nodejs';
export const dynamic='force-dynamic';
function error(message,status=400){return NextResponse.json({error:message},{status,headers:{'Cache-Control':'no-store'}})}
export async function POST(request){
 try{
  const header=request.headers.get('authorization')||'';
  if(!header.startsWith('Bearer '))return error('Authentification requise',401);
  const db=getAdminDb();
  let auth;
  try{auth=await getAuth().verifyIdToken(header.slice(7),true)}catch{return error('Session expirée',401)}
  const owner=await db.doc('superadmins/'+auth.uid).get();
  if(!owner.exists||owner.data()?.enabled!==true)return error('Réservé au Super Admin',403);
  const input=await request.json();
  const tenantId=String(input?.tenantId||'');
  if(!/^[A-Za-z0-9_-]{5,100}$/.test(tenantId))return error('Établissement invalide',400);
  let subscription;
  try{subscription=normalizeSubscription(input?.subscription)}catch(e){return error(e.message,400)}
  const tenantRef=db.doc('tenants/'+tenantId);
  let newState;
  const today=new Date();
  try{
   newState=await db.runTransaction(async transaction=>{
    const tenant=await transaction.get(tenantRef);
    if(!tenant.exists)throw Object.assign(new Error('Établissement introuvable'),{status:404});
    const old=tenant.data()||{};
    if(old.isDemo===true)throw Object.assign(new Error('Le café de démonstration reste gratuit'),{status:409});
    if(old.status!=='active')throw Object.assign(new Error('Réactivez cet établissement avant de modifier son abonnement'),{status:409});
    const prior=old.subscription||null;
    const next={...subscription,expiresAt:subscription.status==='active'?Timestamp.fromMillis(moroccoExpiryExclusive(subscription.endsOn)):null,updatedAt:FieldValue.serverTimestamp(),updatedBy:auth.uid};
    const eventRef=tenantRef.collection('subscriptionEvents').doc();
    transaction.update(tenantRef,{subscription:next});
    transaction.create(eventRef,{
     action:prior?'updated':'created',
     previousStatus:prior?.status||'legacy',previousEndsOn:prior?.endsOn||null,
     nextStatus:next.status,nextEndsOn:next.endsOn,
     priceMad:next.priceMad,changedBy:auth.uid,createdAt:FieldValue.serverTimestamp()
    });
    return subscriptionStatus({...old,subscription:next},today);
   });
  }catch(e){if(e.status)return error(e.message,e.status);throw e}
  return NextResponse.json({ok:true,status:newState},{headers:{'Cache-Control':'no-store'}});
 }catch(e){
  console.error('subscription admin',e?.code||e?.name||'unknown');
  return error('Service indisponible',503);
 }
}
