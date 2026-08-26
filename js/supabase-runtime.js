(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root) root.SupabaseRuntime=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const COURSE_SELECT = [
    'id','external_id','title','provider','short_description','level','languages','is_free','has_certificate',
    'duration_hours','thumbnail_url','source_url','status','last_verified',
    'platforms!inner(id,external_id,name)','categories(id,slug,name)'
  ].join(',');

  function cleanProjectUrl(value){
    return String(value||'').replace(/\/+$/,'');
  }

  function normalizeCourseRow(row){
    const r=row||{};
    const p=Array.isArray(r.platforms)?r.platforms[0]:r.platforms;
    const c=Array.isArray(r.categories)?r.categories[0]:r.categories;
    const hours=r.duration_hours==null?null:Number(r.duration_hours);
    return {
      id:String(r.external_id||`db-course-${r.id}`),
      databaseId:r.id==null?null:Number(r.id),
      title:r.title||'Course',
      summary:r.short_description||'',
      platform:p?.name||r.provider||'',
      provider:r.provider||p?.name||'',
      platformId:p?.external_id||'',
      databasePlatformId:p?.id==null?null:Number(p.id),
      category:c?.slug||c?.name||'',
      level:r.level||'',
      durationHours:Number.isFinite(hours)?hours:null,
      durationLabel:Number.isFinite(hours)?`${hours} h`:null,
      language:Array.isArray(r.languages)?r.languages:[],
      free:r.is_free===true,
      certificate:r.has_certificate===true,
      skills:[],
      outcomes:[],
      audience:[],
      prerequisites:[],
      editorialScore:0,
      thumbnail:r.thumbnail_url||'icon.svg',
      sourceUrl:r.source_url||'#',
      status:r.status||'verified',
      lastVerified:r.last_verified||null,
      catalogOnly:true,
      dataSource:'supabase'
    };
  }

  function headers(publishableKey){
    if(!publishableKey) throw new Error('Supabase publishable key is required');
    return {apikey:publishableKey,Accept:'application/json'};
  }

  function coursesUrl(options){
    const opts=options||{};
    const base=cleanProjectUrl(opts.projectUrl);
    if(!base) throw new Error('Supabase project URL is required');
    const u=new URL(`${base}/rest/v1/courses`);
    u.searchParams.set('select',COURSE_SELECT);
    u.searchParams.set('status','eq.verified');
    if(opts.platformId!=null) u.searchParams.set('platform_id',`eq.${opts.platformId}`);
    u.searchParams.set('order','id.asc');
    u.searchParams.set('limit',String(Math.max(1,Number(opts.limit||1000))));
    u.searchParams.set('offset',String(Math.max(0,Number(opts.offset||0))));
    return u.toString();
  }

  async function getJson(url,publishableKey,fetchFn){
    const f=fetchFn||((...args)=>fetch(...args));
    const response=await f(url,{headers:headers(publishableKey),cache:'no-store'});
    if(!response.ok) throw new Error(`Supabase ${response.status}: ${url}`);
    return await response.json();
  }

  async function loadActivePlatforms(options){
    const opts=options||{};
    const base=cleanProjectUrl(opts.projectUrl);
    if(!base) throw new Error('Supabase project URL is required');
    const u=new URL(`${base}/rest/v1/platforms`);
    u.searchParams.set('select','id,external_id,name,status,expected_count,expected_count_type,last_verified');
    u.searchParams.set('status','eq.active');
    u.searchParams.set('order','id.asc');
    const rows=await getJson(u.toString(),opts.publishableKey,opts.fetchFn);
    if(!Array.isArray(rows)) throw new Error('Supabase platforms response must be an array');
    return rows;
  }

  async function loadAllVerified(options){
    const opts=options||{};
    const pageSize=Math.max(1,Number(opts.pageSize||1000));
    const maxRows=Math.max(pageSize,Number(opts.maxRows||50000));
    const rows=[];
    for(let offset=0;offset<maxRows;offset+=pageSize){
      const page=await getJson(coursesUrl({projectUrl:opts.projectUrl,limit:pageSize,offset}),opts.publishableKey,opts.fetchFn);
      if(!Array.isArray(page)) throw new Error('Supabase courses response must be an array');
      rows.push(...page.map(normalizeCourseRow));
      if(page.length<pageSize) break;
    }
    return rows;
  }

  async function findPlatform(options){
    const opts=options||{};
    const base=cleanProjectUrl(opts.projectUrl);
    if(!base) throw new Error('Supabase project URL is required');
    const u=new URL(`${base}/rest/v1/platforms`);
    u.searchParams.set('select','id,external_id,name,status');
    u.searchParams.set('external_id',`eq.${opts.externalId}`);
    u.searchParams.set('status','eq.active');
    u.searchParams.set('limit','1');
    const rows=await getJson(u.toString(),opts.publishableKey,opts.fetchFn);
    return Array.isArray(rows)&&rows.length?rows[0]:null;
  }

  async function loadPlatformVerified(options){
    const opts=options||{};
    const platform=await findPlatform(opts);
    if(!platform) return [];
    const pageSize=Math.max(1,Number(opts.pageSize||1000));
    const maxRows=Math.max(pageSize,Number(opts.maxRows||20000));
    const rows=[];
    for(let offset=0;offset<maxRows;offset+=pageSize){
      const page=await getJson(coursesUrl({projectUrl:opts.projectUrl,platformId:platform.id,limit:pageSize,offset}),opts.publishableKey,opts.fetchFn);
      if(!Array.isArray(page)) throw new Error('Supabase courses response must be an array');
      rows.push(...page.map(normalizeCourseRow));
      if(page.length<pageSize) break;
    }
    return rows;
  }

  return {normalizeCourseRow,coursesUrl,loadActivePlatforms,loadAllVerified,loadPlatformVerified,findPlatform};
});
