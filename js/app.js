const $ = id => document.getElementById(id);
const STORAGE = { favorites:'dunya.course.favorites', recent:'dunya.course.recent', compare:'dunya.course.compare', views:'dunya.course.views', theme:'dunya.theme' };
let activeTab = 'all';
let activeCategory = '';
let deferredInstallPrompt = null;

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

function renderStats(){ const s=CourseCatalog.getPlatformStats(COURSES_DATA); $('statCourses').textContent=s.courses; $('statPlatforms').textContent=s.platforms; $('statFree').textContent=s.free; $('statCert').textContent=s.certificates; }

function categoryEntries(){ const icons={programming:'💻',data:'📊',ai:'🤖',cybersecurity:'🛡️',marketing:'📣','project-management':'🧭',languages:'🌐'}; return [...new Set(COURSES_DATA.map(c=>c.category))].map(key=>({key,icon:icons[key]||'✦',count:COURSES_DATA.filter(c=>c.category===key).length})); }
function renderCategoryChips(){ const wrap=$('categoryChips'); wrap.innerHTML=`<button class="category-chip ${!activeCategory?'active':''}" data-category=""><span>✨</span><b>${getText('all')}</b><small>${COURSES_DATA.length}</small></button>`+categoryEntries().map(c=>`<button class="category-chip ${activeCategory===c.key?'active':''}" data-category="${c.key}"><span>${c.icon}</span><b>${escapeHtml(categoryLabel(c.key))}</b><small>${c.count}</small></button>`).join(''); }

function renderPaths(){ const grid=$('pathsGrid'); grid.innerHTML=LEARNING_PATHS.map(path=>{
  const total=new Set(path.stages.flatMap(s=>s.courseIds)).size;
  const title=currentLang==='ar'?path.title_ar:currentLang==='tr'?(path.title_tr||path.title):path.title;
  return `<article class="path-card" data-path="${path.id}"><div class="path-icon">${path.icon||'🧭'}</div><div><h3>${escapeHtml(title)}</h3><p>${path.stages.length} ${getText('nextStep')} · ${total} ${getText('courses')}</p></div><button class="path-open" data-open-path="${path.id}" type="button">${getText('openPath')} ↗</button></article>`;
}).join(''); }

