const $=id=>document.getElementById(id);
const STORAGE_THEME='dunya.theme';
const PLATFORM_PAGE_SIZE=60;
let platform=null, platformCourses=[], visiblePlatformLimit=PLATFORM_PAGE_SIZE, searchTimer=null;

function esc(v){return String(v??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));}
function key(v){return CourseCatalog.normalizeText(v).replace(/\s+/g,'');}
function localizedPlatform(p){if(currentLang==='en')return p.description_en||p.description||'';if(currentLang==='tr')return p.description_tr||p.description||'';return p.description||'';}
function matchesPlatform(course,p){const k=key(p.name);return [course.platform,course.provider].filter(Boolean).some(v=>{const x=key(v);return x===k||x.includes(k)||k.includes(x)});}
function setTheme(theme){document.documentElement.dataset.theme=theme;try{localStorage.setItem(STORAGE_THEME,theme)}catch(_){};$('themeToggle').textContent=theme==='dark'?'☀':'◐';}
function initTheme(){let saved;try{saved=localStorage.getItem(STORAGE_THEME)}catch(_){};const preferred=matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light';setTheme(saved||preferred);}
function courseCard(c){const title=(currentLang==='ar'&&c.title_ar)||(currentLang==='tr'&&c.title_tr)||c.title||c.name||'Course';const summary=(currentLang==='ar'&&c.summary_ar)||(currentLang==='tr'&&c.summary_tr)||c.summary||'';const url=c.sourceUrl||c.url||'#';const rich=!!COURSES_DATA.find(x=>x.id===c.id);return `<article class="course-card"><div class="card-top"><div class="course-logo"><img src="${esc(c.thumbnail||platform.thumbnail||'icon.svg')}" alt="" loading="lazy"></div><span class="editorial-score">${c.editorialScore?Number(c.editorialScore).toFixed(1):'↗'}</span></div><div class="card-body"><div class="provider-line"><span>${esc(c.provider||platform.name)}</span><small>${esc(c.platform||platform.name)}</small></div><h3>${esc(title)}</h3><p class="card-summary">${esc(summary||getText('sourceOnlyCourse'))}</p><div class="card-footer"><span>${c.free?'✓ '+getText('free'):''}</span>${rich?`<a class="details-link" href="course.html?id=${encodeURIComponent(c.id)}&lang=${encodeURIComponent(currentLang)}">${getText('details')} ↗</a>`:`<a class="details-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${getText('openOfficial')} ↗</a>`}</div></div></article>`;}

async function loadManifest(){try{const r=await fetch('catalogs/manifest.json',{cache:'default'});if(!r.ok)return null;return await r.json();}catch(_){return null;}}
async function fetchRows(target){const r=await fetch(encodeURI(target),{cache:'default'});if(!r.ok)return[];const data=await r.json();return Array.isArray(data)?data:(Array.isArray(data?.courses)?data.courses:[]);}
async function loadShard(id,manifest){
  const meta=manifest?.platforms?.[id];
  const candidates=[];
  if(meta?.cleanFile)candidates.push(meta.cleanFile);
  if(meta?.catalogFile&&!candidates.includes(meta.catalogFile))candidates.push(meta.catalogFile);
  const legacy=`catalogs/${id}.json`; if(!candidates.includes(legacy))candidates.push(legacy);
  for(const target of candidates){try{const rows=await fetchRows(target);if(rows.length)return rows;}catch(_){}}
  return[];
}
function dedupe(list){const seen=new Set();return list.filter(c=>{const k=c.id||c.sourceUrl||c.url||`${c.platform}:${c.title}`;if(!k||seen.has(k))return false;seen.add(k);return true;});}
function prepareSearch(list){for(const c of list){c.__search=CourseCatalog.normalizeText([c.title,c.title_ar,c.title_tr,c.summary,c.summary_ar,c.summary_tr,c.provider,c.platform,c.category].filter(Boolean).join(' '));}return list;}
function filteredCourses(){const q=CourseCatalog.normalizeText($('platformCourseSearch').value||'');if(!q)return platformCourses;const tokens=q.split(' ').filter(Boolean);return platformCourses.filter(c=>tokens.every(t=>(c.__search||'').includes(t)));}
function renderCourses(){
  document.querySelector('.catalog-load-more')?.remove();
  const list=filteredCourses();
  const shown=list.slice(0,visiblePlatformLimit);
  $('platformCourseCount').textContent=platformCourses.length;
  $('platformCoursesGrid').innerHTML=shown.length?shown.map(courseCard).join(''):`<div class="no-results">⌕<strong>${getText('noResults')}</strong></div>`;
  if(list.length>shown.length){
    const more=document.createElement('div');more.className='catalog-load-more';
    more.innerHTML=`<button class="btn soft" id="loadMorePlatformCourses" type="button">+ ${Math.min(PLATFORM_PAGE_SIZE,list.length-shown.length)} ${getText('courses')}</button>`;
    $('platformCoursesGrid').after(more);
    more.querySelector('button').onclick=()=>{visiblePlatformLimit+=PLATFORM_PAGE_SIZE;renderCourses();};
  }
}
function renderPlatform(){document.title=`${platform.name} | ${getText('siteName')}`;$('platformLogo').src=platform.thumbnail||'icon.svg';$('platformTitle').textContent=platform.name;$('platformDescription').textContent=localizedPlatform(platform);$('officialCatalogLink').href=platform.link;$('platformMeta').innerHTML=`<span>${platform.free?'✓ '+getText('free'):getText('paid')}</span>${platform.certificate?`<span>🎓 ${getText('certificate')}</span>`:''}<span>🌐 ${esc(platform.language||'')}</span>`;renderCourses();}
async function init(){
  const params=new URLSearchParams(location.search);setLang(params.get('lang')||currentLang);initTheme();applyTranslations();$('langSwitcher').value=currentLang;
  platform=PLATFORMS_DATA.find(p=>p.id===params.get('id'))||PLATFORMS_DATA.find(p=>p.id==='plat-1');
  const curated=COURSES_DATA.filter(c=>matchesPlatform(c,platform));
  const manifest=await loadManifest();
  const shard=await loadShard(platform.id,manifest);
  platformCourses=prepareSearch(dedupe([...curated,...shard]));
  renderPlatform();
  $('platformCourseSearch').addEventListener('input',()=>{clearTimeout(searchTimer);visiblePlatformLimit=PLATFORM_PAGE_SIZE;searchTimer=setTimeout(renderCourses,160);});
  $('langSwitcher').onchange=e=>{setLang(e.target.value);applyTranslations();visiblePlatformLimit=PLATFORM_PAGE_SIZE;renderPlatform()};
  $('themeToggle').onclick=()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
  if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}
document.addEventListener('DOMContentLoaded',init);
