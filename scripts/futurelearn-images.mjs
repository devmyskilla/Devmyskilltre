// Platform 1 of the active 40-platform catalog scope.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const OUTPUT=path.join(ROOT,'catalogs','validation','plat-1-images.json');
const VALIDATION=path.join(ROOT,'catalogs','validation','plat-1.json');
const CONCURRENCY=Math.max(1,Number(process.env.FUTURELEARN_IMAGE_CONCURRENCY||2));
const MAX_PAGES=Math.max(1,Number(process.env.FUTURELEARN_IMAGE_MAX_PAGES||115));
const READER_BASE='https://r.jina.ai/';
const ACTIVE_STATUSES=new Set(['active-listed','redirected-active-listed','active-unlisted','redirected-active-unlisted']);

function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}

export function canonicalFutureLearnCourseUrl(value){
  try{
    const u=new URL(value);
    if(!/(^|\.)futurelearn\.com$/i.test(u.hostname))return '';
    const match=u.pathname.match(/^\/courses\/([^/?#]+)/i);
    if(!match)return '';
    return `https://www.futurelearn.com/courses/${match[1]}`;
  }catch{return ''}
}

export function extractCourseCountFromMarkdown(markdown){
  const match=String(markdown||'').match(/Explore\s+([\d,]+)\s+courses/i);
  return match?Number(match[1].replace(/,/g,'')):null;
}

export function extractCourseImagePairs(markdown){
  const records=[];
  const seen=new Set();
  const pattern=/\[!\[[^\]]*\]\((https:\/\/ugc\.futurelearn\.com\/[^)\s]+)\)[^\]]*\]\((https:\/\/(?:www\.)?futurelearn\.com\/courses\/[^)\s]+)\)/gi;
  for(const match of String(markdown||'').matchAll(pattern)){
    const sourceUrl=canonicalFutureLearnCourseUrl(match[2]);
    const imageUrl=match[1].replace(/&amp;/g,'&');
    if(!sourceUrl||!/^https:\/\/ugc\.futurelearn\.com\//i.test(imageUrl))continue;
    if(seen.has(sourceUrl))continue;
    seen.add(sourceUrl);
    records.push({sourceUrl,imageUrl});
  }
  return records;
}

export function extractPrimaryCourseImage(markdown){
  for(const match of String(markdown||'').matchAll(/!\[[^\]]*\]\((https:\/\/ugc\.futurelearn\.com\/[^)\s]+)\)/gi)){
    const url=match[1].replace(/&amp;/g,'&');
    if(/\/(?:header|thumbnail)_[^/]+\.(?:jpe?g|png|webp)(?:\?.*)?$/i.test(url))return url;
  }
  const fallback=String(markdown||'').match(/!\[[^\]]*\]\((https:\/\/ugc\.futurelearn\.com\/[^)\s]+)\)/i);
  return fallback?fallback[1].replace(/&amp;/g,'&'):'';
}

async function fetchReader(targetUrl,{attempts=4}={}){
  const url=`${READER_BASE}${targetUrl}`;
  let lastError='unknown';
  for(let attempt=1;attempt<=attempts;attempt++){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),60000);
    try{
      const response=await fetch(url,{signal:controller.signal,headers:{'accept':'text/plain','user-agent':'DunyaAlDawratImageSync/1.0'}});
      const body=await response.text();
      if(response.ok)return body;
      lastError=`HTTP ${response.status}`;
      if(response.status!==429&&response.status<500)break;
    }catch(error){lastError=error?.name==='AbortError'?'timeout':String(error?.message||error)}
    finally{clearTimeout(timer)}
    if(attempt<attempts)await sleep(Math.min(30000,4000*attempt));
  }
  throw new Error(`${lastError} reading ${targetUrl}`);
}

async function mapLimit(items,limit,worker){
  const results=new Array(items.length);
  let cursor=0;
  async function run(){
    while(true){
      const index=cursor++;
      if(index>=items.length)return;
      results[index]=await worker(items[index],index);
    }
  }
  await Promise.all(Array.from({length:Math.min(limit,items.length||1)},run));
  return results;
}

function readValidation(){
  const report=JSON.parse(fs.readFileSync(VALIDATION,'utf8'));
  const active=[];
  for(const record of report.records||[]){
    if(!ACTIVE_STATUSES.has(record.status))continue;
    const sourceUrl=canonicalFutureLearnCourseUrl(record.sourceUrl||record.canonicalUrl||record.finalUrl||'');
    const finalUrl=canonicalFutureLearnCourseUrl(record.finalUrl||'');
    if(sourceUrl)active.push({id:record.id||null,sourceUrl,finalUrl:finalUrl||sourceUrl,status:record.status});
  }
  const dedup=new Map();
  for(const item of active)if(!dedup.has(item.sourceUrl))dedup.set(item.sourceUrl,item);
  return {report,active:[...dedup.values()]};
}

