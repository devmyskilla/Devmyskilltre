(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root) root.CatalogRuntime=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function arr(value){
    if(Array.isArray(value)) return value.filter(Boolean).map(String);
    if(value==null||value==='') return [];
    return String(value).split(/\s*[,،/]\s*/).filter(Boolean);
  }
  function canonical(url){
    try{const u=new URL(url);u.hash='';['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(k=>u.searchParams.delete(k));return u.href.replace(/\/$/,'');}catch(_){return String(url||'').replace(/\/$/,'');}
  }
  function titleFromUrl(url){
    try{const p=new URL(url).pathname.split('/').filter(Boolean).pop()||'Course';return p.replace(/[-_]+/g,' ').replace(/\b\w/g,m=>m.toUpperCase());}catch(_){return 'Course';}
  }
  function normalizeCourse(record,platform){
    const r=record||{}, p=platform||{};
    let title=r.title||r.name||titleFromUrl(r.sourceUrl||r.url||'');
    if(/^(find out more|learn more|overview|course)$/i.test(String(title).trim()) && (r.sourceUrl||r.url)) title=titleFromUrl(r.sourceUrl||r.url);
    return {
      ...r,
      id:r.id||`catalog-${Math.random().toString(36).slice(2)}`,
      title,
      summary:r.summary||'',
      platform:r.platform||p.name||'',
      provider:r.provider||r.platform||p.name||'',
      platformId:p.id||r.platformId||'',
      category:r.category||p.category||'',
      level:r.level||'',
      durationHours:r.durationHours==null?null:Number(r.durationHours),
      durationLabel:r.durationLabel||null,
      language:arr(r.language),
      free:Boolean(r.free),
      certificate:Boolean(r.certificate),
      skills:Array.isArray(r.skills)?r.skills:[],
      outcomes:Array.isArray(r.outcomes)?r.outcomes:[],
      audience:Array.isArray(r.audience)?r.audience:[],
      prerequisites:Array.isArray(r.prerequisites)?r.prerequisites:[],
      editorialScore:Number(r.editorialScore||0),
      thumbnail:r.thumbnail||p.thumbnail||'icon.svg',
      sourceUrl:r.sourceUrl||r.url||p.link||'#',
      catalogOnly:true
    };
  }
  function manifestTotal(manifest){
    return Object.values(manifest?.platforms||{}).reduce((sum,m)=>sum+Number(m.cleanCount??m.count??0),0);
  }
  function mergeUnique(target,records){
    const ids=new Set(target.map(x=>x.id).filter(Boolean));
    const urls=new Set(target.map(x=>canonical(x.sourceUrl||x.url)).filter(Boolean));
    let added=0;
    for(const r of records||[]){
      const u=canonical(r.sourceUrl||r.url);
      if((r.id&&ids.has(r.id))||(u&&urls.has(u))) continue;
      target.push(r); added++;
      if(r.id) ids.add(r.id); if(u) urls.add(u);
    }
    return added;
  }
  async function fetchJson(url,fetchFn){
    const r=await fetchFn(encodeURI(url),{cache:'no-store'});
    if(!r.ok) throw new Error(`${r.status} ${url}`);
    return await r.json();
  }
  async function loadPlatform(meta,platform,fetchFn){
    const f=fetchFn||((...args)=>fetch(...args));
    const candidates=[];
    if(meta?.cleanFile) candidates.push(meta.cleanFile);
    if(meta?.id) candidates.push(`catalogs/${meta.id}.json`);
    if(platform?.id&&!candidates.includes(`catalogs/${platform.id}.json`)) candidates.push(`catalogs/${platform.id}.json`);
    for(const url of candidates){
      try{
        const data=await fetchJson(url,f);
        const rows=Array.isArray(data)?data:(Array.isArray(data?.courses)?data.courses:[]);
        if(rows.length) return rows.map(x=>normalizeCourse(x,platform));
      }catch(_){}
    }
    return [];
  }
  async function loadAll(manifest,platforms,options){
    const opts=options||{}, concurrency=Math.max(1,Number(opts.concurrency||4));
    const entries=Object.entries(manifest?.platforms||{});
    let cursor=0, loaded=0, records=0;
    async function worker(){
      while(true){
        const i=cursor++; if(i>=entries.length) return;
        const [id,meta]=entries[i];
        const platform=(platforms||[]).find(p=>p.id===id)||{id,name:meta.name};
        const courses=await loadPlatform(meta,platform,opts.fetchFn);
        loaded++; records+=courses.length;
        if(opts.onPlatform) await opts.onPlatform({id,meta,platform,courses,loaded,total:entries.length,records});
      }
    }
    await Promise.all(Array.from({length:Math.min(concurrency,entries.length||1)},()=>worker()));
    return {loaded,total:entries.length,records};
  }
  return {normalizeCourse,manifestTotal,mergeUnique,loadPlatform,loadAll,canonical};
});
