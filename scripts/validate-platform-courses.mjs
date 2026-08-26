import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {
  canonicalCourseUrl,
  classifyCourseResponse,
  extractCatalogCourseUrls,
  extractOfficialCourseCount
} from './course-validator.mjs';

const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const args=new Set(process.argv.slice(2));
const platformArg=[...args].find(x=>x.startsWith('--platform='));
const platformId=platformArg?platformArg.split('=')[1]:'plat-1';
const TIMEOUT=Number(process.env.VALIDATION_TIMEOUT_MS||15000);
const CONCURRENCY=Math.max(1,Number(process.env.VALIDATION_CONCURRENCY||6));
const REQUEST_DELAY=Math.max(0,Number(process.env.VALIDATION_REQUEST_DELAY_MS||120));
const MAX_CATALOG_PAGES=Math.max(1,Number(process.env.VALIDATION_MAX_CATALOG_PAGES||150));

function loadPlatforms(){
  const code=fs.readFileSync(path.join(ROOT,'js/platforms.js'),'utf8');
  const ctx={}; vm.createContext(ctx); vm.runInContext(code,ctx); return ctx.PLATFORMS_DATA;
}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
function readJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return fallback}}
function writeJson(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');}
function htmlDecode(value){return String(value||'').replace(/&amp;/g,'&').replace(/&#39;|&apos;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();}
function stripTags(value){return htmlDecode(String(value||'').replace(/<[^>]*>/g,' '));}
function extractH1(html){const m=String(html||'').match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);return m?stripTags(m[1]):'';}
function validFutureLearnCourseUrl(value){try{const u=new URL(value);return /(^|\.)futurelearn\.com$/i.test(u.hostname)&&/^\/courses\/[^/?#]+\/?$/.test(u.pathname)}catch{return false}}

async function fetchWithRetry(url,{attempts=3}={}){
  let last={status:0,url,html:'',error:'unknown'};
  for(let attempt=1;attempt<=attempts;attempt++){
    const ctl=new AbortController(); const timer=setTimeout(()=>ctl.abort(),TIMEOUT);
    try{
      const r=await fetch(url,{redirect:'follow',signal:ctl.signal,headers:{
        'user-agent':'DunyaAlDawratValidator/1.0 (+https://github.com/devmyskilla/Devmyskilltre)',
        'accept':'text/html,application/xhtml+xml;q=0.9,*/*;q=0.7'
      }});
      const html=await r.text().catch(()=> '');
      last={status:r.status,url:r.url||url,html,error:null};
      if(r.status!==429&&r.status<500)return last;
    }catch(error){last={status:0,url,html:'',error:error?.name==='AbortError'?'timeout':String(error?.message||error)}}
    finally{clearTimeout(timer)}
    if(attempt<attempts)await sleep(500*attempt);
  }
  return last;
}

async function crawlCurrentCatalog(platform){
  const catalogUrl=platform.link || 'https://www.futurelearn.com/courses';
  const first=await fetchWithRetry(catalogUrl);
  if(first.status<200||first.status>=400)throw new Error(`catalog HTTP ${first.status||first.error}`);
  const officialHeadlineCount=extractOfficialCourseCount(first.html);
  const urls=new Set(extractCatalogCourseUrls(first.html));
  const pageSummaries=[{page:1,httpStatus:first.status,newUrls:urls.size,totalUrls:urls.size}];
  let emptyPages=0;
  const expectedPages=officialHeadlineCount?Math.ceil(officialHeadlineCount/16)+8:MAX_CATALOG_PAGES;
  const maxPages=Math.min(MAX_CATALOG_PAGES,expectedPages);
  for(let page=2;page<=maxPages;page++){
    await sleep(REQUEST_DELAY);
    const sep=catalogUrl.includes('?')?'&':'?';
    const res=await fetchWithRetry(`${catalogUrl}${sep}page=${page}`);
    if(res.status===404||res.status===410){pageSummaries.push({page,httpStatus:res.status,newUrls:0,totalUrls:urls.size});break;}
    if(res.status<200||res.status>=400){pageSummaries.push({page,httpStatus:res.status,newUrls:0,totalUrls:urls.size,error:res.error||null});continue;}
    const before=urls.size;
    for(const u of extractCatalogCourseUrls(res.html))urls.add(u);
    const added=urls.size-before;
    pageSummaries.push({page,httpStatus:res.status,newUrls:added,totalUrls:urls.size});
    if(added===0)emptyPages++; else emptyPages=0;
    if(emptyPages>=3)break;
  }
  return {officialHeadlineCount,urls,pageSummaries};
}

function summarize(results){
  const byStatus={};
  for(const r of results)byStatus[r.status]=(byStatus[r.status]||0)+1;
  return byStatus;
}

async function validate(){
  const platforms=loadPlatforms();
  const platform=platforms.find(p=>p.id===platformId);
  if(!platform)throw new Error(`Unknown platform ${platformId}`);
  if(platformId!=='plat-1')throw new Error('This validator currently has FutureLearn-specific catalogue rules; use --platform=plat-1.');
  const dbPath=path.join(ROOT,'catalogs',`${platformId}.json`);
  const rows=readJson(dbPath,null);
  if(!Array.isArray(rows))throw new Error(`Missing database file ${dbPath}`);

  console.log(`Crawling current official catalogue for ${platform.name}...`);
  const catalog=await crawlCurrentCatalog(platform);
  console.log(`Official headline: ${catalog.officialHeadlineCount ?? 'unknown'}; unique catalogue course URLs observed: ${catalog.urls.size}`);

  const seen=new Map();
  const results=new Array(rows.length);
  const pending=[];
  for(let i=0;i<rows.length;i++){
    const row=rows[i];
    const canonical=canonicalCourseUrl(row.sourceUrl||row.url||'');
    if(!canonical||!validFutureLearnCourseUrl(canonical)){
      results[i]={id:row.id||null,title:row.title||'',sourceUrl:row.sourceUrl||row.url||'',canonicalUrl:canonical||null,status:'invalid-source-url',pageExists:false,joinable:false,listedInCatalog:false,httpStatus:0,duplicateOf:null};
      continue;
    }
    if(seen.has(canonical)){
      results[i]={id:row.id||null,title:row.title||'',sourceUrl:row.sourceUrl||row.url||'',canonicalUrl:canonical,status:'duplicate',pageExists:null,joinable:null,listedInCatalog:catalog.urls.has(canonical),httpStatus:null,duplicateOf:seen.get(canonical)};
      continue;
    }
    seen.set(canonical,row.id||`row-${i+1}`);
    pending.push(i);
  }

  let cursor=0,completed=0;
  async function worker(){
    while(true){
      const p=cursor++; if(p>=pending.length)return;
      const i=pending[p], row=rows[i], canonical=canonicalCourseUrl(row.sourceUrl||row.url||'');
      if(REQUEST_DELAY)await sleep(REQUEST_DELAY);
      const response=await fetchWithRetry(canonical);
      const classified=classifyCourseResponse({sourceUrl:canonical,finalUrl:response.url,status:response.status,html:response.html,listedInCatalog:catalog.urls.has(canonical)});
      results[i]={
        id:row.id||null,
        title:row.title||'',
        sourceUrl:row.sourceUrl||row.url||'',
        canonicalUrl:canonical,
        officialTitle:extractH1(response.html),
        ...classified,
        error:response.error||null,
        duplicateOf:null
      };
      completed++;
      if(completed%100===0||completed===pending.length)console.log(`Validated ${completed}/${pending.length} unique course URLs`);
    }
  }
  await Promise.all(Array.from({length:Math.min(CONCURRENCY,pending.length||1)},()=>worker()));

  const report={
    schemaVersion:1,
    platformId,
    platform:platform.name,
    databaseFile:`catalogs/${platformId}.json`,
    verifiedAt:new Date().toISOString(),
    databaseRecordCount:rows.length,
    uniqueDatabaseCourseUrlCount:seen.size,
    officialHeadlineCount:catalog.officialHeadlineCount,
    observedCatalogCourseUrlCount:catalog.urls.size,
    summary:summarize(results),
    catalogPages:catalog.pageSummaries,
    records:results
  };
  const out=path.join(ROOT,'catalogs','validation',`${platformId}.json`);
  writeJson(out,report);
  console.log(`Report written: ${path.relative(ROOT,out)}`);
  console.log(JSON.stringify(report.summary,null,2));
}

validate().catch(error=>{console.error(error?.stack||error);process.exit(1)});
