export function canonicalCourseUrl(value){
  try{
    const u=new URL(value,'https://www.futurelearn.com');
    u.hash=''; u.search='';
    const pathname=u.pathname.replace(/\/+$/,'');
    return `${u.origin}${pathname}`;
  }catch{return ''}
}

function decodeHtml(value){
  return String(value||'')
    .replace(/&amp;/gi,'&')
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'")
    .replace(/&lt;/gi,'<')
    .replace(/&gt;/gi,'>');
}

function tagAttributes(tag){
  const out={};
  for(const m of String(tag||'').matchAll(/([:\w-]+)\s*=\s*(["'])([\s\S]*?)\2/g)){
    out[m[1].toLowerCase()]=decodeHtml(m[3]).trim();
  }
  return out;
}

function absoluteImageUrl(value,pageUrl){
  if(!value)return '';
  try{
    const u=new URL(decodeHtml(value),pageUrl||'https://www.futurelearn.com');
    if(!/^https?:$/.test(u.protocol))return '';
    return u.href;
  }catch{return ''}
}

function jsonLdImage(value){
  if(typeof value==='string')return value;
  if(Array.isArray(value)){
    for(const item of value){const found=jsonLdImage(item);if(found)return found;}
    return '';
  }
  if(value&&typeof value==='object'){
    if(value.url)return jsonLdImage(value.url);
    if(value.contentUrl)return jsonLdImage(value.contentUrl);
  }
  return '';
}

export function extractOfficialCourseImage(html,pageUrl='https://www.futurelearn.com'){
  const metas=[];
  for(const m of String(html||'').matchAll(/<meta\b[^>]*>/gi)){
    const attrs=tagAttributes(m[0]);
    const key=String(attrs.property||attrs.name||'').toLowerCase();
    const content=attrs.content||'';
    if(key&&content)metas.push({key,content});
  }
  for(const key of ['og:image:secure_url','og:image','twitter:image']){
    const match=metas.find(meta=>meta.key===key);
    const url=absoluteImageUrl(match?.content,pageUrl);
    if(url)return url;
  }
  for(const m of String(html||'').matchAll(/<script\b[^>]*type\s*=\s*(["'])application\/ld\+json\1[^>]*>([\s\S]*?)<\/script>/gi)){
    try{
      const data=JSON.parse(decodeHtml(m[2]).trim());
      const nodes=Array.isArray(data)?data:[data];
      for(const node of nodes){
        const candidates=node?.['@graph']&&Array.isArray(node['@graph'])?[node,...node['@graph']]:[node];
        for(const candidate of candidates){
          const url=absoluteImageUrl(jsonLdImage(candidate?.image),pageUrl);
          if(url)return url;
        }
      }
    }catch{}
  }
  return '';
}

export function extractOfficialCourseCount(html){
  const m=String(html||'').match(/Explore\s+([\d,]+)\s+courses/i);
  return m?Number(m[1].replace(/,/g,'')):null;
}

export function extractCatalogCourseUrls(html){
  const out=[]; const seen=new Set();
  for(const m of String(html||'').matchAll(/href=["']([^"']+)["']/gi)){
    let u;
    try{u=new URL(m[1],'https://www.futurelearn.com')}catch{continue}
    if(u.hostname!=='www.futurelearn.com'&&u.hostname!=='futurelearn.com')continue;
    if(!/^\/courses\/[^/?#]+\/?$/.test(u.pathname))continue;
    const c=canonicalCourseUrl(u.href);
    if(c&&!seen.has(c)){seen.add(c);out.push(c)}
  }
  return out;
}

export function findMissingCatalogUrls(catalogUrls,databaseUrls){
  const db=databaseUrls instanceof Set?databaseUrls:new Set(databaseUrls||[]);
  return [...(catalogUrls||[])].filter(url=>!db.has(url)).sort();
}

export function sampleStatuses(results,limit=5){
  const out={};
  for(const result of results||[]){
    const key=result?.status||'unknown';
    if(!out[key])out[key]=[];
    if(out[key].length<limit)out[key].push(result);
  }
  return out;
}

function joinable(html){
  return /\b(join course|join now|join today|join with limited access|available now|start learning today)\b/i.test(String(html||''));
}

function looksCourse(html){
  const s=String(html||'');
  return /<h1\b[^>]*>/i.test(s) && /(enrolled on this course|who is the course for|learning on this course|course overview|join course|join now|start dates)/i.test(s);
}

export function classifyCourseResponse({sourceUrl,finalUrl='',status=0,html='',listedInCatalog=false}){
  const source=canonicalCourseUrl(sourceUrl);
  const final=canonicalCourseUrl(finalUrl||sourceUrl);
  const redirected=!!source&&!!final&&source!==final;
  const base={sourceUrl:source,finalUrl:final,httpStatus:Number(status)||0,redirected,listedInCatalog:Boolean(listedInCatalog),pageExists:false,joinable:false};
  if(status===404||status===410)return {...base,status:'not-found'};
  if(status===403||status===429)return {...base,status:'blocked'};
  if(status<200||status>=400)return {...base,status:'http-error'};
  const isCourse=looksCourse(html);
  const canJoin=joinable(html);
  if(!isCourse)return {...base,pageExists:false,joinable:canJoin,status:'not-course-page'};
  if(canJoin&&listedInCatalog)return {...base,pageExists:true,joinable:true,status:redirected?'redirected-active-listed':'active-listed'};
  if(canJoin&&!listedInCatalog)return {...base,pageExists:true,joinable:true,status:redirected?'redirected-active-unlisted':'active-unlisted'};
  if(listedInCatalog)return {...base,pageExists:true,joinable:false,status:'listed-not-joinable'};
  return {...base,pageExists:true,joinable:false,status:'unlisted-not-joinable'};
}
