from pathlib import Path


def replace_once(text, old, new, label):
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f'{label} marker not found')
    return text.replace(old, new, 1)


def patch_app():
    path=Path('js/app.js')
    text=path.read_text(encoding='utf-8')
    marker="function durationText(course){ return localizedValue(course.durationLabel)||getText('unknownDuration'); }"
    helper="function isOfficialCoursePhoto(course){ return /^https:\\/\\/ugc\\.futurelearn\\.com\\//i.test(String(course?.thumbnail||'')); }\nfunction courseImageClass(course){ return `course-logo${isOfficialCoursePhoto(course)?' course-photo':''}`; }"
    if helper not in text:
        if marker not in text:
            raise SystemExit('app duration marker not found')
        text=text.replace(marker,marker+'\n'+helper,1)
    old='<div class="course-logo"><img src="${escapeHtml(course.thumbnail||\'icon.svg\')}" alt="" loading="lazy"></div>'
    new='<div class="${courseImageClass(course)}"><img src="${escapeHtml(course.thumbnail||\'icon.svg\')}" alt="" loading="lazy"></div>'
    text=replace_once(text,old,new,'app card image')
    listener="document.addEventListener('error',event=>{const img=event.target;if(!(img instanceof HTMLImageElement)||!img.closest('.course-logo')||img.dataset.fallback==='1')return;img.dataset.fallback='1';img.closest('.course-logo')?.classList.remove('course-photo');img.src='icon.svg';},true);"
    if listener not in text:
        marker="document.addEventListener('DOMContentLoaded'"
        index=text.find(marker)
        if index<0:
            raise SystemExit('app DOMContentLoaded marker not found')
        text=text[:index]+listener+'\n\n'+text[index:]
    path.write_text(text,encoding='utf-8')


def patch_platform_detail():
    path=Path('js/platform-detail.js')
    text=path.read_text(encoding='utf-8')
    marker="function setTheme(theme){document.documentElement.dataset.theme=theme;"
    helper="function isOfficialCoursePhoto(course){return /^https:\\/\\/ugc\\.futurelearn\\.com\\//i.test(String(course?.thumbnail||''));}\nfunction courseImageClass(course){return `course-logo${isOfficialCoursePhoto(course)?' course-photo':''}`;}\n"
    if helper not in text:
        index=text.find(marker)
        if index<0:
            raise SystemExit('platform detail theme marker not found')
        text=text[:index]+helper+text[index:]
    old='<div class="course-logo"><img src="${esc(c.thumbnail||platform.thumbnail||\'icon.svg\')}" alt="" loading="lazy"></div>'
    new='<div class="${courseImageClass(c)}"><img src="${esc(c.thumbnail||platform.thumbnail||\'icon.svg\')}" alt="" loading="lazy"></div>'
    text=replace_once(text,old,new,'platform card image')
    listener="document.addEventListener('error',event=>{const img=event.target;if(!(img instanceof HTMLImageElement)||!img.closest('.course-logo')||img.dataset.fallback==='1')return;img.dataset.fallback='1';img.closest('.course-logo')?.classList.remove('course-photo');img.src='icon.svg';},true);"
    if listener not in text:
        marker="document.addEventListener('DOMContentLoaded'"
        index=text.find(marker)
        if index<0:
            raise SystemExit('platform DOMContentLoaded marker not found')
        text=text[:index]+listener+'\n'+text[index:]
    path.write_text(text,encoding='utf-8')


def patch_css():
    path=Path('css/style.css')
    text=path.read_text(encoding='utf-8')
    block='''

/* Official course artwork from source platforms */
.course-card .card-top:has(.course-logo.course-photo){min-height:170px;position:relative;overflow:hidden;border-radius:14px}
.course-logo.course-photo{position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:0;padding:0;background:var(--surface);overflow:hidden}
.course-logo.course-photo img{width:100%;height:100%;object-fit:cover}
.course-card .card-top:has(.course-logo.course-photo) .card-top-actions,.course-card .card-top:has(.course-logo.course-photo) .editorial-score{position:relative;z-index:2}
'''
    if '.course-logo.course-photo{' not in text:
        text=text.rstrip()+block.rstrip()+'\n'
    path.write_text(text,encoding='utf-8')


patch_app()
patch_platform_detail()
patch_css()
print('Applied official course image UI patch')
