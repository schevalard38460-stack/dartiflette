const CACHE = 'darts-friends-online-v2-room-fix';
const STATIC = ['./','./index.html','./style.css','./app.mjs','./rules.mjs','./firebase-net.mjs','./firebase-config.js','./manifest.webmanifest','./assets/franck.webp','./assets/stephane.webp','./assets/mathias.webp','./assets/trio.webp','./assets/icon-192.png','./assets/icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(STATIC)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||!event.request.url.startsWith(self.location.origin))return;
  event.respondWith(fetch(event.request).then(r=>{if(r.ok){const clone=r.clone();caches.open(CACHE).then(c=>c.put(event.request,clone));}return r;}).catch(()=>caches.match(event.request)));
});
