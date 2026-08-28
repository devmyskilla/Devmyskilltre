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
    old_helper="function isOfficialCoursePhoto(course){ return /^https:\\/\\/ugc\\.futurelearn\\.com\\//i.test(String(course?.thumbnail||'')); }\nfunction courseImageClass(course){ return `course-logo${isOfficialCoursePhoto(course)?' course-photo':''}`; }"
    new_helper="function isOfficialCoursePhoto(course){ return course?.imageVerified === true && /^https?:\\/\\//i.test(String(course?.thumbnail||'')); }\nfunction courseImageClass(course){ return `course-logo${isOfficialCoursePhoto(course)?' course-photo':''}`; }\nfunction courseImageSrc(course){ if(isOfficialCoursePhoto(course)) return course.thumbnail; const platform=PLATFORMS_DATA.find(p=>p.id===course?.platformId); return platform?.thumbnail||'icon.svg'; }"
    text=replace_once(text,old_helper,new_helper,'app image helper')
    old='<div class="${courseImageClass(course)}"><img src="${escapeHtml(course.thumbnail||\'icon.svg\')}" alt="" loading="lazy"></div>'
    new='<div class="${courseImageClass(course)}"><img src="${escapeHtml(courseImageSrc(course))}" alt="" loading="lazy"></div>'
    text=replace_once(text,old,new,'app card image')
    path.write_text(text,encoding='utf-8')


def patch_platform_detail():
    path=Path('js/platform-detail.js')
    text=path.read_text(encoding='utf-8')
    old_helper="function isOfficialCoursePhoto(course){return /^https:\\/\\/ugc\\.futurelearn\\.com\\//i.test(String(course?.thumbnail||''));}\nfunction courseImageClass(course){return `course-logo${isOfficialCoursePhoto(course)?' course-photo':''}`;}"
    new_helper="function isOfficialCoursePhoto(course){return course?.imageVerified === true&&/^https?:\\/\\//i.test(String(course?.thumbnail||''));}\nfunction courseImageClass(course){return `course-logo${isOfficialCoursePhoto(course)?' course-photo':''}`;}\nfunction courseImageSrc(course){return isOfficialCoursePhoto(course)?course.thumbnail:(platform?.thumbnail||'icon.svg');}"
    text=replace_once(text,old_helper,new_helper,'platform image helper')
    old='<div class="${courseImageClass(c)}"><img src="${esc(c.thumbnail||platform.thumbnail||\'icon.svg\')}" alt="" loading="lazy"></div>'
    new='<div class="${courseImageClass(c)}"><img src="${esc(courseImageSrc(c))}" alt="" loading="lazy"></div>'
    text=replace_once(text,old,new,'platform card image')
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
print('Applied verified course image UI patch')
