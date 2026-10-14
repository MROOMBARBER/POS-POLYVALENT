'use client';
import {Bell,ReceiptText,CheckCircle2,UtensilsCrossed,Clock3} from 'lucide-react';
import PushControls from './PushControls';

function formatDate(ts){try{return ts?.toDate?.().toLocaleTimeString('fr-MA',{hour:'2-digit',minute:'2-digit'})||''}catch{return ''}}
export default function WaiterDashboard({tenantId,tenant,requests,orders,actions,auth}){
 const pending=[...requests].filter(x=>x.status==='pending').sort((a,b)=>(a.createdAt?.seconds||0)-(b.createdAt?.seconds||0));
 const calls=pending.filter(x=>x.type==='call');
 const bills=pending.filter(x=>x.type==='bill');
 const ready=[...orders].filter(x=>x.status==='ready').sort((a,b)=>(a.createdAt?.seconds||0)-(b.createdAt?.seconds||0));
 return <div className="waiter-dashboard">
  <div className="page-title"><div><span className="eyebrow">SERVICE EN SALLE · {tenant.name}</span><h1>Dashboard Serveur<span className="orange">.</span></h1><p>Appels, demandes d'addition et plats prêts — mise à jour en temps réel.</p></div><span className="status green">● En direct</span></div>
  <div className="stats">
   <div className="stat"><Bell size={21}/><span className="stat-label">Appels serveur</span><strong>{calls.length}</strong></div>
   <div className="stat"><ReceiptText size={21}/><span className="stat-label">Demandes d'addition</span><strong>{bills.length}</strong></div>
   <div className="stat"><UtensilsCrossed size={21}/><span className="stat-label">Plats prêts à servir</span><strong>{ready.length}</strong></div>
   <div className="stat"><Clock3 size={21}/><span className="stat-label">Demandes à traiter</span><strong>{pending.length}</strong></div>
  </div>
  <PushControls tenantId={tenantId} auth={auth}/>
  <div className="section"><div className="section-top"><div><h2>Appels et additions</h2><p>Une alerte apparaît ici instantanément dès que le client appelle.</p></div></div>
   <div className="waiter-requests">{pending.map(r=><article className={'waiter-request '+(r.type==='call'?'call':'bill')} key={r.id}>
    <div className="waiter-request-top"><span className={'status '+(r.type==='call'?'amber':'green')}>{r.type==='call'?'🔔 APPEL SERVEUR':'🧾 ADDITION'}</span><span className="waiter-time">{formatDate(r.createdAt)}</span></div>
    <h3>{r.tableName||'Table'}</h3>
    <p>{r.type==='bill'?(r.paymentMethod==='card'?'Paiement par TPE · Apportez le terminal':'Paiement en espèces · Apportez l’addition'):'Le client demande un serveur à cette table.'}</p>
    <button type="button" className="btn primary" onClick={()=>actions.requestDone(r.id)}><CheckCircle2 size={18}/> Marquer comme traité</button>
   </article>)}
   {!pending.length&&<div className="empty">Aucun appel en attente. Les nouvelles demandes apparaîtront automatiquement.</div>}
   </div>
  </div>
  <div className="section"><div className="section-top"><div><h2>Plats prêts à servir</h2><p>Commandes signalées prêtes par la cuisine.</p></div></div>
   <div className="waiter-requests">{ready.map(o=><article className="waiter-request ready" key={o.id}>
    <span className="status green">Prête ✓</span><h3>{o.tableName||'Comptoir'}</h3>
    <p>{o.items?.map(i=>i.qty+'× '+i.name).join(', ')||'Commande prête'}</p>
    <button type="button" className="btn primary" onClick={()=>actions.updateStatus(o.id,'served')}><CheckCircle2 size={18}/> Commande servie</button>
   </article>)}
   {!ready.length&&<div className="empty-small">Aucun plat prêt pour le moment.</div>}
   </div>
  </div>
 </div>;
}
