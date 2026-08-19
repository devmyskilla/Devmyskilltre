import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { extractJsonLdCourses, extractAnchorCourses, parseSitemap, mergeCourseRecords, inferCoursePathPatterns, recordFromUrl } from './catalog-tools.mjs';

const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const CATALOG_DIR=path.join(ROOT,'catalogs');
const MANIFEST_PATH=path.join(CATALOG_DIR,'manifest.json');
const TIMEOUT=Number(process.env.CATALOG_TIMEOUT_MS||12000);
const SITEMAP_LIMIT=Number(process.env.CATALOG_SITEMAP_LIMIT||12);
const URL_LIMIT=Number(process.env.CATALOG_URL_LIMIT||5000);
const args=new Set(process.argv.slice(2));
const platformArg=[...args].find(x=>x.startsWith('--platform='));
const onlyId=platformArg?platformArg.split('=')[1]:null;

function loadPlatforms(){
  const code=fs.readFileSync(path.join(ROOT,'js/platforms.js'),'utf8');
  const ctx={}; vm.createContext(ctx); vm.runInContext(code,ctx); return ctx.PLATFORMS_DATA;
}
const PLATFORMS_DATA=loadPlatforms();

function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
async function fetchText(url){
  const ctl=new AbortController(); const timer=setTimeout(()=>ctl.abort(),TIMEOUT);
  try{
    const r=await fetch(url,{redirect:'follow',signal:ctl.signal,headers:{'user-agent':'DunyaAlDawratCatalogBot/1.0 (+https://devmyskilla.github.io/)','accept':'text/html,application/xml,text/xml;q=0.9,*/*;q=0.7'}});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    return await r.text();
  }finally{clearTimeout(timer);}
}
function readJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return fallback}}
function writeJson(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');}
function normalizeImported(rows,platform){
  const today=new Date().toISOString().slice(0,10);
  return mergeCourseRecords(rows).slice(0,URL_LIMIT).map((r,i)=>({
    id:`${platform.id}-catalog-${i+1}`,
    title:r.title,
    summary:r.summary||'',
    platform:platform.name,
    provider:r.provider||platform.name,
    sourceUrl:r.sourceUrl,
    thumbnail:platform.thumbnail,
    recordType:'source-only',
    free:platform.free,
    certificate:platform.certificate,
    language:platform.language,
    lastVerified:today
  }));
}
function urlMatches(url,patterns){
  const low=String(url).toLowerCase(); return patterns.some(p=>low.includes(String(p).toLowerCase()));
}
async function sitemapCandidates(platform,patterns){
  const origin=new URL(platform.link).origin;
  let sitemapUrls=[];
  try{
    const robots=await fetchText(new URL('/robots.txt',origin).href);
    sitemapUrls=[...robots.matchAll(/^\s*Sitemap:\s*(\S+)\s*$/gim)].map(m=>m[1]);
  }catch{}
  if(!sitemapUrls.length)sitemapUrls=[new URL('/sitemap.xml',origin).href];
  const queue=[...new Set(sitemapUrls)], seen=new Set(), urls=[];
  while(queue.length&&seen.size<SITEMAP_LIMIT&&urls.length<URL_LIMIT){
    const sm=queue.shift(); if(seen.has(sm))continue; seen.add(sm);
    try{
      const xml=await fetchText(sm); const parsed=parseSitemap(xml);
      if(parsed.type==='index'){
        for(const child of parsed.urls){if(!seen.has(child)&&queue.length+seen.size<SITEMAP_LIMIT)queue.push(child);}
      }else{
        for(const u of parsed.urls){if(urlMatches(u,patterns)){urls.push(u);if(urls.length>=URL_LIMIT)break;}}
      }
    }catch{}
  }
  return urls;
}
async function syncPlatform(platform){
  const shardPath=path.join(CATALOG_DIR,`${platform.id}.json`);
  const existing=readJson(shardPath,[]);
  const patterns=inferCoursePathPatterns(platform);
  let htmlRows=[], sitemapRows=[], error='';
  try{
    const html=await fetchText(platform.link);
    htmlRows=[...extractJsonLdCourses(html,platform.link),...extractAnchorCourses(html,platform.link,patterns)];
  }catch(e){error=`catalog: ${e.message}`;}
  try{
    const urls=await sitemapCandidates(platform,patterns);
    sitemapRows=urls.map(u=>recordFromUrl(u,platform));
  }catch(e){error=[error,`sitemap: ${e.message}`].filter(Boolean).join('; ');}
  const fresh=normalizeImported([...htmlRows,...sitemapRows],platform);
  // Preserve an existing shard when a source temporarily blocks or returns no usable records.
  const output=fresh.length?fresh:existing;
  if(fresh.length)writeJson(shardPath,output);
  return {id:platform.id,name:platform.name,sourceUrl:platform.link,count:output.length,freshCount:fresh.length,status:fresh.length?'updated':existing.length?'preserved':'unavailable',updatedAt:new Date().toISOString(),error:error||null};
}

fs.mkdirSync(CATALOG_DIR,{recursive:true});
const previousManifest=readJson(MANIFEST_PATH,{platforms:{}});
const selected=PLATFORMS_DATA.filter(p=>!onlyId||p.id===onlyId);
if(!selected.length){console.error(`Unknown platform: ${onlyId}`);process.exit(2);}
const manifest={generatedAt:new Date().toISOString(),platformCount:PLATFORMS_DATA.length,platforms:{...(previousManifest.platforms||{})}};
let i=0;
for(const platform of selected){
  i++; process.stdout.write(`[${i}/${selected.length}] ${platform.name} ... `);
  try{const row=await syncPlatform(platform);manifest.platforms[platform.id]=row;console.log(`${row.status} (${row.count})`);}catch(e){manifest.platforms[platform.id]={id:platform.id,name:platform.name,sourceUrl:platform.link,count:0,freshCount:0,status:'error',updatedAt:new Date().toISOString(),error:e.message};console.log(`error: ${e.message}`);}
  await sleep(120);
}
writeJson(MANIFEST_PATH,manifest);
console.log(`Manifest: ${path.relative(ROOT,MANIFEST_PATH)}`);
