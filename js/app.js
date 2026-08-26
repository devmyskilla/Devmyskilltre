const $ = id => document.getElementById(id);
const STORAGE = { favorites:'dunya.course.favorites', recent:'dunya.course.recent', compare:'dunya.course.compare', views:'dunya.course.views', theme:'dunya.theme' };
let activeTab = 'all';
let activeCategory = '';
let deferredInstallPrompt = null;
let catalogManifest = null;
let runtimePlatformCounts = {};
let visibleCourseLimit = 60;
let supabaseCatalogLoaded = false;
const COURSE_PAGE_SIZE = 60;
const CURATED_COURSES_DATA = Array.isArray(COURSES_DATA) ? COURSES_DATA.slice() : [];

function readJSON(key, fallback){ try{ return JSON.parse(localStorage.getItem(key)) ?? fallback; }catch(_){ return fallback; } }
function writeJSON(key, value){ try{ localStorage.setItem(key, JSON.stringify(value)); }catch(_){} }
function setFromStorage(key){ return new Set(readJSON(key, [])); }
function escapeHtml(value){ return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch])); }
function showToast(message){ const t=$('toast'); if(!t) return; t.textContent=message; t.classList.add('show'); clearTimeout(showToast._t); showToast._t=setTimeout(()=>t.classList.remove('show'),1800); }
function detailUrl(course){ return `course.html?id=${encodeURIComponent(course.id)}&lang=${encodeURIComponent(currentLang)}`; }
function viewCounts(){ return readJSON(STORAGE.views, {}); }
function recentIds(){ return readJSON(STORAGE.recent, []); }
function favorites(){ return setFromStorage(STORAGE.favorites); }
function compareSet(){ return setFromStorage(STORAGE.compare); }

function setTheme(theme){ document.documentElement.dataset.theme=theme; try{localStorage.setItem(STORAGE.theme,theme)}catch(_){} if($('themeToggle')) $('themeToggle').textContent=theme==='dark'?'☀':'◐'; }
function initTheme(){ let saved; try{saved=localStorage.getItem(STORAGE.theme)}catch(_){} const preferred=matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light'; setTheme(saved||preferred); }

function renderStats(){
  const s=CourseCatalog.getCatalogStats(PLATFORMS_DATA,COURSES_DATA);
  const total=supabaseCatalogLoaded?s.courses:(catalogManifest?CatalogRuntime.manifestTotal(catalogManifest):s.courses);
  $('statCourses').textContent=total;
  $('statPlatforms').textContent=supabaseCatalogLoaded?PLATFORMS_DATA.length:(catalogManifest?.platformCount||s.platforms);
  $('statFree').textContent=s.free;
  $('statCert').textContent=s.certificates;
}

function platformText(platform, field='description'){
  if(currentLang==='en') return platform[field+'_en']||platform[field]||'';
  if(currentLang==='tr') return platform[field+'_tr']||platform[field]||'';
  return platform[field]||'';
}
function platformMatchKey(value){ return CourseCatalog.normalizeText(value).replace(/\s+/g,''); }
function indexedCoursesForPlatform(platform){
  const key=platformMatchKey(platform.name);
  return COURSES_DATA.filter(course=>{
    if(course.platformId&&course.platformId===platform.id) return true;
    const values=[course.platform,course.provider].filter(Boolean).map(platformMatchKey);
    return values.some(v=>v===key||v.includes(key)||key.includes(v));
  });
}
function renderPlatforms(){
  const grid=$('platformsGrid'); if(!grid||!Array.isArray(PLATFORMS_DATA)) return;
  const query=$('platformSearch')?.value||'';
  const list=CourseCatalog.searchPlatforms(PLATFORMS_DATA,query);
  $('platformResultsCount').textContent=list.length;
  grid.innerHTML=list.map(platform=>{
    const indexed=indexedCoursesForPlatform(platform);
    const meta=supabaseCatalogLoaded?null:catalogManifest?.platforms?.[platform.id];
    const indexedCount=supabaseCatalogLoaded
      ? Math.max(Number(runtimePlatformCounts[platform.id]||0),indexed.length)
      : Math.max(Number(meta?.cleanCount??meta?.count??0),Number(runtimePlatformCounts[platform.id]||0),indexed.length);
    const desc=platformText(platform);
    return `<article class="platform-card">
      <div class="platform-card-head"><img src="${escapeHtml(platform.thumbnail||'icon.svg')}" alt="" loading="lazy"><div><h3>${escapeHtml(platform.name)}</h3><small>${escapeHtml(platform.category||'')}</small></div></div>
      <p>${escapeHtml(desc)}</p>
      <div class="platform-meta"><span>${platform.free?'✓ '+getText('free'):getText('paid')}</span>${platform.certificate?`<span>🎓 ${getText('certificate')}</span>`:''}<span>🌐 ${escapeHtml(platform.language||'')}</span></div>
      <div class="platform-index-status"><strong>${indexedCount}</strong><span>${getText('indexedCourses')}</span></div>
      <div class="platform-card-actions"><a class="mini-btn" href="platform.html?id=${encodeURIComponent(platform.id)}&lang=${encodeURIComponent(currentLang)}">${getText('browsePlatform')} ↗</a><a class="btn soft small" href="${escapeHtml(platform.link)}" target="_blank" rel="noopener noreferrer">${getText('officialCatalog')} ↗</a></div>
    </article>`;
  }).join('')||`<div class="no-results"><span>⌕</span><strong>${getText('noPlatforms')}</strong></div>`;
}
function openIndexedPlatform(platformId){
  const platform=PLATFORMS_DATA.find(p=>p.id===platformId); if(!platform)return;
  const indexed=indexedCoursesForPlatform(platform); if(!indexed.length)return;
  activeTab='all'; activeCategory='';
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab==='all'));
  resetFilters();
  const coursePlatform=indexed[0].platform;
  $('filterPlatform').value=coursePlatform;
  renderCourses();
  $('catalog').scrollIntoView({behavior:'smooth'});
}

