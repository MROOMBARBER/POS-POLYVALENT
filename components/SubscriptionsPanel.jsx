'use client';
import {useEffect,useMemo,useState} from 'react';
import {subscriptionStatus,casablancaDate} from '../lib/subscriptions';

const labels={active:'Actif',pending:'En attente',expired:'Expiré',suspended:'Suspendu',legacy:'Ancien accès (à configurer)',demo:'Démonstration gratuite'};
function plusCalendarMonth(dateString){
 const [year,month,day]=dateString.split('-').map(Number);
 const nextFirst=new Date(Date.UTC(year,month,1,12));
 const last=new Date(Date.UTC(nextFirst.getUTCFullYear(),nextFirst.getUTCMonth()+1,0,12)).getUTCDate();
 const d=new Date(Date.UTC(nextFirst.getUTCFullYear(),nextFirst.getUTCMonth(),Math.min(day,last),12));
 return d.toISOString().slice(0,10);
}
function addDay(value){
 const date=new Date(value+'T12:00:00Z');
 date.setUTCDate(date.getUTCDate()+1);
 return date.toISOString().slice(0,10);
}
function defaultPeriod(sub){
 const today=casablancaDate();
 return {
  status:sub?.status||'pending',
  startsOn:sub?.startsOn||today,
  endsOn:sub?.endsOn||plusCalendarMonth(today),
  priceMad:sub?.priceMad===undefined?'':String(sub.priceMad),
  notes:sub?.notes||''
 };
}
export default function SubscriptionsPanel({tenants,selectedId,onBack,auth,onSaved}){
 const [id,setId]=useState(selectedId||''),[form,setForm]=useState(defaultPeriod(null)),[loading,setLoading]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const current=useMemo(()=>tenants.find(t=>t.id===id)||null,[tenants,id]);
 useEffect(()=>{if(selectedId&&selectedId!==id)setId(selectedId)},[selectedId]);
 useEffect(()=>{setForm(defaultPeriod(current?.subscription));setMessage('');setError('')},[id,current?.subscription?.status,current?.subscription?.startsOn,current?.subscription?.endsOn,current?.subscription?.priceMad]);
 const today=casablancaDate();
 const summary=tenants.reduce((a,t)=>{const key=subscriptionStatus(t);a[key]=(a[key]||0)+1;return a},{});
 const daysRemaining=current?.subscription?.endsOn
  ?Math.round((Date.parse(current.subscription.endsOn+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/86400000)
  :null;
 const set=(field,value)=>setForm(x=>({...x,[field]:value}));
 function renew(){
  const base=current?.subscription?.endsOn&&current.subscription.endsOn>=today?current.subscription.endsOn:today;
  setForm(x=>({
   ...x,status:'active',
   startsOn:x.startsOn&&x.startsOn<=today?x.startsOn:today,
   endsOn:plusCalendarMonth(base)
  }));
 }
 async function save(event){
  event.preventDefault();setLoading(true);setError('');setMessage('');
  try{
   if(!current)throw Error('Sélectionnez un établissement.');
   if(!auth?.currentUser)throw Error('Connexion expirée');
   if(String(form.priceMad).trim()==='')throw Error('Entrez le tarif mensuel, même si c’est 0 DH.');
   const token=await auth.currentUser.getIdToken();
   const response=await fetch('/api/admin/subscriptions',{
    method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({tenantId:current.id,subscription:{...form,priceMad:Number(form.priceMad)}})
   });
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'Enregistrement impossible');
   setMessage('Abonnement enregistré. Statut actuel : '+(labels[data.status]||data.status)+'.');
   onSaved?.();
  }catch(e){setError(e.message||'Erreur')}finally{setLoading(false)}
 }
 const boxes=[
  {label:'Actifs',value:summary.active||0},
  {label:'Expirés',value:summary.expired||0},
  {label:'En attente',value:summary.pending||0},
  {label:'À configurer',value:summary.legacy||0}
 ];
 return <div style={{display:'grid',gap:20}}>
  <div className="page-title"><div><span className="eyebrow">FACTURATION · MAMOUN POS</span><h1>Abonnements<span className="orange">.</span></h1><p>Gestion manuelle des abonnements mensuels en DH. Aucun paiement automatique n'est débité.</p></div><button className="btn outline" onClick={onBack}>← Établissements</button></div>
  <div className="stats">{boxes.map(x=><div className="stat" key={x.label}><span className="stat-label">{x.label}</span><strong>{x.value}</strong></div>)}</div>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,280px),1fr))',gap:20,alignItems:'start'}}>
   <section className="section">
    <div className="section-top"><div><h2>Établissements</h2><p>Choisir celui à gérer</p></div></div>
    <div style={{display:'grid',gap:8}}>
     {tenants.map(t=>{const status=subscriptionStatus(t);return <button type="button" key={t.id} onClick={()=>setId(t.id)} style={{textAlign:'left',border:'1px solid '+(id===t.id?'#df8c56':'#ddd'),background:id===t.id?'#fff7ef':'white',borderRadius:12,padding:14,cursor:'pointer'}}>
       <b>{t.name}</b><div style={{marginTop:5,fontSize:13,color:'#677282'}}>{labels[status]||status}{t.subscription?.endsOn?' · '+t.subscription.endsOn:''}</div>
      </button>})}
    </div>
   </section>
   <section className="section">
    <div className="section-top"><div><h2>Contrat mensuel</h2><p>{current?.name||'Choisissez un établissement'}</p></div></div>
    {current?.isDemo===true?<div style={{padding:16,borderRadius:12,background:'#f1f5f9'}}>Le café de démonstration est gratuit. Aucun abonnement n'est requis pour les tests.</div>:current?
    <form onSubmit={save} style={{display:'grid',gap:14}}>
     <p style={{fontSize:14,color:'#667085',margin:0}}>Statut actuel : <strong>{labels[subscriptionStatus(current)]||'—'}</strong>{daysRemaining!==null&&subscriptionStatus(current)==='active'?' · '+daysRemaining+' jour(s) restants':''}</p>
     <label>Tarif mensuel (DH)<input type="number" step="0.01" min="0" max="100000" required placeholder="Ex. 199" value={form.priceMad} onChange={e=>set('priceMad',e.target.value)}/></label>
     <label>État<select value={form.status} onChange={e=>set('status',e.target.value)}><option value="pending">En attente de règlement</option><option value="active">Actif</option><option value="suspended">Suspendu</option></select></label>
     <label>Début de période<input type="date" value={form.startsOn} onChange={e=>set('startsOn',e.target.value)} required={form.status==='active'}/></label>
     <label>Fin de période<input type="date" value={form.endsOn} onChange={e=>set('endsOn',e.target.value)} required={form.status==='active'}/></label>
     <label>Notes internes<textarea maxLength={250} value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Paiement manuel reçu, référence, etc."/></label>
     <button type="button" className="btn outline" onClick={renew}>Prolonger d'un mois (dates)</button>
     {error&&<div className="error" role="alert">{error}</div>}
     {message&&<div className="success" role="status">{message}</div>}
     <button type="submit" className="btn primary" disabled={loading}>{loading?'Enregistrement…':'Enregistrer l’abonnement'}</button>
     <small style={{color:'#87909c'}}>Le changement de statut est réservé au Super Admin. L'abonnement expire à la fin de la date choisie au Maroc.</small>
    </form>:<p>Veuillez choisir un restaurant dans la liste.</p>}
   </section>
  </div>
 </div>;
}
