/* MAMOUN POS notifications: registered only after explicit employee opt-in. */
self.addEventListener('push',event=>{
 let payload={};
 try{payload=event.data?.json()||{}}catch{payload={}}
 const title=typeof payload.title==='string'?payload.title:'MAMOUN POS';
 const body=typeof payload.body==='string'?payload.body:'Nouvelle demande en salle';
 // All links are same-origin paths controlled by MAMOUN POS.
 const url=payload.url==='/?view=serveur'?payload.url:'/?view=serveur';
 event.waitUntil(self.registration.showNotification(title,{
  body,icon:'/icon',badge:'/icon',tag:String(payload.tag||'mamoun-call').slice(0,150),
  renotify:true,vibrate:[160,80,160],data:{url}
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const path=event.notification.data?.url==='/?view=serveur'?'/?view=serveur':'/';
 event.waitUntil((async()=>{
  const url=new URL(path,self.location.origin).href;
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of clients){if(client.url.startsWith(self.location.origin)){await client.focus();await client.navigate(url);return}}
  return self.clients.openWindow(url);
 })());
});
