function decodeEntities(value=''){
  return String(value)
    .replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'")
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ')
    .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)));
}
function stripTags(value=''){return decodeEntities(String(value).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim());}
function absoluteUrl(value,baseUrl){try{return new URL(value,baseUrl).href}catch{return ''}}
function normalizeUrl(value){try{const u=new URL(value);u.hash='';if(u.pathname.length>1)u.pathname=u.pathname.replace(/\/+$/,'');return u.href}catch{return String(value||'').replace(/\/+$/,'')}}
function safeTitleFromUrl(url){try{const u=new URL(url);const bits=u.pathname.split('/').filter(Boolean);const slug=bits.at(-1)||u.hostname;return decodeURIComponent(slug).replace(/[-_]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase()).trim()}catch{return 'Course'}}
function courseFromJsonLd(node,baseUrl){
  if(!node||typeof node!=='object')return [];
  if(Array.isArray(node))return node.flatMap(x=>courseFromJsonLd(x,baseUrl));
  const out=[];
  const type=node['@type'];
  const types=Array.isArray(type)?type:[type];
  if(types.filter(Boolean).some(t=>String(t).toLowerCase()==='course')){
    const url=absoluteUrl(node.url||node['@id']||node.mainEntityOfPage||'',baseUrl);
    const provider=typeof node.provider==='object'?(node.provider.name||''):'';
    out.push({title:stripTags(node.name||node.headline||safeTitleFromUrl(url)),summary:stripTags(node.description||''),provider:stripTags(provider),sourceUrl:url||baseUrl});
  }
  if(node['@graph'])out.push(...courseFromJsonLd(node['@graph'],baseUrl));
  if(node.itemListElement)out.push(...courseFromJsonLd(node.itemListElement,baseUrl));
  if(node.item)out.push(...courseFromJsonLd(node.item,baseUrl));
  return out;
}
export function extractJsonLdCourses(html,baseUrl){
  const out=[];
  const re=/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for(const m of String(html).matchAll(re)){
    const raw=decodeEntities(m[1]).trim(); if(!raw)continue;
    try{out.push(...courseFromJsonLd(JSON.parse(raw),baseUrl))}catch{}
  }
  return mergeCourseRecords(out);
}
export function extractAnchorCourses(html,baseUrl,patterns=['/course/','/courses/']){
  const out=[];
  const re=/<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  for(const m of String(html).matchAll(re)){
    const href=decodeEntities(m[2]).trim(); if(!href||href.startsWith('#')||href.startsWith('javascript:'))continue;
    const url=absoluteUrl(href,baseUrl); if(!url)continue;
    const path=(()=>{try{return new URL(url).pathname.toLowerCase()}catch{return ''}})();
    if(!patterns.some(p=>path.includes(String(p).toLowerCase())))continue;
    const title=stripTags(m[3]); if(!title||title.length<2)continue;
    out.push({title,sourceUrl:url});
  }
  return mergeCourseRecords(out);
}
export function parseSitemap(xml){
  const text=String(xml||'');
  const urls=[...text.matchAll(/<loc[^>]*>([\s\S]*?)<\/loc>/gi)].map(m=>decodeEntities(stripTags(m[1]))).filter(Boolean);
  return {type:/<sitemapindex\b/i.test(text)?'index':'urlset',urls};
}
export function mergeCourseRecords(records){
  const map=new Map();
  for(const row of records||[]){
    if(!row)continue;
    const url=normalizeUrl(row.sourceUrl||row.url||'');
    const title=stripTags(row.title||row.name||safeTitleFromUrl(url));
    if(!url||!title)continue;
    const key=url.toLowerCase();
    const prev=map.get(key)||{};
    map.set(key,{...prev,...row,title,sourceUrl:url,summary:row.summary||prev.summary||'',provider:row.provider||prev.provider||''});
  }
  return [...map.values()];
}
export function inferCoursePathPatterns(platform){
  const name=String(platform?.name||'').toLowerCase();
  const custom={
    'coursera':['/learn/','/professional-certificates/','/specializations/'],
    'edx':['/learn/','/certificates/'],
    'udemy':['/course/'],
    'futurelearn':['/courses/'],
    'linkedin learning':['/learning/'],
    'skillshare':['/classes/'],
    'masterclass':['/classes/'],
    'datacamp':['/courses/','/tracks/'],
    'mit opencourseware':['/courses/'],
    'harvard online':['/course/','/courses/'],
    'openclassrooms':['/en/courses/'],
    'free code camp':['/learn/'],
    'freecodecamp':['/learn/'],
    'kaggle':['/learn/'],
    'github learn':['skills.github.com/'],
    'microsoft':['/training/modules/','/training/paths/'],
    'cisco':['/courses/','/learning/'],
    'hubspot academy':['/courses/'],
    'ahrefs academy':['/academy/'],
    'semrush':['/academy/courses/'],
    'codecademy':['/learn/'],
    'code academy':['/learn/'],
    'pluralsight':['/courses/'],
    'educative':['/courses/'],
    'scrimba':['/learn/','/courses/'],
    'frontend masters':['/courses/'],
    'linux foundation training':['/training/'],
    'mongodb university':['/courses/'],
    'confluent developer':['/courses/'],
    'uipath academy':['/courses/'],
    'interaction design foundation':['/courses/'],
    'domestika':['/courses/'],
    'nptel':['/courses/'],
    'swayam':['/nd1_noc','/course/'],
    'saylor':['/course/'],
    'rwaq':['/courses/'],
    'إدراك edraak':['/course/'],
    'سطر satr':['/courses/'],
    'alison':['/course/'],
    'simplilearn':['/free-','/skillup/'],
    'simple learn':['/free-','/skillup/'],
    'sololearn':['/learn/'],
    'w3 school':['/'],
    'brilliant':['/courses/'],
    'hyperskill':['/courses/'],
    'unity learn':['/course/','/tutorial/','/pathway/'],
    'unreal engine learning':['/learning/'],
    'adobe learn':['/learn/'],
    'canva design school':['/designschool/'],
    'moodle academy':['/course/'],
    'sdg academy':['/course/','/courses/'],
    'meta blueprint':['/student/path/','/student/activity/']
  };
  for(const [needle,patterns] of Object.entries(custom))if(name.includes(needle))return patterns;
  try{
    const path=new URL(platform.link).pathname.toLowerCase();
    const segments=path.split('/').filter(Boolean);
    if(segments.length){const last=segments.at(-1);if(last&&last.length>3)return [`/${last.replace(/s$/,'')}/`,`/${last}/`];}
  }catch{}
  return ['/course/','/courses/','/learn/','/training/','/class/','/classes/','/track/','/tracks/','/path/','/paths/'];
}
export function recordFromUrl(url,platform){
  return {title:safeTitleFromUrl(url),sourceUrl:normalizeUrl(url),platform:platform.name,provider:platform.name,recordType:'source-only',lastVerified:new Date().toISOString().slice(0,10)};
}
