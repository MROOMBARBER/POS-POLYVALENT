'use client';
import {useEffect,useState} from 'react';
import {Bell,BellOff,Smartphone} from 'lucide-react';
function toUint8(base64url){
 const pad='='.repeat((4-base64url.length%4)%4);
 const str=atob((base64url+pad).replace(/-/g,'+').replace(/_/g,'/'));
 return Uint8Array.from(str,c=>c.charCodeAt(0));
}
function standalone(){
 return window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true;
}
export default function PushControls({tenantId,auth}){
 const [support,setSupport]=useState('checking'),[enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{
  if(typeof window==='undefined')return;
  if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)){
   setSupport('unsupported');return;
  }
  if(/iPad|iPhone|iPod/.test(navigator.userAgent)&&!standalone()){setSupport('install-ios');return}
  setSupport(Notification.permission==='denied'?'blocked':'available');
  let alive=true;
  navigator.serviceWorker.getRegistration('/').then(r=>r?.pushManager?.getSubscription()).then(s=>{if(alive&&s)setEnabled(true)}).catch(()=>{});
  return()=>{alive=false};
 },[tenantId]);
 async function activate(){
  setBusy(true);setMessage('');
  try{
   if(!auth?.currentUser)throw Error('Reconnectez-vous pour activer les notifications.');
   // Request permission from the button interaction before awaiting any fetch.
   const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();
   if(permission!=='granted'){setSupport('blocked');throw Error('Autorisez les notifications dans les réglages de votre téléphone.')}
   const info=await fetch('/api/push/config',{cache:'no-store'}).then(r=>r.json());
   if(!info.enabled||!info.publicKey)throw Error('Service de notification non disponible.');
   const registration=await navigator.serviceWorker.register('/sw.js',{scope:'/'});
   await navigator.serviceWorker.ready;
   let subscription=await registration.pushManager.getSubscription();
   if(!subscription){subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:toUint8(info.publicKey)});}
   const token=await auth.currentUser.getIdToken();
   const result=await fetch('/api/push/subscribe',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({tenantId,subscription:subscription.toJSON()})});
   const json=await result.json();
   if(!result.ok)throw Error(json.error||'Impossible d’activer les notifications.');
   setEnabled(true);setMessage('Notifications activées sur ce téléphone.');
  }catch(e){setMessage(e.message||'Erreur de notification.')}finally{setBusy(false)}
 }
 async function testNotification(){
  setBusy(true);setMessage('');
  try{
   if(!auth?.currentUser)throw Error('Reconnectez-vous.');
   const token=await auth.currentUser.getIdToken();
   const response=await fetch('/api/push/test',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({tenantId})});
   const result=await response.json();
   if(!response.ok)throw Error(result.error||'Envoi du test impossible.');
   setMessage('Test envoyé à '+result.sent+' appareil(s). Vérifiez votre téléphone et ses réglages de notification.');
  }catch(e){setMessage(e.message||'Test indisponible.')}finally{setBusy(false)}
 }
 async function deactivate(){
  setBusy(true);setMessage('');
  try{
   const registration=await navigator.serviceWorker.getRegistration('/');
   const sub=await registration?.pushManager?.getSubscription();
   if(sub&&auth?.currentUser){
    const token=await auth.currentUser.getIdToken();
    const response=await fetch('/api/push/unsubscribe',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({tenantId,subscription:sub.toJSON()})});
    if(!response.ok){const data=await response.json();throw Error(data.error||'Suppression impossible');}
    await sub.unsubscribe();
   }
   setEnabled(false);setMessage('Notifications désactivées.');
  }catch(e){setMessage(e.message||'Erreur')}finally{setBusy(false)}
 }
 return <section className="section waiter-notification">
  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:9}}><Smartphone size={22}/><h2 style={{margin:0}}>Notifications sur téléphone</h2></div>
  <p style={{fontSize:13,color:'#718093'}}>Recevez une alerte pour les nouvelles commandes, appels serveur et demandes d’addition, même quand le tableau de bord est fermé.</p>
  {support==='unsupported'?<p>Votre navigateur ne prend pas en charge les notifications Push. Utilisez Chrome sur Android ou ajoutez MAMOUN POS à l’écran d’accueil de votre iPhone.</p>:
   support==='install-ios'?<p><b>iPhone :</b> ouvrez ce site dans Safari → Partager → <b>Sur l’écran d’accueil</b>. Ouvrez ensuite MAMOUN POS depuis son icône, connectez-vous et activez les notifications ici (iOS 16.4 ou plus récent).</p>:
   <div style={{display:'flex',gap:9,flexWrap:'wrap'}}>
    <button className="btn primary" type="button" disabled={busy} onClick={activate}><Bell size={16}/>{busy?'Patientez…':enabled?'Réactiver / vérifier':'Activer les notifications'}</button>
    {enabled&&<button className="btn outline" type="button" disabled={busy} onClick={testNotification}><Bell size={16}/> Tester la notification</button>}
    {enabled&&<button className="btn outline" type="button" disabled={busy} onClick={deactivate}><BellOff size={16}/> Désactiver</button>}
   </div>}
  {message&&<p role="status" style={{marginTop:9,fontSize:13}}>{message}</p>}
 </section>;
}
