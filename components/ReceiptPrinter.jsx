'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Printer,CheckCircle2,AlertTriangle,Play,Pause,RefreshCw,Settings,ReceiptText} from 'lucide-react';
import {orderReceiptHtml} from '../lib/receipt';

const KEY=t=>'mamoun-pos-80mm-station:'+t;
const initial={enabled:false,startedAt:0,printed:{}};
function fromDisk(tenantId){
 try{
  const data=JSON.parse(localStorage.getItem(KEY(tenantId))||'null');
  if(!data||typeof data!=='object')return {...initial};
  return {enabled:data.enabled===true,startedAt:Number(data.startedAt)||0,printed:typeof data.printed==='object'&&data.printed?data.printed:{}};
 }catch{return {...initial}}
}
function saveDisk(tenantId,state){
 const last=Object.entries(state.printed||{}).sort((a,b)=>b[1]-a[1]).slice(0,500);
 localStorage.setItem(KEY(tenantId),JSON.stringify({...state,printed:Object.fromEntries(last)}));
}
function createdAtMs(o){
 if(o?.createdAt?.toMillis)return o.createdAt.toMillis();
 if(Number.isFinite(o?.createdAt?.seconds))return o.createdAt.seconds*1000;
 return null;
}
function printViaBrowser(html){
 return new Promise((resolve,reject)=>{
  const frame=document.createElement('iframe');
  frame.setAttribute('title','Ticket cuisine 80mm');
  frame.setAttribute('aria-hidden','true');
  frame.style.cssText='position:fixed;left:-10000px;top:0;width:80mm;height:500px;opacity:0;pointer-events:none;border:0';
  let ended=false;
  let timeout=null;
  function cleanup(){
   if(timeout)clearTimeout(timeout);
   setTimeout(()=>frame.remove(),1300);
  }
  frame.onload=()=>{
   if(ended)return;
   try{
    const win=frame.contentWindow;
    if(!win)throw Error('Document d’impression inaccessible');
    win.focus();
    win.print();
    ended=true;cleanup();resolve();
   }catch(e){ended=true;cleanup();reject(e)}
  };
  frame.srcdoc=html;
  timeout=setTimeout(()=>{if(!ended){ended=true;frame.remove();reject(Error('La fenêtre d’impression ne répond pas.'))}},9000);
  document.body.appendChild(frame);
 });
}
/**
 * The print bridge exists only in the authenticated POS dashboard.
 * Each physical counter opts in independently. This browser stores which
 * orders were handed to its OS print system; no server data is modified.
 */
