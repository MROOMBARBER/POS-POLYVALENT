/**
 * HTML ESCAPED receipt formatter. Actual output goes through the browser's
 * print system on the cashier's Windows terminal, never via Vercel.
 */
export function escapeReceipt(value){
 return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
const euroDate=value=>{
 const date=value?.toDate?.()|| (typeof value?.seconds==='number'?new Date(value.seconds*1000):value instanceof Date?value:new Date());
 return new Intl.DateTimeFormat('fr-MA',{timeZone:'Africa/Casablanca',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(date);
};
function safeAmount(n){return Number.isFinite(Number(n))?Number(n).toFixed(2)+' DH':'—'}
export function orderReceiptHtml(order,tenant,{test=false}={}){
 const items=Array.isArray(order?.items)?order.items.slice(0,100):[];
 const itemRows=items.map(i=>'<tr><td style="width:40px;vertical-align:top"><b>'+escapeReceipt(i.qty||1)+' ×</b></td><td>'+escapeReceipt(i.name||'Article')+'</td></tr>').join('');
 const name=escapeReceipt(tenant?.name||'MAMOUN POS');
 const table=escapeReceipt(order?.tableName||'Comptoir');
 const note=order?.note?'<div class="note">NOTE : '+escapeReceipt(order.note)+'</div>':'';
 const time=euroDate(order?.createdAt);
 const source=order?.source==='customer'?'QR / NFC':'CAISSE';
 return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Ticket 80mm</title><style>
 @page{margin:0}
 html,body{margin:0;padding:0;background:#fff;color:#000}
 body{box-sizing:border-box;width:72mm;max-width:72mm;padding:3mm 1mm;font:13px/1.35 'Courier New',monospace;overflow-wrap:anywhere}
 .center{text-align:center}.big{font-size:20px;font-weight:900}.bold{font-weight:800}
 .line{border-top:1px dashed #111;margin:8px 0}
 h1{font-size:18px;margin:7px 0}.sub{font-size:11px}
 table{width:100%;border-collapse:collapse;font-size:14px}
 td{padding:5px 1px;border-bottom:1px dotted #bbb}
 .note{padding:7px 0;font-weight:700;white-space:pre-wrap}
 .end{font-size:10px;text-align:center;margin-top:10px}
 </style></head><body>
 <div class="center bold">${name}</div><div class="center sub">TICKET PRÉPARATION • NON FISCAL</div>
 <div class="line"></div>
 <div class="center big">${test?'TEST IMPRIMANTE':table}</div>
 <div class="center sub">${test?'ESSAI USB 80MM':escapeReceipt(source)} · ${escapeReceipt(time)}</div>
 <div class="line"></div>
 ${test?'<h1 class="center">✓ Impression 80mm</h1><div class="center">MAMOUN POS fonctionne !</div>':
 `<table><tbody>${itemRows}</tbody></table>${note}
 <div class="line"></div><div class="bold">TOTAL : ${escapeReceipt(safeAmount(order?.total))}</div>`}
 <div class="line"></div><div class="end">MAMOUN POS · SERVICE LOCAL</div>
 </body></html>`;
}