function option(value,label){ return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`; }
function populateFilters(){
  const categories=[...new Set(COURSES_DATA.map(c=>c.category))]; const levels=[...new Set(COURSES_DATA.map(c=>c.level))]; const platforms=[...new Set(COURSES_DATA.map(c=>c.platform))].sort(); const langs=[...new Set(COURSES_DATA.flatMap(c=>c.language||[]))];
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
function cardHtml(course, compact=false){ const fav=favorites().has(course.id), compare=compareSet().has(course.id), views=viewCounts()[course.id]||0; const title=courseField(course,'title'), summary=courseField(course,'summary');
  return `<article class="course-card ${compact?'compact-card':''}">
    <div class="card-top"><div class="course-logo"><img src="${escapeHtml(course.thumbnail)}" alt="" loading="lazy"></div><div class="card-top-actions"><button class="round-btn ${fav?'active':''}" data-action="favorite" data-id="${course.id}" aria-label="favorite">♥</button><button class="round-btn ${compare?'active':''}" data-action="compare" data-id="${course.id}" aria-label="compare">⚖</button></div><span class="editorial-score">${course.editorialScore.toFixed(1)}</span></div>
    <div class="card-body"><div class="provider-line"><span>${escapeHtml(course.provider)}</span><small>${escapeHtml(course.platform)}</small></div><h3>${escapeHtml(title)}</h3>${compact?'':`<p>${escapeHtml(summary)}</p>`}
    <div class="fact-row"><span>◷ ${escapeHtml(durationText(course))}</span><span>◎ ${escapeHtml(levelLabel(course.level))}</span></div>
    <div class="badge-row"><span class="badge ${course.free?'good':'soft'}">${course.free?getText('free'):getText('paid')}</span><span class="badge ${course.certificate?'good':'muted'}">${course.certificate?'🎓 '+getText('certificate'):getText('noCertificate')}</span>${course.unionPick?`<span class="badge accent">★ ${getText('developerPick')}</span>`:''}</div>
    ${compact?'':`<div class="skill-row wrap">${course.skills.slice(0,4).map(s=>`<span>${escapeHtml(s)}</span>`).join('')}</div>`}
    <div class="card-footer"><span>${views?`👁 ${views} ${getText('localViews')}`:''}</span><a class="details-link" href="${detailUrl(course)}">${getText('details')} <b>↗</b></a></div></div></article>`;
}

function renderCourses(){ const list=getVisibleCourses(); $('resultsCount').textContent=list.length; $('allBadge').textContent=COURSES_DATA.length; $('favBadge').textContent=favorites().size; $('recentBadge').textContent=recentIds().length; $('coursesGrid').innerHTML=list.length?list.map(c=>cardHtml(c)).join(''):`<div class="no-results">⌕<strong>${getText('noResults')}</strong></div>`; renderCategoryChips(); updateCompareDock(); }

function toggleFavorite(id){ const set=favorites(); set.has(id)?set.delete(id):set.add(id); writeJSON(STORAGE.favorites,[...set]); renderCourses(); }
function toggleCompare(id){ const set=compareSet(); if(set.has(id)) set.delete(id); else { if(set.size>=3){showToast(getText('maxCompare'));return;} set.add(id); } writeJSON(STORAGE.compare,[...set]); renderCourses(); }
function updateCompareDock(){ const set=compareSet(), courses=[...set].map(id=>COURSES_DATA.find(c=>c.id===id)).filter(Boolean); $('compareCount').textContent=`${courses.length}/3`; $('compareNames').textContent=courses.map(c=>courseField(c,'title')).join(' · '); $('compareDock').classList.toggle('show',courses.length>0); }

function buildCompare(){ const selected=[...compareSet()].map(id=>COURSES_DATA.find(c=>c.id===id)).filter(Boolean); if(!selected.length){showToast(getText('compareCourses'));return;} const rows=[
  [getText('platform'),c=>c.platform],[getText('category'),c=>categoryLabel(c.category)],[getText('level'),c=>levelLabel(c.level)],[getText('duration'),c=>durationText(c)],[getText('free'),c=>c.free?'✓ '+getText('free'):'— '+getText('paid')],[getText('certificate'),c=>c.certificate?'✓ '+getText('certificate'):'—'],[getText('score'),c=>c.editorialScore.toFixed(1)+'/10'],[getText('skills'),c=>c.skills.slice(0,5).join(', ')]
  ]; $('compareTable').innerHTML=`<table class="compare-table"><thead><tr><th></th>${selected.map(c=>`<th><img src="${escapeHtml(c.thumbnail)}" alt=""><strong>${escapeHtml(courseField(c,'title'))}</strong></th>`).join('')}</tr></thead><tbody>${rows.map(([label,fn])=>`<tr><th>${escapeHtml(label)}</th>${selected.map(c=>`<td>${escapeHtml(fn(c))}</td>`).join('')}</tr>`).join('')}</tbody></table>`; openModal('compareModal'); }

function openModal(id){ const m=$(id); if(!m)return;m.classList.add('open');document.body.classList.add('modal-open'); }
function closeModal(id){ const m=$(id);if(!m)return;m.classList.remove('open'); if(!document.querySelector('.modal.open'))document.body.classList.remove('modal-open'); }

function buildQuiz(){ const cats=categoryEntries(); $('quizForm').innerHTML=`<div class="quiz-grid"><label><span>${getText('goalCategory')}</span><select id="quizCategory">${option('',getText('any'))}${cats.map(c=>option(c.key,categoryLabel(c.key))).join('')}</select></label><label><span>${getText('preferredLevel')}</span><select id="quizLevel">${option('',getText('any'))}${['beginner','intermediate','advanced'].map(v=>option(v,levelLabel(v))).join('')}</select></label><label><span>${getText('needFree')}</span><select id="quizFree">${option('',getText('any'))}${option('yes',getText('freeOnly'))}</select></label><label><span>${getText('needCertificate')}</span><select id="quizCert">${option('',getText('any'))}${option('yes',getText('certificateOnly'))}</select></label></div><button id="runQuiz" class="btn primary full" type="button">✨ ${getText('showRecommendations')}</button>`; $('quizResults').innerHTML=''; $('runQuiz').onclick=runQuiz; }
function runQuiz(){ const profile={category:$('quizCategory').value,level:$('quizLevel').value,freeOnly:$('quizFree').value==='yes',certificateOnly:$('quizCert').value==='yes'}; const ranked=COURSES_DATA.map(c=>({course:c,score:CourseCatalog.scoreCourseMatch(c,profile)})).sort((a,b)=>b.score-a.score).slice(0,4); const min=Math.min(...ranked.map(x=>x.score)),max=Math.max(...ranked.map(x=>x.score)); $('quizResults').innerHTML=`<div class="quiz-results">${ranked.map((x,i)=>{const pct=max===min?95:Math.round(72+(x.score-min)/(max-min)*26);return `<a class="match-row" href="${detailUrl(x.course)}"><span class="rank">${i+1}</span><img src="${escapeHtml(x.course.thumbnail)}" alt=""><div><strong>${escapeHtml(courseField(x.course,'title'))}</strong><small>${escapeHtml(categoryLabel(x.course.category))} · ${escapeHtml(durationText(x.course))}</small></div><b>${pct}%<small>${getText('match')}</small></b></a>`}).join('')}</div>`; }

function showPath(pathId){ const path=LEARNING_PATHS.find(p=>p.id===pathId); if(!path)return; const title=currentLang==='ar'?path.title_ar:currentLang==='tr'?(path.title_tr||path.title):path.title; $('pathDetail').innerHTML=`<span class="section-kicker">${path.icon||'🧭'} ${getText('pathCourses')}</span><h2>${escapeHtml(title)}</h2><div class="learning-path">${path.stages.map((stage,index)=>{const st=currentLang==='ar'?stage.title_ar:stage.title; const items=stage.courseIds.map(id=>COURSES_DATA.find(c=>c.id===id)).filter(Boolean);return `<div class="path-stage"><div class="stage-number">${index+1}</div><div><small>${getText('nextStep')} ${index+1}</small><h3>${escapeHtml(st)}</h3><div class="courses-grid compact">${items.map(c=>cardHtml(c,true)).join('')}</div></div></div>`}).join('')}</div>`; openModal('pathModal'); }

async function shareCourse(id){ const course=COURSES_DATA.find(c=>c.id===id); if(!course)return; const url=new URL(detailUrl(course),location.href).href; try{ if(navigator.share) await navigator.share({title:courseField(course,'title'),text:courseField(course,'summary'),url}); else {await navigator.clipboard.writeText(url);showToast(getText('copied'));} }catch(_){} }

function resetFilters(){ activeCategory=''; ['filterCategory','filterLevel','filterPlatform','filterLanguage','filterDuration'].forEach(id=>$(id).value=''); $('filterFree').checked=false;$('filterCertificate').checked=false;$('sortSelect').value='recommended';$('catalogSearch').value='';$('searchInput').value='';renderCourses(); }
function changeLanguage(lang){ setLang(lang); applyTranslations(); populateFilters(); renderStats(); renderPaths(); renderCourses(); buildQuiz(); }
function registerPWA(){ if('serviceWorker' in navigator) addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{})); addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;$('installBtn').hidden=false}); $('installBtn').addEventListener('click',async()=>{if(!deferredInstallPrompt)return;deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;$('installBtn').hidden=true}); }

function bindEvents(){
  $('themeToggle').onclick=()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'); $('langSwitcher').onchange=e=>changeLanguage(e.target.value);
  $('searchInput').addEventListener('input',e=>{$('catalogSearch').value=e.target.value;renderCourses();}); $('catalogSearch').addEventListener('input',e=>{$('searchInput').value=e.target.value;renderCourses();});
  ['filterCategory','filterLevel','filterPlatform','filterLanguage','filterDuration','sortSelect','filterFree','filterCertificate'].forEach(id=>$(id).addEventListener('change',()=>{if(id==='filterCategory')activeCategory=$('filterCategory').value;renderCourses()})); $('resetFilters').onclick=resetFilters;
  $('categoryChips').addEventListener('click',e=>{const btn=e.target.closest('[data-category]');if(!btn)return;activeCategory=btn.dataset.category;$('filterCategory').value=activeCategory;renderCourses();document.getElementById('catalog').scrollIntoView({behavior:'smooth'});});
  document.querySelectorAll('.tab').forEach(btn=>btn.onclick=()=>{activeTab=btn.dataset.tab;document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b===btn));renderCourses()});
  document.addEventListener('click',e=>{const a=e.target.closest('[data-action]'); if(a){e.preventDefault();const id=a.dataset.id;if(a.dataset.action==='favorite')toggleFavorite(id);if(a.dataset.action==='compare')toggleCompare(id);if(a.dataset.action==='share')shareCourse(id);} const close=e.target.closest('[data-close]');if(close)closeModal(close.dataset.close);const path=e.target.closest('[data-open-path]');if(path)showPath(path.dataset.openPath);if(e.target.classList.contains('modal'))closeModal(e.target.id);});
  $('clearCompare').onclick=()=>{writeJSON(STORAGE.compare,[]);renderCourses()}; $('compareNow').onclick=buildCompare; $('heroQuizBtn').onclick=()=>{buildQuiz();openModal('quizModal')}; $('randomBtn').onclick=()=>{const list=getVisibleCourses().length?getVisibleCourses():COURSES_DATA;location.href=detailUrl(list[Math.floor(Math.random()*list.length)])};
  document.addEventListener('keydown',e=>{if(e.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)){e.preventDefault();$('searchInput').focus()}if(e.key==='Escape')document.querySelectorAll('.modal.open').forEach(m=>closeModal(m.id));});
}

document.addEventListener('DOMContentLoaded',()=>{ const lang=new URLSearchParams(location.search).get('lang'); setLang(lang||currentLang); initTheme(); applyTranslations(); $('langSwitcher').value=currentLang; renderStats(); populateFilters(); renderCategoryChips(); renderPaths(); renderCourses(); bindEvents(); registerPWA(); });
