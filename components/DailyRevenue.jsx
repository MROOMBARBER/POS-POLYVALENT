'use client';
import {useMemo,useState} from 'react';
import {CreditCard,CalendarDays,ClipboardList,Wallet,Clock3,CheckCircle2,TrendingUp} from 'lucide-react';
import {casablancaDate} from '../lib/subscriptions';
import {salesForDate} from '../lib/daily-sales';
const money=n=>Number(n||0).toFixed(2).replace('.00','')+' DH';
export default function DailyRevenue({orders}){
 const today=casablancaDate();
 const [selected,setSelected]=useState(today);
 const report=useMemo(()=>salesForDate(orders,selected)||salesForDate([] ,today),[orders,selected,today]);
 const cards=[
  {label:'Encaissements du jour',value:money(report.total),icon:<TrendingUp size={21}/>},
  {label:'Commandes créées',value:report.orders,icon:<ClipboardList size={21}/>},
  {label:'Paiements reçus',value:report.paid,icon:<CheckCircle2 size={21}/>},
  {label:'Commandes en cours',value:report.outstanding,icon:<Clock3 size={21}/>},
 ];
 return <section className="daily-report" aria-label="Statistiques journalières du restaurant">
  <div className="section-top daily-header"><div><h2>Chiffre d'affaires par jour</h2><p>Encaissements et commandes du restaurant, en temps réel. Fuseau horaire Maroc.</p></div>
   <label className="daily-picker"><span><CalendarDays size={16}/> Date</span><input type="date" value={selected} max={today} onChange={e=>setSelected(e.target.value||today)}/></label>
  </div>
  <div className="stats">{cards.map(v=><div key={v.label} className="stat"><span className="stat-icon">{v.icon}</span><span className="stat-label">{v.label}</span><strong>{v.value}</strong></div>)}</div>
  <div className="daily-detail">
   <div><Wallet size={18}/><span>Espèces</span><strong>{money(report.cash)}</strong></div>
   <div><CreditCard size={18}/><span>TPE / Carte</span><strong>{money(report.card)}</strong></div>
   <div><TrendingUp size={18}/><span>Ticket moyen payé</span><strong>{money(report.average)}</strong></div>
   <div><ClipboardList size={18}/><span>Annulées</span><strong>{report.cancelled}</strong></div>
   {report.other>0&&<div><Wallet size={18}/><span>Paiement non précisé</span><strong>{money(report.other)}</strong></div>}
  </div>
  <p className="daily-note">CA encaissé, pas bénéfice net. Les anciens paiements sans date d'encaissement sont attribués à la date de la commande. Les charges et coûts des produits ne sont pas encore déduits.</p>
 </section>;
}
