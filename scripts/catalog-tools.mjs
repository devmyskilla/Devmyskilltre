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

export function platformFileName(name,id='platform'){
  const safe=String(name||'')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g,' ')
    .replace(/[\\/:*?"<>|%]+/g,' ')
    .replace(/\s+/g,'-')
    .replace(/-+/g,'-')
    .replace(/^[.\-]+|[.\-]+$/g,'')
    .slice(0,120);
  return `${safe||String(id||'platform').replace(/[^\p{L}\p{N}._-]+/gu,'-')}.json`;
}

const GENERIC_TITLES=new Set([
  'home','course','courses','catalog','catalogue','all courses','all-courses','learn','learning','training',
  'overview','exam','take exam','quiz','lesson','lessons','module','modules','chapter','chapters','unit','units'
]);
const CHILD_SEGMENT=/^(?:lesson|lessons|exam|exams|quiz|quizzes|chapter|chapters|unit|units|lecture|lectures|video|videos|assignment|assignments|topic|topics|overview)(?:[-_].*)?$/i;
const GENERIC_TITLE_PATTERN=/^(?:lesson|exam|quiz|chapter|unit|lecture|assignment|topic)\b/i;

function normalizedComparableUrl(value){
  try{const u=new URL(value);u.hash='';u.search='';if(u.pathname.length>1)u.pathname=u.pathname.replace(/\/+$/,'');return u.href.toLowerCase();}
  catch{return String(value||'').replace(/[?#].*$/,'').replace(/\/+$/,'').toLowerCase();}
}
function pathSegments(value){try{return new URL(value).pathname.split('/').filter(Boolean).map(x=>decodeURIComponent(x).toLowerCase())}catch{return[]}}
function hasBlockedChildSegment(url,platform){
  const segments=pathSegments(url); if(!segments.length)return false;
  const patterns=inferCoursePathPatterns(platform);
  const path='/' + segments.join('/') + '/';
  for(const pattern of patterns){
    let p=String(pattern||'').toLowerCase();
    if(!p.startsWith('/'))continue;
    if(!p.endsWith('/'))p+='/';
    const needle=p.replace(/^\/+|\/+$/g,'').split('/').filter(Boolean);
    if(!needle.length)continue;
    for(let i=0;i<=segments.length-needle.length;i++){
      if(!needle.every((part,j)=>segments[i+j]===part))continue;
      const courseSlugIndex=i+needle.length;
      if(courseSlugIndex>=segments.length)continue;
      const children=segments.slice(courseSlugIndex+1);
      if(children.some(seg=>CHILD_SEGMENT.test(seg)))return true;
    }
  }
  return false;
}

export function cleanCourseRecords(records,platform={}){
  const catalogUrl=normalizedComparableUrl(platform.link||'');
  return mergeCourseRecords(records).filter(row=>{
    const title=stripTags(row.title||row.name||'').trim();
    const titleKey=title.toLowerCase().replace(/\s+/g,' ');
    if(!title||title.length<3)return false;
    if(GENERIC_TITLES.has(titleKey)||GENERIC_TITLE_PATTERN.test(titleKey))return false;
    const url=row.sourceUrl||row.url||'';
    if(!url)return false;
    if(catalogUrl&&normalizedComparableUrl(url)===catalogUrl)return false;
    if(hasBlockedChildSegment(url,platform))return false;
    return true;
  });
}
