// Platform 1 of the active 40-platform catalog scope.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const VALIDATION=path.join(ROOT,'catalogs','validation','plat-1.json');
const CONCURRENCY=Math.max(1,Number(process.env.FUTURELEARN_IMAGE_CONCURRENCY||2));
const SHARD_COUNT=Math.max(1,Number(process.env.FUTURELEARN_SHARD_COUNT||1));
const SHARD_INDEX=Math.max(0,Number(process.env.FUTURELEARN_SHARD_INDEX||0));
const OUTPUT=process.env.FUTURELEARN_IMAGE_OUTPUT
  ? path.resolve(ROOT,process.env.FUTURELEARN_IMAGE_OUTPUT)
  : path.join(ROOT,'catalogs','validation',SHARD_COUNT>1?`plat-1-images-shard-${SHARD_INDEX}.json`:'plat-1-images.json');
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
  const text=String(markdown||'');
  // A FutureLearn course page can contain unrelated featured-course thumbnails
  // before the current course. The current course artwork is the header_* image.
  const header=text.match(/!\[[^\]]*\]\((https:\/\/ugc\.futurelearn\.com\/[^)\s]*\/header_[^)\s]+)\)/i);
  if(header)return header[1].replace(/&amp;/g,'&');
  const thumbnail=text.match(/!\[[^\]]*\]\((https:\/\/ugc\.futurelearn\.com\/[^)\s]*\/thumbnail_[^)\s]+)\)/i);
  return thumbnail?thumbnail[1].replace(/&amp;/g,'&'):'';
}

async function fetchReader(targetUrl,{attempts=6}={}){
  const url=`${READER_BASE}${targetUrl}`;
  let lastError='unknown';
  for(let attempt=1;attempt<=attempts;attempt++){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),60000);
    try{
      const response=await fetch(url,{signal:controller.signal,headers:{accept:'text/plain','user-agent':'DunyaAlDawratImageSync/2.0'}});
      const body=await response.text();
      if(response.ok)return body;
      lastError=`HTTP ${response.status}`;
      if(response.status!==429&&response.status<500)break;
    }catch(error){lastError=error?.name==='AbortError'?'timeout':String(error?.message||error)}
    finally{clearTimeout(timer)}
    if(attempt<attempts)await sleep(Math.min(45000,5000*Math.pow(2,attempt-1)));
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
      // Small per-worker pause lowers the chance of reader rate limiting.
      await sleep(600);
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

async function main(){
  if(!fs.existsSync(VALIDATION))throw new Error('Missing catalogs/validation/plat-1.json');
  if(SHARD_INDEX>=SHARD_COUNT)throw new Error(`Invalid shard ${SHARD_INDEX}/${SHARD_COUNT}`);
  const {report,active}=readValidation();
  const shard=active.filter((_,index)=>index%SHARD_COUNT===SHARD_INDEX);
  console.log(`FutureLearn active records: ${active.length}; shard ${SHARD_INDEX+1}/${SHARD_COUNT}: ${shard.length}`);

  const records=[];
  const failures=[];
  let done=0;
  await mapLimit(shard,CONCURRENCY,async item=>{
    try{
      const markdown=await fetchReader(item.finalUrl||item.sourceUrl);
      const imageUrl=extractPrimaryCourseImage(markdown);
      if(imageUrl){
        records.push({id:item.id,sourceUrl:item.sourceUrl,imageUrl,validationStatus:item.status});
      }else{
        failures.push({...item,error:'no current-course header/thumbnail image found'});
      }
    }catch(error){
      failures.push({...item,error:String(error?.message||error)});
    }
    done++;
    if(done%25===0||done===shard.length)console.log(`Shard ${SHARD_INDEX+1}: ${done}/${shard.length}; images ${records.length}; failures ${failures.length}`);
  });

  records.sort((a,b)=>a.sourceUrl.localeCompare(b.sourceUrl));
  failures.sort((a,b)=>a.sourceUrl.localeCompare(b.sourceUrl));
  const output={
    schemaVersion:2,
    platformId:'plat-1',
    platform:'FutureLearn',
    generatedAt:new Date().toISOString(),
    validationVerifiedAt:report.verifiedAt||null,
    activeRecordCount:active.length,
    shardIndex:SHARD_INDEX,
    shardCount:SHARD_COUNT,
    shardRecordCount:shard.length,
    failureCount:failures.length,
    count:records.length,
    failures,
    records
  };
  fs.mkdirSync(path.dirname(OUTPUT),{recursive:true});
  fs.writeFileSync(OUTPUT,JSON.stringify(output,null,2)+'\n');
  console.log(`FutureLearn image shard written: ${path.relative(ROOT,OUTPUT)} (${records.length}/${shard.length})`);
  if(records.length===0)throw new Error('No FutureLearn course images were resolved in this shard');
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(error=>{console.error(error?.stack||error);process.exit(1)});
}