function categoryEntries(){ const icons={programming:'💻',data:'📊',ai:'🤖',cybersecurity:'🛡️',marketing:'📣','project-management':'🧭',languages:'🌐'}; return [...new Set(COURSES_DATA.map(c=>c.category))].map(key=>({key,icon:icons[key]||'✦',count:COURSES_DATA.filter(c=>c.category===key).length})); }
function renderCategoryChips(){ const wrap=$('categoryChips'); wrap.innerHTML=`<button class="category-chip ${!activeCategory?'active':''}" data-category=""><span>✨</span><b>${getText('all')}</b><small>${COURSES_DATA.length}</small></button>`+categoryEntries().map(c=>`<button class="category-chip ${activeCategory===c.key?'active':''}" data-category="${c.key}"><span>${c.icon}</span><b>${escapeHtml(categoryLabel(c.key))}</b><small>${c.count}</small></button>`).join(''); }

function renderPaths(){ const grid=$('pathsGrid'); grid.innerHTML=LEARNING_PATHS.map(path=>{
  const total=new Set(path.stages.flatMap(s=>s.courseIds)).size;
  const title=currentLang==='ar'?path.title_ar:currentLang==='tr'?(path.title_tr||path.title):path.title;
  return `<article class="path-card" data-path="${path.id}"><div class="path-icon">${path.icon||'🧭'}</div><div><h3>${escapeHtml(title)}</h3><p>${path.stages.length} ${getText('nextStep')} · ${total} ${getText('courses')}</p></div><button class="path-open" data-open-path="${path.id}" type="button">${getText('openPath')} ↗</button></article>`;
}).join(''); }

