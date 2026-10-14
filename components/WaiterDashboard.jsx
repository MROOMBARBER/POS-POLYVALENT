'use client';
import {Bell,ReceiptText,CheckCircle2,UtensilsCrossed,Clock3,ClipboardList} from 'lucide-react';
import PushControls from './PushControls';

function formatDate(ts){try{return ts?.toDate?.().toLocaleTimeString('fr-MA',{hour:'2-digit',minute:'2-digit'})||''}catch{return ''}}
export default function WaiterDashboard({tenantId,tenant,requests,orders,actions,auth}){
 const pending=[...requests].filter(x=>x.status==='pending').sort((a,b)=>(a.createdAt?.seconds||0)-(b.createdAt?.seconds||0));
 const calls=pending.filter(x=>x.type==='call');
 const bills=pending.filter(x=>x.type==='bill');
 const newOrders=[...orders].filter(x=>x.status==='pending').sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
 const ready=[...orders].filter(x=>x.status==='ready').sort((a,b)=>(a.createdAt?.seconds||0)-(b.createdAt?.seconds||0));
 return <div className="waiter-dashboard">
  <div className="page-title"><div><span className="eyebrow">SERVICE EN SALLE · {tenant.name}</span><h1>Dashboard Serveur<span className="orange">.</span></h1><p>Nouvelles commandes, appels, demandes d’addition et plats prêts — mise à jour en temps réel.</p></div><span className="status green">● En direct</span></div>
  <div className="stats">
   <div className="stat"><ClipboardList size={21}/><span className="stat-label">Nouvelles commandes</span><strong>{newOrders.length}</strong></div>
   <div className="stat"><Bell size={21}/><span className="stat-label">Appels serveur</span><strong>{calls.length}</strong></div>
   <div className="stat"><ReceiptText size={21}/><span className="stat-label">Demandes d'addition</span><strong>{bills.length}</strong></div>
   <div className="stat"><UtensilsCrossed size={21}/><span className="stat-label">Plats prêts à servir</span><strong>{ready.length}</strong></div>
   <div className="stat"><Clock3 size={21}/><span className="stat-label">Demandes à traiter</span><strong>{pending.length}</strong></div>
  </div>
  <PushControls tenantId={tenantId} auth={auth}/>
  <div className="section"><div className="section-top"><div><h2>🛎️ Nouvelles commandes</h2><p>Chaque commande du menu client ou de la caisse apparaît ici et part aussi vers la cuisine.</p></div></div>
   <div className="waiter-requests">{newOrders.map(o=><article className="waiter-request new-order" key={o.id}>
    <div className="waiter-request-top"><span className="status amber">NOUVELLE COMMANDE</span><span className="waiter-time">{formatDate(o.createdAt)}</span></div>
    <h3>{o.tableName||'Comptoir'}</h3>
    <p>{o.items?.map(i=>i.qty+'× '+i.name).join(', ')||'Nouvelle commande'}</p>
    <div className="waiter-order-footer"><b>{Number(o.total||0).toFixed(2).replace('.00','')} DH</b><span>{o.source==='customer'?'Menu QR / NFC':'Commande caisse'}</span></div>
    <span className="waiter-kitchen-hint">✓ Commande envoyée en cuisine</span>
   </article>)}
   {!newOrders.length&&<div className="empty-small">Aucune nouvelle commande en attente. Les commandes futures apparaîtront ici.</div>}
   </div>
  </div>
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
