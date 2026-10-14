import {NextResponse} from 'next/server';
import {getAuth as getAdminAuth} from 'firebase-admin/auth';
import {FieldValue} from 'firebase-admin/firestore';
import {getAdminDb} from '../../../../lib/firebase-admin';
import {canOperate} from '../../../../lib/subscriptions';
export const runtime='nodejs';
const error=(message,status=400)=>NextResponse.json({error:message},{status});
const clean=(x,n=200)=>String(x||'').trim().slice(0,n);
async function access(req,tenantId){const db=getAdminDb();const token=req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];if(!token)return null;let decoded;try{decoded=await getAdminAuth().verifyIdToken(token,true)}catch{return null}const superDoc=await db.collection('superadmins').doc(decoded.uid).get();const owner=superDoc.exists&&superDoc.data()?.enabled===true;const profile=await db.collection('users').doc(decoded.uid).get();const user=profile.exists?profile.data():null;if(!owner&&(!user||!user.active||user.tenantId!==tenantId))return null;const tenant=await db.collection('tenants').doc(tenantId).get();if(!tenant.exists||tenant.data()?.status!=='active')return null;return {db,owner,user,uid:decoded.uid,subscriptionAllowed:canOperate(tenant.data())};}
export async function POST(req,{params}){
 try{const {action}=await params;const body=await req.json();const tenantId=clean(body.tenantId,100);if(!/^[\w-]{5,100}$/.test(tenantId))return error('Établissement invalide');const a=await access(req,tenantId);if(!a)return error('Accès interdit',403);
 if(action==='create-account'){
  if(!a.owner&&!a.subscriptionAllowed)return error('Abonnement expiré : contactez le Super Admin',402);
  if(!a.owner&&a.user?.role!=='admin')return error('Accès interdit',403);
  const role=clean(body.role,16);if(!['admin','waiter','cashier','kitchen'].includes(role)||(!a.owner&&role==='admin'))return error('Rôle interdit');
  const email=clean(body.email,254).toLowerCase(),password=String(body.password||''),name=clean(body.name,100);if(!email.includes('@')||password.length<8||password.length>128||!name)return error('Email, nom et mot de passe de 8 caractères minimum requis');
  const record=await getAdminAuth().createUser({email,password,displayName:name,disabled:false});try{await a.db.collection('users').doc(record.uid).set({tenantId,email,role,name,active:true,createdAt:FieldValue.serverTimestamp()});}catch(e){await getAdminAuth().deleteUser(record.uid);throw e}return NextResponse.json({ok:true,uid:record.uid});
 }
 if(action==='order'){
  if(!a.subscriptionAllowed)return error('Abonnement expiré : contactez le Super Admin',402);
  if(a.user?.role==='kitchen'&&!a.owner)return error('Accès interdit',403);
  if(!Array.isArray(body.items)||!body.items.length||body.items.length>40)return error('Panier invalide');
  const ref=a.db.collection('tenants').doc(tenantId),tableId=clean(body.tableId,100);let tableName='Comptoir';if(tableId!=='counter'){const t=await ref.collection('tables').doc(tableId).get();if(!t.exists||t.data().active===false)return error('Table inconnue');tableName=clean(t.data().name)}
  const ids=[...new Set(body.items.map(i=>clean(i.id,150)))];const snaps=await Promise.all(ids.map(id=>ref.collection('products').doc(id).get()));const products=new Map(snaps.filter(s=>s.exists&&s.data().active!==false).map(s=>[s.id,s.data()]));let total=0;const items=[];for(const entry of body.items){const p=products.get(clean(entry.id,150)),qty=Number(entry.qty);if(!p||!Number.isInteger(qty)||qty<1||qty>30||!Number.isFinite(p.price)||p.price<0)return error('Article invalide');const line=Math.round(p.price*qty*100)/100;items.push({productId:clean(entry.id,150),name:clean(p.name,160),unitPrice:p.price,qty,total:line});total+=line}total=Math.round(total*100)/100;
  const order=await ref.collection('orders').add({tableId,tableName,items,total,source:'staff',status:'pending',createdBy:a.uid,paymentMethod:'',createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});return NextResponse.json({ok:true,id:order.id,total});
 }
 return error('Route inconnue',404);
 }catch(e){console.error('staff action',e?.code||e?.message);return error('Service indisponible',503)}
}
