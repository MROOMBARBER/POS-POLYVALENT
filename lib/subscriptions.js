/**
 * POS subscription policy. Every date is Morocco-local (Africa/Casablanca),
 * inclusive to the end of the selected date.
 * Existing tenants without a subscription are grandfathered during migration.
 * Demo tenants remain free.
 */
export function casablancaDate(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Africa/Casablanca',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const n=Object.fromEntries(parts.filter(v=>v.type!=='literal').map(v=>[v.type,v.value]));
 return n.year+'-'+n.month+'-'+n.day;
}
export function validDateString(s){
 if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
 const d=new Date(s+'T12:00:00.000Z');
 return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s;
}
export function subscriptionStatus(tenant,now=new Date()){
 if(!tenant||tenant.status!=='active')return 'suspended';
 if(tenant.isDemo===true)return 'demo';
 const s=tenant.subscription;
 if(!s)return 'legacy';
 if(s.status==='suspended')return 'suspended';
 if(s.status!=='active')return 'pending';
 if(!validDateString(s.endsOn))return 'pending';
 return s.endsOn<casablancaDate(now)?'expired':'active';
}
export function canOperate(tenant,now=new Date()){
 return ['demo','legacy','active'].includes(subscriptionStatus(tenant,now));
}
export function normalizeSubscription(input){
 const status=String(input?.status||'');
 if(!['active','pending','suspended'].includes(status))throw Error('Statut abonnement invalide');
 const priceMad=Number(input?.priceMad);
 if(!Number.isFinite(priceMad)||priceMad<0||priceMad>100000||Math.round(priceMad*100)!==priceMad*100)throw Error('Prix MAD invalide');
 const startsOn=String(input?.startsOn||'');
 const endsOn=String(input?.endsOn||'');
 if(status==='active'&&(!validDateString(startsOn)||!validDateString(endsOn)||endsOn<startsOn))throw Error('Dates de début et fin invalides');
 if(startsOn&&!validDateString(startsOn))throw Error('Date de début invalide');
 if(endsOn&&!validDateString(endsOn))throw Error('Date de fin invalide');
 if(startsOn&&endsOn&&endsOn<startsOn)throw Error('La fin doit être après le début');
 return {status,priceMad,startsOn,endsOn,billingCycle:'monthly',notes:String(input?.notes||'').trim().slice(0,250)};
}
