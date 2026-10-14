'use client';
import {useEffect,useState} from 'react';
import {Wallet,CheckCircle2,AlertTriangle,PlugZap,LockKeyhole,Unplug,RefreshCw} from 'lucide-react';
import {drawerEnabled,setDrawerEnabled,drawerHealth,openCashDrawer} from '../lib/cash-drawer';

export default function CashDrawerPanel({tenantId}){
 const [active,setActive]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [isError,setIsError]=useState(false);
 const [printer,setPrinter]=useState('');
 useEffect(()=>{setActive(drawerEnabled(tenantId));setMessage('');setPrinter('')},[tenantId]);
 async function activate(){
  setBusy(true);setMessage('');setIsError(false);
  try{
   const info=await drawerHealth();
   setDrawerEnabled(tenantId,true);
   setActive(true);setPrinter(info.printer||'Imprimante 80mm');
   setMessage('Tiroir activé sur ce WD950 : ouverture seulement après un encaissement Espèces validé.');
  }catch(e){setIsError(true);setMessage(e.message||'Agent tiroir indisponible. Lancez le programme WD950 Windows.')}
  finally{setBusy(false)}
 }
 function disable(){
  setDrawerEnabled(tenantId,false);setActive(false);setMessage('Ouverture automatique désactivée sur ce WD950.');setIsError(false);
 }
 async function test(){
  setBusy(true);setMessage('');setIsError(false);
  try{
   const info=await openCashDrawer();
   setMessage('Commande de test envoyée à la caisse. Vérifiez physiquement que le tiroir s’est ouvert.');
  }catch(e){setIsError(true);setMessage(e.message||'Signal d’ouverture refusé. Vérifiez la prise DK RJ11/RJ12.')}
  finally{setBusy(false)}
 }
 return <section className="section drawer-setup">
  <div className="section-top"><div><h2><Wallet size={21}/> Tiroir-caisse automatique</h2><p>WD950 → imprimante USB 80mm → tiroir RJ11/RJ12 (prise DK).</p></div><span className={'status '+(active?'green':'gray')}>{active?'● ACTIVÉ':'○ DÉSACTIVÉ'}</span></div>
  <div className="drawer-rules">
   <div><CheckCircle2 size={17}/> <b>Espèces</b> — ouvre le tiroir après confirmation du paiement</div>
   <div><LockKeyhole size={17}/> <b>TPE / Carte</b> — ne l’ouvre pas</div>
   <div><LockKeyhole size={17}/> <b>Commandes cuisine</b> — ne l’ouvrent pas</div>
  </div>
  <div className="printer-station-actions">
   {!active?<button type="button" className="btn primary" disabled={busy} onClick={activate}><PlugZap size={18}/> Activer tiroir sur ce WD950</button>:
   <button type="button" className="btn outline" disabled={busy} onClick={disable}><Unplug size={18}/> Désactiver</button>}
   <button type="button" className="btn outline" disabled={busy} onClick={test}><RefreshCw size={18}/> Tester ouverture tiroir</button>
  </div>
  {printer&&<p className="drawer-name">Imprimante configurée : <b>{printer}</b></p>}
  {message&&<div role="status" className={'drawer-feedback '+(isError?'error':'success')}>{isError?<AlertTriangle size={18}/>:<CheckCircle2 size={18}/>}<span>{message}</span></div>}
  <p className="printer-caution"><AlertTriangle size={16}/> Il faut lancer l’agent local Windows et le laisser ouvert. Si le pilote ouvre le tiroir à chaque impression, désactivez cette option pour ne pas l’ouvrir avec les tickets cuisine. Aucun signal n’est envoyé à distance à un autre ordinateur.</p>
 </section>;
}
