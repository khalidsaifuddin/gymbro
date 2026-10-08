const CACHE=__CACHE__;
const ASSETS=__ASSETS__;
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);await cache.addAll(ASSETS);await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const name of await caches.keys())if(name.startsWith('gymbro-assets-')&&name!==CACHE)await caches.delete(name);
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||url.search||!ASSETS.includes(url.pathname))return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE);return await cache.match(request)??fetch(request);})());
});
self.addEventListener('message',event=>{
 if(event.data?.kind!=='offline-status'||!event.ports[0])return;
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE),results=await Promise.all(ASSETS.map(path=>cache.match(path)));
  event.ports[0].postMessage({ready:results.every(Boolean)});
 })());
});