export default function ReceiptPrinter({tenantId,tenant,orders,visible=false}){
 const [state,setState]=useState({...initial});
 const [ready,setReady]=useState(false);
 const [status,setStatus]=useState('');
 const [printing,setPrinting]=useState(false);
 const busy=useRef(false),enabledRef=useRef(false),tenantRef=useRef(tenantId),ordersRef=useRef(orders),tenantDataRef=useRef(tenant);
 ordersRef.current=orders;
 tenantDataRef.current=tenant;
 useEffect(()=>{
  tenantRef.current=tenantId;
  const next=fromDisk(tenantId);
  enabledRef.current=next.enabled;
  setState(next);
  setReady(true);
  setStatus('');
 },[tenantId]);
 const persist=useCallback(next=>{saveDisk(tenantId,next);setState(next);enabledRef.current=next.enabled},[tenantId]);

 async function printOne(order,test=false){
  await printViaBrowser(orderReceiptHtml(order,tenantDataRef.current,{test}));
 }
 const processQueue=useCallback(async()=>{
  if(busy.current||!enabledRef.current||!tenantId||tenantRef.current!==tenantId)return;
  busy.current=true;
  try{
   let count=0;
   while(enabledRef.current&&tenantRef.current===tenantId){
    const cfg=fromDisk(tenantId);
    if(!cfg.enabled)break;
    const waiting=ordersRef.current.filter(o=>{
     const timestamp=createdAtMs(o);
     return timestamp!==null&&timestamp>=cfg.startedAt&&!cfg.printed[o.id];
    }).sort((a,b)=>createdAtMs(a)-createdAtMs(b));
    if(!waiting.length)break;
    const order=waiting[0];
    setPrinting(true);
    try{
     await printOne(order);
     // A browser API cannot verify a physical printout. Reprint remains available.
     const updated=fromDisk(tenantId);
     updated.printed[order.id]=Date.now();
     saveDisk(tenantId,updated);
     setState(updated);
     count++;
     setStatus('Ticket '+(order.tableName||'Comptoir')+' envoyé à Chrome. Vérifiez la sortie papier.');
    }catch(err){
     setStatus('Impression bloquée : '+(err.message||'Vérifiez Chrome et la connexion USB'));
     break;
    }finally{setPrinting(false)}
    await new Promise(resolve=>setTimeout(resolve,1200));
    if(count>=30){setStatus('30 tickets envoyés. Réouvrez cette page pour reprendre la file.');break}
   }
  }finally{busy.current=false}
 },[tenantId]);
 useEffect(()=>{if(ready&&state.enabled)processQueue()},[ready,state.enabled,orders,processQueue]);

 function activate(){
  const cfg=fromDisk(tenantId);
  // Never print hours of past orders on the first activation.
  const next={...cfg,enabled:true,startedAt:cfg.startedAt||Date.now(),printed:cfg.printed||{}};
  persist(next);
  setStatus('Surveillance activée. Les nouvelles commandes seront imprimées sur cette caisse.');
 }
 function stop(){persist({...fromDisk(tenantId),enabled:false});setStatus('Impression automatique désactivée sur cet appareil.')}
 async function manual(order,asTest=false){
  if(printing)return;
  setPrinting(true);setStatus('');
  try{await printOne(order,asTest);setStatus(asTest?'Ticket TEST envoyé à Chrome. Vérifiez la sortie 80mm.':'Réimpression demandée pour '+(order.tableName||'Comptoir'))}
  catch(e){setStatus(e.message||'Impression impossible')}
  finally{setPrinting(false)}
 }
 if(!visible)return null;
 const recent=[...orders].sort((a,b)=>(createdAtMs(b)||0)-(createdAtMs(a)||0)).slice(0,14);
 return <div className="printer-workstation">
  <div className="page-title"><div><span className="eyebrow">WD950 · TICKET CUISINE</span><h1>Impression 80mm<span className="orange">.</span></h1>
   <p>Une imprimante thermique USB connectée à <b>cette caisse</b>. Les commandes QR/NFC et Caisse POS arrivent en temps réel.</p></div></div>
  <section className="section">
   <div className="printer-station-status"><span className={'status '+(state.enabled?'green':'gray')}>{state.enabled?'● STATION ACTIVE':'○ NON ACTIVÉE'}</span><span>Cette station ne fonctionne que quand MAMOUN POS reste ouvert sur le WD950.</span></div>
   <div className="printer-station-actions">
    {!state.enabled?<button className="btn primary" type="button" onClick={activate}><Play size={18}/> Activer impression automatique</button>:
     <button className="btn outline" type="button" onClick={stop}><Pause size={18}/> Arrêter impression auto</button>}
    <button type="button" className="btn outline" disabled={printing} onClick={()=>manual({tableName:'TEST',source:'staff',createdAt:new Date(),items:[],total:0},true)}><Printer size={18}/> Imprimer ticket TEST</button>
   </div>
   {!!status&&<div className="printer-info" role="status"><ReceiptText size={18}/>{status}</div>}
   <div className="printer-setup">
    <h3><Settings size={19}/> Réglage sur votre WD950 (Windows)</h3>
    <p>1. Brancher l’imprimante USB 80mm, installer son pilote et imprimer une page test Windows.</p>
    <p>2. La définir <b>Imprimante par défaut</b> et choisir un rouleau de papier 80mm.</p>
    <p>3. Dans Chrome normal, faire un test et choisir l’imprimante 80mm comme destination, pas « Enregistrer en PDF ».</p>
    <p>4. Fermer Chrome, puis ouvrir un raccourci Chrome dédié avec <code>--kiosk-printing</code> pour imprimer sans dialogue.</p>
    <p className="printer-caution"><AlertTriangle size={16}/> Sans le mode kiosk-printing, Chrome pourra ouvrir une fenêtre d’impression pour chaque ticket. MAMOUN POS ne reçoit pas de confirmation que le papier est physiquement sorti.</p>
   </div>
  </section>
  <section className="section">
   <div className="section-top"><div><h2>Dernières commandes</h2><p>Réimprimer un ticket en cas de papier manquant ou de mauvaise impression.</p></div></div>
   <div className="table-scroll"><table className="data-table"><thead><tr><th>Table</th><th>Articles</th><th>Statut station</th><th>Impression</th></tr></thead><tbody>
    {recent.map(o=><tr key={o.id}><td><b>{o.tableName||'Comptoir'}</b><small>{o.source==='customer'?'QR/NFC':'Caisse'}</small></td><td>{o.items?.map(i=>i.qty+'× '+i.name).join(', ')||'—'}</td><td>{state.printed?.[o.id]?<span className="status green">Envoyé</span>:<span className="status gray">Non imprimé ici</span>}</td><td><button type="button" className="btn outline" disabled={printing} onClick={()=>manual(o)}><RefreshCw size={15}/> Réimprimer</button></td></tr>)}
    {!recent.length&&<tr><td className="empty-small" colSpan={4}>Aucune commande enregistrée.</td></tr>}
   </tbody></table></div>
  </section>
 </div>;
}
