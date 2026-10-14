'use client';
import {useEffect,useMemo,useState} from 'react';
import {useParams,useSearchParams} from 'next/navigation';
import {ArrowRight,BellRing,CheckCircle2,Coffee,CreditCard,UtensilsCrossed,ReceiptText,Store,Smartphone,X,ChevronDown,ShieldCheck,Clock3} from 'lucide-react';

const money=value=>Number(value||0).toFixed(2).replace('.00','')+' DH';
function menuLink(tenantId,tableId){return '/menu/'+encodeURIComponent(tenantId)+(tableId?'?table='+encodeURIComponent(tableId):'');}

export default function ClientDashboard(){
 const params=useParams(),search=useSearchParams();
 const tenantId=String(params.tenantId||'');
 const [data,setData]=useState(null);
 const [tableId,setTableId]=useState('');
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [done,setDone]=useState('');
 const [busy,setBusy]=useState('');
 const [billOpen,setBillOpen]=useState(false);
 const [payment,setPayment]=useState('cash');
 const [lastCall,setLastCall]=useState(0);
 useEffect(()=>{setTableId(search.get('table')||'')},[search]);
 useEffect(()=>{
  let disposed=false;
  setLoading(true);setError('');
  fetch('/api/public/menu?tenantId='+encodeURIComponent(tenantId),{cache:'no-store'})
   .then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error||'Service indisponible');return data;})
   .then(data=>{if(!disposed)setData(data)})
   .catch(error=>{if(!disposed)setError(error.message||'Connexion indisponible')})
   .finally(()=>{if(!disposed)setLoading(false)});
  return()=>{disposed=true};
 },[tenantId]);
 const table=data?.tables?.find(t=>t.id===tableId);
 const featured=useMemo(()=>data?.products?.slice(0,4)||[],[data]);
 const currency=data?.tenant?.currency||'MAD';
 const send=async(action)=>{
  if(!table){setError('Sélectionnez votre table pour continuer.');return}
  if(busy)return;
  // Avoid accidental rapid multiple calls from the same device.
  if(action==='call'&&Date.now()-lastCall<20000){setDone('Serveur déjà appelé. Veuillez patienter un instant.');return}
  setBusy(action);setError('');setDone('');
  try{
   let clientId;
   try{clientId=localStorage.getItem('mamoun-client-id');if(!clientId){clientId=crypto.randomUUID();localStorage.setItem('mamoun-client-id',clientId)}}catch{clientId='guest-browser'}
   const response=await fetch('/api/public/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tenantId,tableId,clientId,paymentMethod:payment})});
   const result=await response.json();
   if(!response.ok)throw Error(result.error||'Demande non envoyée. Réessayez.');
   if(action==='call'){setLastCall(Date.now());setDone('Votre serveur a été appelé. Il arrive dès que possible.')}
   if(action==='bill'){setDone('Demande d’addition envoyée au serveur.');setBillOpen(false)}
  }catch(e){setError(e.message||'Une erreur est survenue.')}finally{setBusy('')}
 };
 const selectTable=(value)=>{
  setTableId(value);setDone('');setError('');
  const u=new URL(window.location.href);
  if(value)u.searchParams.set('table',value);else u.searchParams.delete('table');
  window.history.replaceState(null,'',u.pathname+u.search);
 };
 return <div className="client-dashboard" style={{'--client-accent':data?.tenant?.accent||'#d98655'}}>
  <div className="client-container">
   <header className="client-topbar">
    <div className="client-identity">
     <div className="client-brand-mark">{data?.tenant?.logo?<img src={data.tenant.logo} alt="Logo de l'établissement"/>:<Coffee size={24}/>}</div>
     <div><span className="client-mini">BIENVENUE CHEZ</span><b>{data?.tenant?.name||'MAMOUN POS'}</b></div>
    </div>
    <span className="client-no-account"><ShieldCheck size={15}/> Sans compte</span>
   </header>
   {loading?<div className="client-loading"><Coffee size={29}/><h2>Votre espace se prépare…</h2><p>Chargement de la carte et de votre table.</p></div>:
    !data?<div className="client-loading"><h2>Accès temporairement indisponible</h2><p>{error||'Veuillez réessayer.'}</p><button className="client-button secondary" onClick={()=>window.location.reload()}>Réessayer</button></div>:
    <>
     <section className="client-hero" style={data.tenant.cover?{backgroundImage:'linear-gradient(105deg,rgba(16,24,35,.90),rgba(19,27,33,.42)),url('+JSON.stringify(data.tenant.cover)+')'}:{}}>
      <span className="client-hero-tag"><Store size={14}/> SERVICE DIGITAL</span>
      <h1>Bienvenue<br/>à {data.tenant.name}</h1>
      <p>{data.tenant.subtitle||'Installez-vous, nous nous occupons du reste.'}</p>
     </section>
     <section className="client-table-wrap">
      <div className="client-table-heading"><span>VOTRE TABLE</span><span className="client-table-hint"><Clock3 size={14}/> Service en salle</span></div>
      <label className="client-select"><Store size={19}/>
       <select aria-label="Sélectionnez votre table" value={tableId} onChange={event=>selectTable(event.target.value)}>
        <option value="">Sélectionner ma table</option>
        {data.tables.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}
       </select><ChevronDown size={18}/>
      </label>
      {!table&&<p className="client-table-alert">Choisissez votre table pour appeler le serveur ou demander l’addition.</p>}
     </section>
     {done&&<div role="status" className="client-feedback success"><CheckCircle2 size={19}/><span>{done}</span><button type="button" onClick={()=>setDone('')} aria-label="Fermer">×</button></div>}
     {error&&<div role="alert" className="client-feedback error"><span>{error}</span><button type="button" onClick={()=>setError('')} aria-label="Fermer">×</button></div>}
     <main className="client-main">
      <div className="client-section-heading"><span>QUE SOUHAITEZ-VOUS FAIRE ?</span><h2>À votre service.</h2></div>
      <div className="client-action-grid">
       <a className="client-action client-action-menu" href={menuLink(tenantId,tableId)}>
        <span className="client-action-icon"><UtensilsCrossed size={27}/></span>
        <strong>Voir le menu</strong><span>La carte, les prix et vos commandes</span>
        <span className="client-action-arrow"><ArrowRight size={20}/></span>
       </a>
       <button type="button" className="client-action" onClick={()=>send('call')} disabled={!!busy||!table}>
        <span className="client-action-icon"><BellRing size={27}/></span>
        <strong>Appeler serveur</strong><span>{busy==='call'?'Envoi en cours…':'Un serveur vient à votre table'}</span>
        <span className="client-action-arrow"><ArrowRight size={20}/></span>
       </button>
       <button type="button" className="client-action" onClick={()=>{setError('');if(!table){setError('Sélectionnez votre table pour continuer.');return}setBillOpen(true)}} disabled={!!busy||!table}>
        <span className="client-action-icon"><ReceiptText size={27}/></span>
        <strong>Demander l’addition</strong><span>Choisir espèces ou TPE / carte</span>
        <span className="client-action-arrow"><ArrowRight size={20}/></span>
       </button>
      </div>
      <section className="client-discover">
       <div className="client-discover-head"><div><span>À DÉCOUVRIR</span><h2>Un aperçu de la carte</h2></div><a href={menuLink(tenantId,tableId)}>Voir tout <ArrowRight size={16}/></a></div>
       <div className="client-featured">
        {featured.map(p=><a className="client-featured-item" key={p.id} href={menuLink(tenantId,tableId)}>
         <div className="client-featured-image">{p.image?<img src={p.image} alt={p.name}/>:<UtensilsCrossed size={23}/>}</div>
         <div><small>{p.category||'Carte'}</small><strong>{p.name}</strong><span>{currency==='MAD'?money(p.price):Number(p.price||0).toFixed(2)+' '+currency}</span></div>
        </a>)}
        {!featured.length&&<p>Les produits seront bientôt disponibles dans le menu.</p>}
       </div>
      </section>
     </main>
     <footer className="client-footer"><Smartphone size={16}/> Aucun compte nécessaire · Propulsé par <b>MAMOUN POS</b></footer>
    </>}
  </div>
  {billOpen&&<div className="client-dialog-shade" onClick={()=>setBillOpen(false)}>
   <div className="client-bill-dialog" role="dialog" aria-modal="true" aria-label="Demande d’addition" onClick={e=>e.stopPropagation()}>
    <div className="client-dialog-title"><span className="client-dialog-icon"><ReceiptText size={25}/></span><button type="button" onClick={()=>setBillOpen(false)} aria-label="Fermer"><X size={23}/></button></div>
    <h2>Demander l’addition</h2><p>Le serveur apportera l’addition à <b>{table?.name}</b>. Comment souhaitez-vous régler ?</p>
    <div className="client-payment-options">
     <button type="button" className={payment==='cash'?'selected':''} onClick={()=>setPayment('cash')}><span>💵</span> Espèces</button>
     <button type="button" className={payment==='card'?'selected':''} onClick={()=>setPayment('card')}><CreditCard size={23}/> TPE / Carte</button>
    </div>
    <button type="button" className="client-button primary" onClick={()=>send('bill')} disabled={!!busy}>{busy==='bill'?'Envoi…':'Envoyer la demande'} <ArrowRight size={18}/></button>
    <p className="client-payment-note">Vous paierez directement auprès du serveur. Aucun paiement n’est effectué dans cette application.</p>
   </div>
  </div>}
 </div>
}
