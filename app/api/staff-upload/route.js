import {NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {getAuth} from 'firebase-admin/auth';
import {getStorage,getDownloadURL} from 'firebase-admin/storage';
import {getAdminDb} from '../../../lib/firebase-admin';
import {canOperate} from '../../../lib/subscriptions';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const BUCKET='pospolyvalent.firebasestorage.app';
const allowed={ 'image/jpeg': 'jpg', 'image/png':'png', 'image/webp':'webp', 'image/gif':'gif' };
function fail(msg,status){return NextResponse.json({error:msg},{status,headers:{'Cache-Control':'no-store'}})}
function validMagic(buf,mime){
 if(mime==='image/jpeg')return buf[0]===255&&buf[1]===216&&buf[2]===255;
 if(mime==='image/png')return buf.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 if(mime==='image/gif')return buf.subarray(0,6).toString()==='GIF89a'||buf.subarray(0,6).toString()==='GIF87a';
 if(mime==='image/webp')return buf.subarray(0,4).toString()==='RIFF'&&buf.subarray(8,12).toString()==='WEBP';
 return false;
}
export async function POST(request){
 try{
  const raw=request.headers.get('authorization')||'';
  if(!raw.startsWith('Bearer '))return fail('Connexion requise',401);
  if(Number(request.headers.get('content-length')||0)>4*1024*1024)return fail('Image trop volumineuse',413);
  const db=getAdminDb();
  let user;
  try{user=await getAuth().verifyIdToken(raw.slice(7),true)}catch{return fail('Connexion expirée',401)}
  const form=await request.formData();
  const tenantId=String(form.get('tenantId')||'');
  const file=form.get('file');
  if(!/^[a-zA-Z0-9_-]{5,100}$/.test(tenantId))return fail('Établissement invalide',400);
  if(!file||typeof file.arrayBuffer!=='function')return fail('Image obligatoire',400);
  if(!allowed[file.type]||file.size<=0||file.size>3.5*1024*1024)return fail('Image JPEG, PNG, GIF ou WebP (3,5 Mo maximum)',400);
  const [owner,profile,tenant]=await Promise.all([
   db.collection('superadmins').doc(user.uid).get(),
   db.collection('users').doc(user.uid).get(),
   db.collection('tenants').doc(tenantId).get()
  ]);
  const isOwner=owner.exists&&owner.data()?.enabled===true;
  const isManager=profile.exists&&profile.data()?.active===true&&profile.data()?.role==='admin'&&profile.data()?.tenantId===tenantId;
  if(!tenant.exists||tenant.data()?.status!=='active')return fail('Établissement indisponible',404);
  if(!canOperate(tenant.data()))return fail('Abonnement expiré ou suspendu : contactez MAMOUN POS',402);
  if(!isOwner&&!isManager)return fail('Accès interdit',403);
  const bytes=Buffer.from(await file.arrayBuffer());
  if(!validMagic(bytes,file.type))return fail('Image invalide',400);
  // Cloudinary Free can host the images while Firebase Auth/Firestore stay unchanged.
  // All credentials remain server-side; tenant auth and file validation above still apply.
  const cloudName=process.env.CLOUDINARY_CLOUD_NAME||'';
  const cloudKey=process.env.CLOUDINARY_API_KEY||'';
  const cloudSecret=process.env.CLOUDINARY_API_SECRET||'';
  const cloudConfigured=[cloudName,cloudKey,cloudSecret].every(Boolean);
  if([cloudName,cloudKey,cloudSecret].some(Boolean)&&!cloudConfigured){
   return fail('Configuration Cloudinary incomplète. Vérifiez les 3 variables Vercel.',503);
  }
  if(cloudConfigured){
   if(!/^[a-zA-Z0-9_-]{2,100}$/.test(cloudName))return fail('Nom Cloudinary invalide',503);
   const payload=new FormData();
   payload.set('file',new Blob([new Uint8Array(bytes)],{type:file.type}),'image.'+allowed[file.type]);
   payload.set('folder','mamoun-pos/tenants/'+tenantId);
   payload.set('overwrite','false');
   payload.set('unique_filename','true');
   let response;
   try{
    response=await fetch('https://api.cloudinary.com/v1_1/'+encodeURIComponent(cloudName)+'/image/upload',{
     method:'POST',
     headers:{Authorization:'Basic '+Buffer.from(cloudKey+':'+cloudSecret).toString('base64')},
     body:payload,
     signal:AbortSignal.timeout(25000)
    });
   }catch(error){
    console.error('Cloudinary upload network error',error?.name||'network');
    return fail('Connexion au service de photos indisponible. Réessayez.',503);
   }
   if(!response.ok){
    console.error('Cloudinary upload rejected, HTTP',response.status);
    return fail(response.status===429?'Limite de téléversement atteinte. Réessayez plus tard.':'Service de photos temporairement indisponible. Vérifiez le compte Cloudinary.',503);
   }
   let uploaded;
   try{uploaded=await response.json()}catch{return fail('Réponse Cloudinary non valide.',503)}
   const imageUrl=String(uploaded?.secure_url||'');
   if(!imageUrl.startsWith('https://res.cloudinary.com/'+cloudName+'/')||!uploaded?.public_id){
    return fail('Lien de la photo non valide.',503);
   }
   return NextResponse.json({ok:true,url:imageUrl,provider:'cloudinary'},{headers:{'Cache-Control':'no-store'}});
  }
  const objectPath='tenants/'+tenantId+'/images/'+randomUUID()+'.'+allowed[file.type];
  const bucket=getStorage().bucket(BUCKET);
  const object=bucket.file(objectPath);
  const token=randomUUID();
  await object.save(bytes,{resumable:false,validation:'crc32c',contentType:file.type,metadata:{cacheControl:'public,max-age=3600',metadata:{firebaseStorageDownloadTokens:token}}});
  const url=await getDownloadURL(object);
  return NextResponse.json({ok:true,url},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  console.error('tenant image upload',error?.code||error?.name||'unknown');
  const code=String(error?.code||'');
  const message=String(error?.message||'');
  if(code==='404'||/specified bucket does not exist|bucket not found|not found/i.test(message)){
   return fail('Le stockage des photos n’est pas encore activé pour ce projet. Contactez le propriétaire pour terminer la création du bucket Firebase.',503);
  }
  if(code==='403'||/permission denied|does not have permission|insufficient permission/i.test(message)){
   return fail('Le serveur n’a pas la permission de stocker des images. Vérifiez les autorisations Firebase Storage.',503);
  }
  return fail('Téléversement temporairement indisponible',503);
 }
}
