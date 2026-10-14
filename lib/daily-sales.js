import {casablancaDate} from './subscriptions';
function toJsDate(value){
 if(value?.toDate)return value.toDate();
 if(value instanceof Date)return value;
 if(typeof value?.seconds==='number')return new Date(value.seconds*1000);
 return null;
}
export function salesForDate(orders,date){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||'')))return null;
 const created=orders.filter(o=>{
  const d=toJsDate(o.createdAt);
  return d&&casablancaDate(d)===date;
 });
 const collected=orders.filter(o=>{
  if(o.status!=='paid')return false;
  const d=toJsDate(o.paidAt)||toJsDate(o.createdAt);
  return d&&casablancaDate(d)===date;
 });
 const total=collected.reduce((sum,o)=>sum+Number(o.total||0),0);
 const cash=collected.filter(o=>o.paymentMethod==='cash').reduce((sum,o)=>sum+Number(o.total||0),0);
 const card=collected.filter(o=>o.paymentMethod==='card').reduce((sum,o)=>sum+Number(o.total||0),0);
 const other=total-cash-card;
 return {
  date,total:Math.round(total*100)/100,
  cash:Math.round(cash*100)/100,
  card:Math.round(card*100)/100,
  other:Math.max(0,Math.round(other*100)/100),
  orders:created.length,cancelled:created.filter(o=>o.status==='cancelled').length,
  outstanding:created.filter(o=>!['paid','cancelled'].includes(o.status)).length,
  paid:collected.length,
  average:collected.length?Math.round(total/collected.length*100)/100:0,
 };
}
