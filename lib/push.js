import 'server-only';
import {createHash} from 'node:crypto';
import webpush from 'web-push';

export const PUSH_ROLES=['waiter','admin','owner'];
export function pushConfigAvailable(){
 return Boolean(process.env.WEB_PUSH_PUBLIC_KEY&&process.env.WEB_PUSH_PRIVATE_KEY&&process.env.WEB_PUSH_SUBJECT);
}
export function pushEndpointAllowed(endpoint){
 try{
  const u=new URL(endpoint);
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.search.length>1000||u.href.length>2050)return false;
  const h=u.hostname.toLowerCase();
  return h==='fcm.googleapis.com'||h==='updates.push.services.mozilla.com'||h==='push.services.mozilla.com'||
    h==='web.push.apple.com'||h.endsWith('.push.apple.com')||
    h.endsWith('.notify.windows.com')||h.endsWith('.notify.microsoft.com');
 }catch{return false}
}
export function pushDocId(endpoint){return createHash('sha256').update(endpoint).digest('hex')}
export function validSubscription(s){
 return s&&typeof s==='object'&&pushEndpointAllowed(s.endpoint)&&
  typeof s.keys?.p256dh==='string'&&/^[A-Za-z0-9_-]{60,160}$/.test(s.keys.p256dh)&&
  typeof s.keys?.auth==='string'&&/^[A-Za-z0-9_-]{12,70}$/.test(s.keys.auth);
}
function enable(){
 if(!pushConfigAvailable())return false;
 webpush.setVapidDetails(process.env.WEB_PUSH_SUBJECT,process.env.WEB_PUSH_PUBLIC_KEY,process.env.WEB_PUSH_PRIVATE_KEY);
 return true;
}
/**
 * Best-effort tenant-isolated push to active waiters/admins/opted-in owner.
 * Each subscription is verified against current user records at send time.
 * Never let a push delivery failure invalidate a customer's call request.
 */
export async function notifyWaiters(tenantRef,{type,tableName,paymentMethod,items=[]}){
 if(!enable())return {sent:0,disabled:true};
 try{
  const db=tenantRef.firestore;
  const all=await tenantRef.collection('pushSubscriptions').limit(80).get();
  const ownerCache=new Map(),userCache=new Map();
  let sent=0;
  await Promise.allSettled(all.docs.map(async doc=>{
   const sub=doc.data(),uid=String(sub.uid||'');
   if(!PUSH_ROLES.includes(sub.role)||!uid||!validSubscription(sub))return;
   let valid=false;
   if(sub.role==='owner'){
    if(!ownerCache.has(uid))ownerCache.set(uid,db.collection('superadmins').doc(uid).get());
    const snap=await ownerCache.get(uid);
    valid=snap.exists&&snap.data()?.enabled===true;
   }else{
    if(!userCache.has(uid))userCache.set(uid,db.collection('users').doc(uid).get());
    const snap=await userCache.get(uid),p=snap.data();
    valid=snap.exists&&p?.active===true&&p?.tenantId===tenantRef.id&&p?.role===sub.role;
   }
   if(!valid)return;
   const title=type==='order'?'Nouvelle commande':type==='bill'?'Addition demandée':'Appel serveur';
   const summary=Array.isArray(items)?items.slice(0,4).map(i=>String(i.qty||1)+'× '+String(i.name||'Article').slice(0,35)).join(', ').slice(0,135):'';
   const body=type==='order'?tableName+' · '+(summary||'Nouvelle commande à préparer'):type==='bill'?tableName+' · '+(paymentMethod==='card'?'Paiement TPE':'Paiement espèces'):tableName+' · Le client appelle un serveur';
   try{
    await webpush.sendNotification({endpoint:sub.endpoint,keys:sub.keys},
     JSON.stringify({title,body,url:'/?view=serveur',tag:'mamoun-'+tenantRef.id+'-'+Date.now()}),
     {TTL:90,urgency:'high',timeout:6000});
    sent++;
   }catch(e){
    if(e.statusCode===404||e.statusCode===410){await doc.ref.delete().catch(()=>{});}
    else console.error('push delivery',e.statusCode||e.code||'unknown');
   }
  }));
  return {sent};
 }catch(e){console.error('tenant push dispatch',e.code||e.name||'unknown');return {sent:0,error:true}}
}

/** Device test only: send a notification exclusively to this authenticated staff member. */
export async function sendTestWaiterPush(tenantRef,uid){
 if(!enable())return {registered:0,sent:0,disabled:true};
 const snap=await tenantRef.collection('pushSubscriptions').where('uid','==',uid).limit(6).get();
 const subscriptions=snap.docs.filter(d=>validSubscription(d.data()));
 let sent=0;
 await Promise.allSettled(subscriptions.map(async doc=>{
  const sub=doc.data();
  try{
   await webpush.sendNotification({endpoint:sub.endpoint,keys:sub.keys},
    JSON.stringify({title:'MAMOUN POS · Test réussi',body:'Les notifications du serveur sont activées sur cet appareil.',url:'/?view=serveur',tag:'mamoun-test-'+Date.now()}),
    {TTL:90,urgency:'high',timeout:6000});
   sent++;
  }catch(e){
   if(e.statusCode===404||e.statusCode===410)await doc.ref.delete().catch(()=>{});
   else console.error('test push rejected',e.statusCode||e.code||'unknown');
  }
 }));
 return {registered:subscriptions.length,sent};
}
