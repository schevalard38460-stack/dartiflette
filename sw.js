const CACHE = 'darts-friends-v09-20261120-flight-orientation';
const STATIC = ['./','./index.html','./style.css','./app.mjs','./rules.mjs','./show.mjs','./flight-path.mjs','./dart-render.mjs','./audio.mjs','./reactions.mjs','./firebase-net.mjs','./firebase-config.js','./manifest.webmanifest','./assets/franck.webp','./assets/stephane.webp','./assets/mathias.webp','./assets/trio.webp','./assets/invite.svg','./assets/icon-192.png','./assets/icon-512.png','./audio/release.ogg','./audio/flight.ogg','./audio/impact.ogg','./audio/big_hit.ogg','./audio/miss.ogg','./audio/cheer.ogg','./audio/groan.ogg','./audio/bravo.ogg','./audio/tocar.ogg','./audio/miskine.ogg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(STATIC)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||!event.request.url.startsWith(self.location.origin))return;
  event.respondWith(fetch(event.request).then(r=>{if(r.ok){const clone=r.clone();caches.open(CACHE).then(c=>c.put(event.request,clone));}return r;}).catch(()=>caches.match(event.request)));
});
