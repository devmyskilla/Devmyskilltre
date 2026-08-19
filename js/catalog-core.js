(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CourseCatalog = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function normalizeText(value) {
    return String(value == null ? '' : value)
      .normalize('NFD')
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}+#.]+/gu, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function searchableText(course) {
    return normalizeText([
      course.title, course.title_ar, course.title_tr,
      course.summary, course.summary_ar, course.summary_tr,
      course.provider, course.platform, course.category,
      ...(course.skills || []), ...(course.outcomes || []), ...(course.audience || [])
    ].join(' '));
  }

  function searchCourses(courses, query) {
    const q = normalizeText(query);
    if (!q) return [...courses];
    const tokens = q.split(' ').filter(Boolean);
    return courses.filter(course => {
      const hay = searchableText(course);
      return tokens.every(token => hay.includes(token));
    });
  }

  function getDurationBucket(hours) {
    if (hours == null || hours === '' || Number.isNaN(Number(hours))) return 'unknown';
    const h = Number(hours);
    if (h <= 3) return 'quick';
    if (h <= 12) return 'short';
    if (h <= 50) return 'medium';
    return 'long';
  }

  function filterCourses(courses, filters) {
    const f = filters || {};
    return courses.filter(course => {
      if (f.category && course.category !== f.category) return false;
      if (f.level && course.level !== f.level) return false;
      if (f.platform && course.platform !== f.platform) return false;
      if (f.language && !(course.language || []).includes(f.language)) return false;
      if (f.freeOnly && !course.free) return false;
      if (f.certificateOnly && !course.certificate) return false;
      if (f.duration && getDurationBucket(course.durationHours) !== f.duration) return false;
      return true;
    });
  }

  function scoreCourseMatch(course, profile) {
    const p = profile || {};
    let score = Number(course.editorialScore || 0) * 4;
    if (course.featured) score += 4;
    if (p.category) score += course.category === p.category ? 35 : -8;
    if (p.level) score += course.level === p.level ? 12 : 0;
    if (p.language) score += (course.language || []).includes(p.language) ? 10 : 0;
    if (p.freeOnly) score += course.free ? 12 : -25;
    if (p.certificateOnly) score += course.certificate ? 10 : -18;
    if (Array.isArray(p.skills) && p.skills.length) {
      const wanted = p.skills.map(normalizeText);
      const courseSkills = (course.skills || []).map(normalizeText);
      score += wanted.reduce((sum, skill) => sum + (courseSkills.some(x => x.includes(skill) || skill.includes(x)) ? 8 : 0), 0);
    }
    return score;
  }

  function sortCourses(courses, mode, localViews) {
    const list = [...courses];
    const views = localViews || {};
    if (mode === 'title') return list.sort((a, b) => String(a.title).localeCompare(String(b.title)));
    if (mode === 'shortest') return list.sort((a, b) => (a.durationHours || Infinity) - (b.durationHours || Infinity));
    if (mode === 'score') return list.sort((a, b) => (b.editorialScore || 0) - (a.editorialScore || 0));
    if (mode === 'popular') return list.sort((a, b) => (views[b.id] || 0) - (views[a.id] || 0) || (b.editorialScore || 0) - (a.editorialScore || 0));
    return list.sort((a, b) => (b.editorialScore || 0) - (a.editorialScore || 0) || Number(b.featured) - Number(a.featured));
  }

  function getPlatformStats(courses) {
    return {
      courses: courses.length,
      platforms: new Set(courses.map(x => x.platform)).size,
      free: courses.filter(x => x.free).length,
      certificates: courses.filter(x => x.certificate).length
    };
  }

  return { normalizeText, searchCourses, filterCourses, sortCourses, scoreCourseMatch, getDurationBucket, getPlatformStats };
});