async function crawlCatalog(){
  const first=await fetchReader('https://www.futurelearn.com/courses?page=1');
  const total=extractCourseCountFromMarkdown(first);
  const imageMap=new Map(extractCourseImagePairs(first).map(x=>[x.sourceUrl,x.imageUrl]));
  const pages=[];
  pages.push({page:1,pairs:extractCourseImagePairs(first).length,totalMapped:imageMap.size});
  const estimated=total?Math.ceil(total/16)+3:MAX_PAGES;
  const maxPages=Math.min(MAX_PAGES,Math.max(1,estimated));
  const pageNumbers=Array.from({length:Math.max(0,maxPages-1)},(_,i)=>i+2);
  let completed=1;
  await mapLimit(pageNumbers,CONCURRENCY,async page=>{
    const md=await fetchReader(`https://www.futurelearn.com/courses?page=${page}`);
    const pairs=extractCourseImagePairs(md);
    for(const pair of pairs)if(!imageMap.has(pair.sourceUrl))imageMap.set(pair.sourceUrl,pair.imageUrl);
    completed++;
    pages.push({page,pairs:pairs.length,totalMapped:imageMap.size});
    if(completed%10===0||completed===maxPages)console.log(`Catalog pages ${completed}/${maxPages}; mapped ${imageMap.size} course images`);
    return pairs.length;
  });
  pages.sort((a,b)=>a.page-b.page);
  return {total,maxPages,imageMap,pages};
}

async function main(){
  if(!fs.existsSync(VALIDATION))throw new Error('Missing catalogs/validation/plat-1.json');
  const {report,active}=readValidation();
  console.log(`Active FutureLearn records from validation report: ${active.length}`);

  const catalog=await crawlCatalog();
  console.log(`FutureLearn catalogue headline: ${catalog.total??'unknown'}; official image pairs mapped: ${catalog.imageMap.size}`);

  const finalMap=new Map();
  const unresolved=[];
  for(const item of active){
    const image=catalog.imageMap.get(item.sourceUrl)||catalog.imageMap.get(item.finalUrl)||'';
    if(image)finalMap.set(item.sourceUrl,image);
    else unresolved.push(item);
  }
  console.log(`Active records resolved from catalogue pages: ${finalMap.size}; unresolved active records: ${unresolved.length}`);

  const failures=[];
  let directDone=0;
  await mapLimit(unresolved,CONCURRENCY,async item=>{
    try{
      const md=await fetchReader(item.finalUrl||item.sourceUrl);
      const image=extractPrimaryCourseImage(md);
      if(image)finalMap.set(item.sourceUrl,image);
      else failures.push({...item,error:'no official UGC image found'});
    }catch(error){failures.push({...item,error:String(error?.message||error)});}
    directDone++;
    if(directDone%10===0||directDone===unresolved.length)console.log(`Direct fallback ${directDone}/${unresolved.length}; total mapped ${finalMap.size}`);
  });

  const records=active
    .filter(item=>finalMap.has(item.sourceUrl))
    .map(item=>({id:item.id,sourceUrl:item.sourceUrl,imageUrl:finalMap.get(item.sourceUrl),validationStatus:item.status}));

  const output={
    schemaVersion:1,
    platformId:'plat-1',
    platform:'FutureLearn',
    generatedAt:new Date().toISOString(),
    validationVerifiedAt:report.verifiedAt||null,
    activeRecordCount:active.length,
    catalogHeadlineCount:catalog.total,
    catalogPagesFetched:catalog.maxPages,
    catalogImagePairCount:catalog.imageMap.size,
    directFallbackAttemptCount:unresolved.length,
    failureCount:failures.length,
    count:records.length,
    failures,
    records
  };
  fs.mkdirSync(path.dirname(OUTPUT),{recursive:true});
  fs.writeFileSync(OUTPUT,JSON.stringify(output,null,2)+'\n');
  console.log(`Official image map written: ${path.relative(ROOT,OUTPUT)} (${records.length}/${active.length})`);
  if(records.length<1000)throw new Error(`Only ${records.length} active FutureLearn images were resolved`);
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(error=>{console.error(error?.stack||error);process.exit(1)});
}
