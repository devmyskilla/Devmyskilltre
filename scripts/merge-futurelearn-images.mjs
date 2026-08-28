import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const SHARDS=path.join(ROOT,'catalogs','validation','shards');
const OUTPUT=path.join(ROOT,'catalogs','validation','plat-1-images.json');

const files=fs.readdirSync(SHARDS).filter(name=>/^plat-1-images-shard-\d+\.json$/.test(name)).sort();
if(!files.length)throw new Error('No FutureLearn image shard files found');

const records=new Map();
const failures=[];
let activeRecordCount=0;
let validationVerifiedAt=null;
for(const file of files){
  const shard=JSON.parse(fs.readFileSync(path.join(SHARDS,file),'utf8'));
  activeRecordCount=Math.max(activeRecordCount,Number(shard.activeRecordCount||0));
  validationVerifiedAt=validationVerifiedAt||shard.validationVerifiedAt||null;
  for(const record of shard.records||[]){
    if(!record?.sourceUrl||!/^https:\/\/ugc\.futurelearn\.com\//i.test(String(record.imageUrl||'')))continue;
    records.set(record.sourceUrl,record);
  }
  failures.push(...(shard.failures||[]));
}

const merged=[...records.values()].sort((a,b)=>a.sourceUrl.localeCompare(b.sourceUrl));
const failedByUrl=new Map();
for(const failure of failures){
  if(!failure?.sourceUrl||records.has(failure.sourceUrl))continue;
  failedByUrl.set(failure.sourceUrl,failure);
}
const unresolved=[...failedByUrl.values()].sort((a,b)=>a.sourceUrl.localeCompare(b.sourceUrl));
const output={
  schemaVersion:2,
  platformId:'plat-1',
  platform:'FutureLearn',
  generatedAt:new Date().toISOString(),
  validationVerifiedAt,
  activeRecordCount,
  shardFiles:files.length,
  failureCount:unresolved.length,
  count:merged.length,
  failures:unresolved,
  records:merged
};
fs.mkdirSync(path.dirname(OUTPUT),{recursive:true});
fs.writeFileSync(OUTPUT,JSON.stringify(output,null,2)+'\n');
console.log(`Merged ${merged.length}/${activeRecordCount} FutureLearn official course images from ${files.length} shards; unresolved ${unresolved.length}`);
if(merged.length<1000)throw new Error(`Too few FutureLearn official images after merge: ${merged.length}`);