function option(value,label){ return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`; }
function populateFilters(){
  const categories=[...new Set(COURSES_DATA.map(c=>c.category).filter(Boolean))]; const levels=[...new Set(COURSES_DATA.map(c=>c.level).filter(Boolean))]; const platforms=[...new Set([...PLATFORMS_DATA.map(p=>p.name),...COURSES_DATA.map(c=>c.platform)].filter(Boolean))].sort(); const langs=[...new Set(COURSES_DATA.flatMap(c=>Array.isArray(c.language)?c.language:(c.language?[c.language]:[])).filter(Boolean))];
  $('filterCategory').innerHTML=option('',getText('any'))+categories.map(v=>option(v,categoryLabel(v))).join('');
  $('filterLevel').innerHTML=option('',getText('any'))+levels.map(v=>option(v,levelLabel(v))).join('');
  $('filterPlatform').innerHTML=option('',getText('any'))+platforms.map(v=>option(v,v)).join('');
  $('filterLanguage').innerHTML=option('',getText('any'))+langs.map(v=>option(v,langLabel(v))).join('');
  $('filterDuration').innerHTML=option('',getText('any'))+['quick','short','medium','long','unknown'].map(v=>option(v,getText(v))).join('');
  $('sortSelect').innerHTML=['recommended','shortest','score','title','popular'].map(v=>option(v,getText('sort_'+v))).join('');
}

function currentFilters(){ return { category:activeCategory||$('filterCategory').value, level:$('filterLevel').value, platform:$('filterPlatform').value, language:$('filterLanguage').value, duration:$('filterDuration').value, freeOnly:$('filterFree').checked, certificateOnly:$('filterCertificate').checked }; }
function getVisibleCourses(){
  let list=CourseCatalog.searchCourses(COURSES_DATA,$('catalogSearch').value||$('searchInput').value);
  list=CourseCatalog.filterCourses(list,currentFilters());
  const fav=favorites(), recent=recentIds();
  if(activeTab==='favorites') list=list.filter(c=>fav.has(c.id));
  if(activeTab==='recent') list=list.filter(c=>recent.includes(c.id)).sort((a,b)=>recent.indexOf(a.id)-recent.indexOf(b.id));
  else list=CourseCatalog.sortCourses(list,$('sortSelect').value||'recommended',viewCounts());
  return list;
}

function durationText(course){ return localizedValue(course.durationLabel)||getText('unknownDuration'); }
function isOfficialCoursePhoto(course){ return /^https:\/\/ugc\.futurelearn\.com\//i.test(String(course?.thumbnail||'')); }
function courseImageClass(course){ return `course-logo${isOfficialCoursePhoto(course)?' course-photo':''}`; }
function cardHtml(course, compact=false){ const fav=favorites().has(course.id), compare=compareSet().has(course.id), views=viewCounts()[course.id]||0; const title=courseField(course,'title')||course.title||'Course', summary=courseField(course,'summary')||course.summary||getText('sourceOnlyCourse');
  const skills=Array.isArray(course.skills)?course.skills:[]; const score=course.catalogOnly?'↗':Number(course.editorialScore||0).toFixed(1); const level=course.level?levelLabel(course.level):'—';
  const target=course.catalogOnly?(course.sourceUrl||course.url||'#'):detailUrl(course); const targetAttrs=course.catalogOnly?' target="_blank" rel="noopener noreferrer"':''; const targetLabel=course.catalogOnly?getText('openOfficial'):getText('details');
  return `<article class="course-card ${compact?'compact-card':''}">
    <div class="card-top"><div class="${courseImageClass(course)}"><img src="${escapeHtml(course.thumbnail||'icon.svg')}" alt="" loading="lazy"></div><div class="card-top-actions"><button class="round-btn ${fav?'active':''}" data-action="favorite" data-id="${course.id}" aria-label="favorite">♥</button><button class="round-btn ${compare?'active':''}" data-action="compare" data-id="${course.id}" aria-label="compare">⚖</button></div><span class="editorial-score">${score}</span></div>
    <div class="card-body"><div class="provider-line"><span>${escapeHtml(course.provider||course.platform||'')}</span><small>${escapeHtml(course.platform||'')}</small></div><h3>${escapeHtml(title)}</h3>${compact?'':`<p>${escapeHtml(summary)}</p>`}
    <div class="fact-row"><span>◷ ${escapeHtml(durationText(course))}</span><span>◎ ${escapeHtml(level)}</span></div>
    <div class="badge-row"><span class="badge ${course.free?'good':'soft'}">${course.free?getText('free'):getText('paid')}</span><span class="badge ${course.certificate?'good':'muted'}">${course.certificate?'🎓 '+getText('certificate'):getText('noCertificate')}</span>${course.unionPick?`<span class="badge accent">★ ${getText('developerPick')}</span>`:''}</div>
    ${compact?'':`<div class="skill-row wrap">${skills.slice(0,4).map(s=>`<span>${escapeHtml(s)}</span>`).join('')}</div>`}
    <div class="card-footer"><span>${views?`👁 ${views} ${getText('localViews')}`:''}</span><a class="details-link" href="${escapeHtml(target)}"${targetAttrs}>${targetLabel} <b>↗</b></a></div></div></article>`;
}

function renderCourses(){ document.querySelector('.catalog-load-more')?.remove(); const list=getVisibleCourses(); const shown=list.slice(0,visibleCourseLimit); $('resultsCount').textContent=list.length; $('allBadge').textContent=COURSES_DATA.length; $('favBadge').textContent=favorites().size; $('recentBadge').textContent=recentIds().length; $('coursesGrid').innerHTML=shown.length?shown.map(c=>cardHtml(c)).join(''):`<div class="no-results">⌕<strong>${getText('noResults')}</strong></div>`; if(list.length>shown.length){const more=document.createElement('div');more.className='catalog-load-more';more.innerHTML=`<button class="btn soft" id="loadMoreCourses" type="button">+ ${Math.min(COURSE_PAGE_SIZE,list.length-shown.length)} ${getText('courses')}</button>`;$('coursesGrid').after(more);more.querySelector('button').onclick=()=>{visibleCourseLimit+=COURSE_PAGE_SIZE;more.remove();renderCourses();};}else document.querySelector('.catalog-load-more')?.remove(); renderCategoryChips(); updateCompareDock(); }

function toggleFavorite(id){ const set=favorites(); set.has(id)?set.delete(id):set.add(id); writeJSON(STORAGE.favorites,[...set]); renderCourses(); }
function toggleCompare(id){ const set=compareSet(); if(set.has(id)) set.delete(id); else { if(set.size>=3){showToast(getText('maxCompare'));return;} set.add(id); } writeJSON(STORAGE.compare,[...set]); renderCourses(); }
function updateCompareDock(){ const set=compareSet(), courses=[...set].map(id=>COURSES_DATA.find(c=>c.id===id)).filter(Boolean); $('compareCount').textContent=`${courses.length}/3`; $('compareNames').textContent=courses.map(c=>courseField(c,'title')).join(' · '); $('compareDock').classList.toggle('show',courses.length>0); }

function buildCompare(){ const selected=[...compareSet()].map(id=>COURSES_DATA.find(c=>c.id===id)).filter(Boolean); if(!selected.length){showToast(getText('compareCourses'));return;} const rows=[
  [getText('platform'),c=>c.platform],[getText('category'),c=>categoryLabel(c.category)],[getText('level'),c=>levelLabel(c.level)],[getText('duration'),c=>durationText(c)],[getText('free'),c=>c.free?'✓ '+getText('free'):'— '+getText('paid')],[getText('certificate'),c=>c.certificate?'✓ '+getText('certificate'):'—'],[getText('score'),c=>Number(c.editorialScore||0).toFixed(1)+'/10'],[getText('skills'),c=>(c.skills||[]).slice(0,5).join(', ')]
  ]; $('compareTable').innerHTML=`<table class="compare-table"><thead><tr><th></th>${selected.map(c=>`<th><img src="${escapeHtml(c.thumbnail)}" alt=""><strong>${escapeHtml(courseField(c,'title'))}</strong></th>`).join('')}</tr></thead><tbody>${rows.map(([label,fn])=>`<tr><th>${escapeHtml(label)}</th>${selected.map(c=>`<td>${escapeHtml(fn(c))}</td>`).join('')}</tr>`).join('')}</tbody></table>`; openModal('compareModal'); }

function openModal(id){ const m=$(id); if(!m)return;m.classList.add('open');document.body.classList.add('modal-open'); }
function closeModal(id){ const m=$(id);if(!m)return;m.classList.remove('open'); if(!document.querySelector('.modal.open'))document.body.classList.remove('modal-open'); }

function buildQuiz(){ const cats=categoryEntries(); $('quizForm').innerHTML=`<div class="quiz-grid"><label><span>${getText('goalCategory')}</span><select id="quizCategory">${option('',getText('any'))}${cats.map(c=>option(c.key,categoryLabel(c.key))).join('')}</select></label><label><span>${getText('preferredLevel')}</span><select id="quizLevel">${option('',getText('any'))}${['beginner','intermediate','advanced'].map(v=>option(v,levelLabel(v))).join('')}</select></label><label><span>${getText('needFree')}</span><select id="quizFree">${option('',getText('any'))}${option('yes',getText('freeOnly'))}</select></label><label><span>${getText('needCertificate')}</span><select id="quizCert">${option('',getText('any'))}${option('yes',getText('certificateOnly'))}</select></label></div><button id="runQuiz" class="btn primary full" type="button">✨ ${getText('showRecommendations')}</button>`; $('quizResults').innerHTML=''; $('runQuiz').onclick=runQuiz; }
function runQuiz(){ const profile={category:$('quizCategory').value,level:$('quizLevel').value,freeOnly:$('quizFree').value==='yes',certificateOnly:$('quizCert').value==='yes'}; const ranked=CURATED_COURSES_DATA.map(c=>({course:c,score:CourseCatalog.scoreCourseMatch(c,profile)})).sort((a,b)=>b.score-a.score).slice(0,4); const min=Math.min(...ranked.map(x=>x.score)),max=Math.max(...ranked.map(x=>x.score)); $('quizResults').innerHTML=`<div class="quiz-results">${ranked.map((x,i)=>{const pct=max===min?95:Math.round(72+(x.score-min)/(max-min)*26);return `<a class="match-row" href="${detailUrl(x.course)}"><span class="rank">${i+1}</span><img src="${escapeHtml(x.course.thumbnail)}" alt=""><div><strong>${escapeHtml(courseField(x.course,'title'))}</strong><small>${escapeHtml(categoryLabel(x.course.category))} · ${escapeHtml(durationText(x.course))}</small></div><b>${pct}%<small>${getText('match')}</small></b></a>`}).join('')}</div>`; }

function showPath(pathId){ const path=LEARNING_PATHS.find(p=>p.id===pathId); if(!path)return; const title=currentLang==='ar'?path.title_ar:currentLang==='tr'?(path.title_tr||path.title):path.title; $('pathDetail').innerHTML=`<span class="section-kicker">${path.icon||'🧭'} ${getText('pathCourses')}</span><h2>${escapeHtml(title)}</h2><div class="learning-path">${path.stages.map((stage,index)=>{const st=currentLang==='ar'?stage.title_ar:stage.title; const items=stage.courseIds.map(id=>CURATED_COURSES_DATA.find(c=>c.id===id)).filter(Boolean);return `<div class="path-stage"><div class="stage-number">${index+1}</div><div><small>${getText('nextStep')} ${index+1}</small><h3>${escapeHtml(st)}</h3><div class="courses-grid compact">${items.map(c=>cardHtml(c,true)).join('')}</div></div></div>`}).join('')}</div>`; openModal('pathModal'); }

async function shareCourse(id){ const course=COURSES_DATA.find(c=>c.id===id); if(!course)return; const url=course.catalogOnly?(course.sourceUrl||course.url):new URL(detailUrl(course),location.href).href; try{ if(navigator.share) await navigator.share({title:courseField(course,'title'),text:courseField(course,'summary'),url}); else {await navigator.clipboard.writeText(url);showToast(getText('copied'));} }catch(_){} }

function resetFilters(){ activeCategory=''; visibleCourseLimit=COURSE_PAGE_SIZE; ['filterCategory','filterLevel','filterPlatform','filterLanguage','filterDuration'].forEach(id=>$(id).value=''); $('filterFree').checked=false;$('filterCertificate').checked=false;$('sortSelect').value='recommended';$('catalogSearch').value='';$('searchInput').value='';renderCourses(); }
function changeLanguage(lang){ setLang(lang); applyTranslations(); populateFilters(); renderStats(); renderPaths(); renderCourses(); renderPlatforms(); buildQuiz(); }
function registerPWA(){ if('serviceWorker' in navigator) addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{})); addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;$('installBtn').hidden=false}); $('installBtn').addEventListener('click',async()=>{if(!deferredInstallPrompt)return;deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;$('installBtn').hidden=true}); }

function bindEvents(){
  $('themeToggle').onclick=()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'); $('langSwitcher').onchange=e=>changeLanguage(e.target.value); if($('platformSearch')) $('platformSearch').addEventListener('input',renderPlatforms);
  $('searchInput').addEventListener('input',e=>{visibleCourseLimit=COURSE_PAGE_SIZE;$('catalogSearch').value=e.target.value;renderCourses();}); $('catalogSearch').addEventListener('input',e=>{visibleCourseLimit=COURSE_PAGE_SIZE;$('searchInput').value=e.target.value;renderCourses();});
  ['filterCategory','filterLevel','filterPlatform','filterLanguage','filterDuration','sortSelect','filterFree','filterCertificate'].forEach(id=>$(id).addEventListener('change',()=>{visibleCourseLimit=COURSE_PAGE_SIZE;if(id==='filterCategory')activeCategory=$('filterCategory').value;renderCourses()})); $('resetFilters').onclick=resetFilters;
  $('categoryChips').addEventListener('click',e=>{const btn=e.target.closest('[data-category]');if(!btn)return;activeCategory=btn.dataset.category;$('filterCategory').value=activeCategory;renderCourses();document.getElementById('catalog').scrollIntoView({behavior:'smooth'});});
  document.querySelectorAll('.tab').forEach(btn=>btn.onclick=()=>{activeTab=btn.dataset.tab;document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b===btn));renderCourses()});
  document.addEventListener('click',e=>{const a=e.target.closest('[data-action]'); if(a){e.preventDefault();const id=a.dataset.id;if(a.dataset.action==='favorite')toggleFavorite(id);if(a.dataset.action==='compare')toggleCompare(id);if(a.dataset.action==='share')shareCourse(id);} const close=e.target.closest('[data-close]');if(close)closeModal(close.dataset.close);const path=e.target.closest('[data-open-path]');if(path)showPath(path.dataset.openPath);const platformBtn=e.target.closest('[data-platform-courses]');if(platformBtn)openIndexedPlatform(platformBtn.dataset.platformCourses);if(e.target.classList.contains('modal'))closeModal(e.target.id);});
  $('clearCompare').onclick=()=>{writeJSON(STORAGE.compare,[]);renderCourses()}; $('compareNow').onclick=buildCompare; $('heroQuizBtn').onclick=()=>{buildQuiz();openModal('quizModal')}; $('randomBtn').onclick=()=>{const list=getVisibleCourses().length?getVisibleCourses():COURSES_DATA;const c=list[Math.floor(Math.random()*list.length)];if(!c)return;if(c.catalogOnly&&c.sourceUrl)window.open(c.sourceUrl,'_blank','noopener');else location.href=detailUrl(c)};
  document.addEventListener('keydown',e=>{if(e.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)){e.preventDefault();$('searchInput').focus()}if(e.key==='Escape')document.querySelectorAll('.modal.open').forEach(m=>closeModal(m.id));});
}

async function loadCatalogManifest(){
  try{
    const response=await fetch('catalogs/manifest.json',{cache:'default'}); if(!response.ok) return;
    catalogManifest=await response.json();
    renderStats();
    renderPlatforms();
    if($('catalogLoadStatus')){
      const total=CatalogRuntime.manifestTotal(catalogManifest).toLocaleString();
      $('catalogLoadStatus').textContent=currentLang==='ar'
        ? `تعذر الاتصال بقاعدة البيانات؛ نعرض نسخة احتياطية محلية تحتوي ${total} سجلًا.`
        : currentLang==='tr'
          ? `Veritabanına ulaşılamadı; ${total} kayıt içeren yerel yedek gösteriliyor.`
          : `Database unavailable; showing a local fallback with ${total} records.`;
    }
  }catch(err){console.warn('Catalog manifest load failed',err);}
}

async function loadSupabaseCatalog(){
  try{
    if(typeof SupabaseRuntime==='undefined'||typeof SUPABASE_CONFIG==='undefined') throw new Error('Supabase runtime/config missing');
    const rows=await SupabaseRuntime.loadAllVerified({...SUPABASE_CONFIG,pageSize:1000,maxRows:50000});
    COURSES_DATA=rows;
    supabaseCatalogLoaded=true;
    catalogManifest=null;
    runtimePlatformCounts={};
    for(const course of COURSES_DATA){if(course.platformId)runtimePlatformCounts[course.platformId]=(runtimePlatformCounts[course.platformId]||0)+1;}
    visibleCourseLimit=COURSE_PAGE_SIZE;
    populateFilters();
    renderStats();
    renderCourses();
    renderPlatforms();
    buildQuiz();
    if($('catalogLoadStatus')){
      const total=COURSES_DATA.length.toLocaleString();
      $('catalogLoadStatus').textContent=currentLang==='ar'
        ? `يعرض الموقع الآن ${total} دورة موثقة مباشرة من قاعدة بيانات Supabase.`
        : currentLang==='tr'
          ? `Site şu anda Supabase veritabanından doğrulanmış ${total} kurs gösteriyor.`
          : `Showing ${total} verified courses directly from the Supabase database.`;
    }
  }catch(err){
    console.warn('Supabase catalog load failed; using JSON fallback',err);
    supabaseCatalogLoaded=false;
    await loadCatalogManifest();
  }
}

document.addEventListener('error',event=>{const img=event.target;if(!(img instanceof HTMLImageElement)||!img.closest('.course-logo')||img.dataset.fallback==='1')return;img.dataset.fallback='1';img.closest('.course-logo')?.classList.remove('course-photo');img.src='icon.svg';},true);

document.addEventListener('DOMContentLoaded',()=>{ const lang=new URLSearchParams(location.search).get('lang'); setLang(lang||currentLang); initTheme(); applyTranslations(); $('langSwitcher').value=currentLang; renderStats(); populateFilters(); renderCategoryChips(); renderPaths(); renderCourses(); renderPlatforms(); bindEvents(); registerPWA(); loadSupabaseCatalog(); });