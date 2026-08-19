const CACHE='dunya-al-dawrat-v7-performance';
const CORE=['./','./index.html','./course.html','./platform.html','./offline.html','./css/style.css','./js/i18n.js','./js/platforms.js','./js/data.js','./js/catalog-core.js','./js/catalog-runtime.js','./js/app.js','./js/detail.js','./js/platform-detail.js','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  // Large catalog JSON files are loaded only when the user opens a platform.
  // Let the browser use normal HTTP caching and never force them into the PWA cache.
  if(url.pathname.includes('/catalogs/'))return;
  const fresh=event.request.mode==='navigate'||['script','style','document'].includes(event.request.destination)||/\.(?:html|js|css)$/.test(url.pathname);
  if(fresh){event.respondWith(fetch(event.request).then(response=>{if(response&&response.ok){const clone=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,clone))}return response}).catch(()=>caches.match(event.request,{ignoreSearch:true}).then(c=>c||caches.match('./offline.html'))));return;}
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(response&&response.ok){const clone=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,clone))}return response}).catch(()=>caches.match('./offline.html'))));
});
