export function canonicalCourseUrl(value){
  try{
    const u=new URL(value,'https://www.futurelearn.com');
    u.hash=''; u.search='';
    const pathname=u.pathname.replace(/\/+$/,'');
    return `${u.origin}${pathname}`;
  }catch{return ''}
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
