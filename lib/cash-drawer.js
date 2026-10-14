/**
 * Browser -> locally installed WD950 Windows cash-drawer agent.
 * Never call this from a Vercel server: USB drawer hardware is on the POS itself.
 * This is opt-in per Windows browser and tenant. No keys or server credentials.
 */
export const DRAWER_AGENT_URL='http://127.0.0.1:17953';
export function drawerStorageKey(tenantId){return 'mamoun-pos-cash-drawer:'+tenantId}
export function drawerEnabled(tenantId){
 if(!tenantId||typeof window==='undefined')return false;
 try{return localStorage.getItem(drawerStorageKey(tenantId))==='yes'}catch{return false}
}
export function setDrawerEnabled(tenantId,enabled){
 if(!tenantId||typeof window==='undefined')return;
 localStorage.setItem(drawerStorageKey(tenantId),enabled?'yes':'no');
 window.dispatchEvent(new CustomEvent('mamoun-drawer-setting',{detail:{tenantId,enabled}}));
}
async function command(path){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),3600);
 try{
  const res=await fetch(DRAWER_AGENT_URL+path,{
   method:path==='/open'?'POST':'GET',
   mode:'cors',cache:'no-store',credentials:'omit',signal:controller.signal,
   ...(path==='/open'?{headers:{'Content-Type':'text/plain'}}:{})
  });
  const answer=await res.json().catch(()=>({}));
  if(!res.ok||answer.ok!==true)throw Error(answer.error||'Tiroir indisponible');
  return answer;
 }catch(err){
  if(err.name==='AbortError')throw Error('Agent WD950 ne répond pas. Vérifiez que le programme Windows est ouvert.');
  if(err instanceof TypeError)throw Error('Connexion au tiroir indisponible. Démarrez Agent Tiroir sur le WD950 et autorisez l’accès réseau local dans Chrome.');
  throw err;
 }finally{clearTimeout(timer)}
}
export async function drawerHealth(){return command('/health')}
export async function openCashDrawer(){return command('/open')}
