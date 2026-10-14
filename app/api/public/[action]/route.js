import {NextResponse,after} from 'next/server';
import {FieldValue} from 'firebase-admin/firestore';
import {getAdminDb} from '../../../../lib/firebase-admin';
import {canOperate} from '../../../../lib/subscriptions';
import {notifyWaiters} from '../../../../lib/push';
export const runtime='nodejs';
export const dynamic='force-dynamic';
function err(message,status=400){return NextResponse.json({error:message},{status,headers:{'Cache-Control':'no-store'}})}
function clean(s,max=250){return String(s||'').trim().slice(0,max)}
async function context(db,id){if(!/^[A-Za-z0-9_-]{5,100}$/.test(id||''))return null;const ref=db.collection('tenants').doc(id);const snap=await ref.get();if(!snap.exists||snap.data().status!=='active')return null;return {ref,tenant:snap.data()}}
export async function GET(req,{params}){
 try{
  const {action}=await params;if(action!=='menu')return err('Route inconnue',404);
  const db=getAdminDb();const id=new URL(req.url).searchParams.get('tenantId');const c=await context(db,id);if(!c)return err('Établissement indisponible',404);if(!canOperate(c.tenant))return err('Abonnement du restaurant expiré ou en attente de paiement. Contactez l’établissement.',402);
  const [products,tables]=await Promise.all([c.ref.collection('products').get(),c.ref.collection('tables').get()]);
  return NextResponse.json({tenant:{id,name:c.tenant.name,subtitle:c.tenant.subtitle||'',logo:c.tenant.logo||'',cover:c.tenant.cover||'',accent:c.tenant.accent||'#c76d45',currency:c.tenant.currency||'MAD'},products:products.docs.filter(d=>d.data().active!==false).map(d=>({id:d.id,name:d.data().name,description:d.data().description||'',price:d.data().price,category:d.data().category||'Carte',image:d.data().image||''})),tables:tables.docs.filter(d=>d.data().active!==false).map(d=>({id:d.id,name:d.data().name}))},{headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('menu',e.message);return err('Service indisponible',503)}
}
export async function POST(req,{params}){
 try{
  const {action}=await params;if(!['order','call','bill'].includes(action))return err('Route inconnue',404);
  const body=await req.json();const db=getAdminDb();const c=await context(db,body.tenantId);if(!c)return err('Établissement indisponible',404);if(!canOperate(c.tenant))return err('Abonnement du restaurant expiré ou suspendu. Contactez l’établissement.',402);
  const tableId=clean(body.tableId,100);const ts=await c.ref.collection('tables').doc(tableId).get();if(!ts.exists||ts.data().active===false)return err('Table invalide');
  const now=Date.now();const limiter=c.ref.collection('rateLimits').doc(clean(body.clientId,100)||'anonymous');
  const permitted=await db.runTransaction(async tx=>{const snap=await tx.get(limiter);const x=snap.exists?snap.data():{};const count=x.until>now?x.count||0:0;if(count>=12)return false;tx.set(limiter,{count:count+1,until:x.until>now?x.until:now+60000,updatedAt:FieldValue.serverTimestamp()});return true});
  if(!permitted)return err('Trop de demandes. Réessayez dans une minute.',429);
  if(action==='order'){
   if(!Array.isArray(body.items)||!body.items.length||body.items.length>40)return err('Panier invalide');
   const ids=[...new Set(body.items.map(i=>clean(i.id,150)))];if(ids.some(x=>!x))return err('Article invalide');
   const snaps=await Promise.all(ids.map(id=>c.ref.collection('products').doc(id).get()));const prices=new Map(snaps.filter(s=>s.exists&&s.data().active!==false).map(s=>[s.id,s.data()]));
   let total=0;const items=[];
   for(const entry of body.items){const p=prices.get(clean(entry.id,150)),qty=Number(entry.qty);if(!p||!Number.isInteger(qty)||qty<1||qty>30||!Number.isFinite(p.price)||p.price<0)return err('Article ou quantité invalide');const line=Math.round(p.price*qty*100)/100;total+=line;items.push({productId:clean(entry.id,150),name:clean(p.name,160),unitPrice:p.price,qty,total:line});}
   total=Math.round(total*100)/100;
   const id=c.ref.collection('orders').doc();await id.set({tableId,tableName:ts.data().name,items,total,status:'pending',source:'customer',note:clean(body.note,350),paymentMethod:'',createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
   // Customer order is persisted before push. A delivery failure cannot cancel the order.
   after(async()=>{try{await notifyWaiters(c.ref,{type:'order',tableName:clean(ts.data().name,100),items})}catch(e){console.error('post-order notification',e?.code||e?.name||'unknown')}});
   return NextResponse.json({ok:true,id:id.id,total});
  }
  if(action==='bill'&&!['cash','card'].includes(body.paymentMethod))return err('Mode de paiement invalide');
  const id=c.ref.collection('requests').doc();await id.set({type:action,tableId,tableName:ts.data().name,paymentMethod:action==='bill'?body.paymentMethod:'',status:'pending',createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
  after(async()=>{try{await notifyWaiters(c.ref,{type:action,tableName:clean(ts.data().name,100),paymentMethod:action==='bill'?body.paymentMethod:''})}catch(e){console.error('post-request notification',e?.code||e?.name||'unknown')}});
  return NextResponse.json({ok:true,id:id.id});
 }catch(e){console.error('public',e.message);return err('Service indisponible',503)}
}
