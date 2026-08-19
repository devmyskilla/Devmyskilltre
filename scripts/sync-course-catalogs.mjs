import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {
  extractJsonLdCourses, extractAnchorCourses, parseSitemap, mergeCourseRecords,
  inferCoursePathPatterns, recordFromUrl, platformFileName, cleanCourseRecords
} from './catalog-tools.mjs';

const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const CATALOG_DIR=path.join(ROOT,'catalogs');
const RAW_DIR=path.join(CATALOG_DIR,'raw');
const CLEAN_DIR=path.join(CATALOG_DIR,'clean');
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
    const r=await fetch(url,{redirect:'follow',signal:ctl.signal,headers:{'user-agent':'DunyaAlDawratCatalogBot/2.0 (+https://github.com/devmyskilla/Devmyskilltre)','accept':'text/html,application/xml,text/xml;q=0.9,*/*;q=0.7'}});
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
  const fileName=platformFileName(platform.name,platform.id);
  const rawPath=path.join(RAW_DIR,fileName);
  const cleanPath=path.join(CLEAN_DIR,fileName);
  const legacyPath=path.join(CATALOG_DIR,`${platform.id}.json`);
  const existingRaw=readJson(rawPath,readJson(legacyPath,[]));
  const existingClean=readJson(cleanPath,cleanCourseRecords(existingRaw,platform));
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

  const freshRaw=normalizeImported([...htmlRows,...sitemapRows],platform);
  const freshClean=cleanCourseRecords(freshRaw,platform).slice(0,URL_LIMIT);
  const rawOutput=freshRaw.length?freshRaw:existingRaw;
  const cleanOutput=freshClean.length?freshClean:existingClean;

  // V2 always writes a platform-named file, even when a source is currently unavailable.
  writeJson(rawPath,rawOutput);
  writeJson(cleanPath,cleanOutput);

  const status=freshClean.length?'updated':freshRaw.length?'raw-updated':existingClean.length||existingRaw.length?'preserved':'unavailable';
  return {
    id:platform.id,
    name:platform.name,
    fileName,
    rawFile:`catalogs/raw/${fileName}`,
    cleanFile:`catalogs/clean/${fileName}`,
    sourceUrl:platform.link,
    count:cleanOutput.length,
    rawCount:rawOutput.length,
    cleanCount:cleanOutput.length,
    freshCount:freshClean.length,
    freshRawCount:freshRaw.length,
    freshCleanCount:freshClean.length,
    status,
    updatedAt:new Date().toISOString(),
    error:error||null
  };
}

fs.mkdirSync(RAW_DIR,{recursive:true});
fs.mkdirSync(CLEAN_DIR,{recursive:true});
const previousManifest=readJson(MANIFEST_PATH,{platforms:{}});
const selected=PLATFORMS_DATA.filter(p=>!onlyId||p.id===onlyId);
if(!selected.length){console.error(`Unknown platform: ${onlyId}`);process.exit(2);}
const manifest={
  schemaVersion:2,
  generatedAt:new Date().toISOString(),
  platformCount:PLATFORMS_DATA.length,
  directories:{raw:'catalogs/raw',clean:'catalogs/clean'},
  platforms:{...(previousManifest.platforms||{})}
};
let i=0;
for(const platform of selected){
  i++; process.stdout.write(`[${i}/${selected.length}] ${platform.name} ... `);
  try{
    const row=await syncPlatform(platform);
    manifest.platforms[platform.id]=row;
    console.log(`${row.status} (raw ${row.rawCount} → clean ${row.cleanCount})`);
  }catch(e){
    const fileName=platformFileName(platform.name,platform.id);
    manifest.platforms[platform.id]={
      id:platform.id,name:platform.name,fileName,
      rawFile:`catalogs/raw/${fileName}`,cleanFile:`catalogs/clean/${fileName}`,
      sourceUrl:platform.link,count:0,rawCount:0,cleanCount:0,freshCount:0,freshRawCount:0,freshCleanCount:0,
      status:'error',updatedAt:new Date().toISOString(),error:e.message
    };
    writeJson(path.join(RAW_DIR,fileName),readJson(path.join(RAW_DIR,fileName),[]));
    writeJson(path.join(CLEAN_DIR,fileName),readJson(path.join(CLEAN_DIR,fileName),[]));
    console.log(`error: ${e.message}`);
  }
  await sleep(120);
}
writeJson(MANIFEST_PATH,manifest);
console.log(`Manifest: ${path.relative(ROOT,MANIFEST_PATH)}`);
