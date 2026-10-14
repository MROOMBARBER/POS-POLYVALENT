// Explicitly enabled, one-time Firebase demo data provisioning (MAMOUN POS ONLY).
// No secrets, private credentials, or owner identity are stored in this repository.
import {cert,getApps,initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {FieldValue,getFirestore} from 'firebase-admin/firestore';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const report={project:'pospolyvalent',tenantId:'mamoun-cafe-test',attempted:false,result:'not-requested'};
if(process.env.MAMOUN_CREATE_TEST_CAFE_ON_BUILD==='yes'){
 report.attempted=true;
 try{
  if(process.env.VERCEL_ENV!=='production')throw Error('not-production');
  if(process.env.FIREBASE_PROJECT_ID!=='pospolyvalent'||process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!=='pospolyvalent')throw Error('wrong-firebase-project');
  const uid=process.env.MAMOUN_OWNER_UID||'';
  const email=String(process.env.MAMOUN_OWNER_EMAIL||'').trim().toLowerCase();
  if(!/^[a-zA-Z0-9_-]{10,128}$/.test(uid)||!email.includes('@'))throw Error('owner-config-missing');
  let credentials;
  try{credentials=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON||'{}')}catch{throw Error('bad-credentials-format')}
  if(credentials.project_id!=='pospolyvalent'||!credentials.private_key||!credentials.client_email)throw Error('wrong-service-project');
  const app=getApps()[0]||initializeApp({credential:cert(credentials),projectId:'pospolyvalent'});
  const account=await getAuth(app).getUser(uid);
  if(account.disabled||!account.emailVerified||account.email?.toLowerCase()!==email)throw Error('owner-identity-not-verified');
  const db=getFirestore(app);
  const owner=await db.doc('superadmins/'+uid).get();
  if(!owner.exists||owner.data()?.enabled!==true||owner.data()?.email!==email)throw Error('owner-not-active');
  const tenant=db.doc('tenants/mamoun-cafe-test');
  const data={
   name:'MAMOUN CAFÉ TEST',
   subtitle:'Espace de démonstration — commandes de test uniquement',
   logo:'',cover:'',accent:'#c76d45',address:'',phone:'',currency:'MAD',
   status:'active',isDemo:true,createdAt:FieldValue.serverTimestamp()
  };
  const sampleProducts=[
   ['espresso-test',{name:'Espresso (TEST)',description:'Produit de démonstration',category:'Cafés',image:'',price:15,active:true}],
   ['cappuccino-test',{name:'Cappuccino (TEST)',description:'Produit de démonstration',category:'Cafés',image:'',price:22,active:true}],
   ['jus-orange-test',{name:'Jus d’orange (TEST)',description:'Produit de démonstration',category:'Jus',image:'',price:25,active:true}]
  ];
  const sampleTables=[['table-01',{name:'Table 01 (TEST)',active:true}],['table-02',{name:'Table 02 (TEST)',active:true}]];
  report.result=await db.runTransaction(async tx=>{
   const exists=await tx.get(tenant);
   if(exists.exists){
    if(exists.data()?.name!=='MAMOUN CAFÉ TEST'||exists.data()?.isDemo!==true)throw Error('tenant-id-conflict');
    return 'already-exists';
   }
   tx.create(tenant,data);
   for(const [id,item] of sampleProducts)tx.create(tenant.collection('products').doc(id),item);
   for(const [id,item] of sampleTables)tx.create(tenant.collection('tables').doc(id),item);
   return 'created';
  });
  report.products=sampleProducts.length;
  report.tables=sampleTables.length;
 }catch(err){
  const known=['not-production','wrong-firebase-project','owner-config-missing','bad-credentials-format','wrong-service-project','owner-identity-not-verified','owner-not-active','tenant-id-conflict'];
  const key=String(err.code||err.message||'firebase-failure');
  report.result=known.includes(key)?key:'firebase-failure';
  console.error('Demo tenant creation error:',report.result);
 }
}
await mkdir(resolve('public'),{recursive:true});
await writeFile(resolve('public/pos-demo-tenant-status.json'),JSON.stringify(report));
console.log('Demo tenant:',report.result);
