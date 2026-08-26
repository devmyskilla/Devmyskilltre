import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalCourseUrl, classifyCourseResponse, extractCatalogCourseUrls, extractOfficialCourseCount } from '../scripts/course-validator.mjs';

test('canonicalCourseUrl strips query/hash/trailing slash', () => {
  assert.equal(canonicalCourseUrl('https://www.futurelearn.com/courses/test-course/?utm_source=x#top'), 'https://www.futurelearn.com/courses/test-course');
});

test('extractOfficialCourseCount reads Explore count', () => {
  assert.equal(extractOfficialCourseCount('<h2>Explore 1,688 courses</h2>'), 1688);
});

test('extractCatalogCourseUrls only returns unique FutureLearn course detail URLs', () => {
  const html = `
    <a href="/courses/alpha">A</a>
    <a href="https://www.futurelearn.com/courses/beta?x=1">B</a>
    <a href="/courses/alpha#x">A2</a>
    <a href="/courses">all</a>
    <a href="/subjects/business-and-management-courses">subject</a>`;
  assert.deepEqual(extractCatalogCourseUrls(html), [
    'https://www.futurelearn.com/courses/alpha',
    'https://www.futurelearn.com/courses/beta'
  ]);
});

test('classifyCourseResponse marks active listed course', () => {
  const result=classifyCourseResponse({
    sourceUrl:'https://www.futurelearn.com/courses/alpha',
    finalUrl:'https://www.futurelearn.com/courses/alpha',
    status:200,
    html:'<h1>Alpha</h1><button>Join course</button>',
    listedInCatalog:true
  });
  assert.equal(result.status,'active-listed');
  assert.equal(result.pageExists,true);
  assert.equal(result.listedInCatalog,true);
});

test('classifyCourseResponse distinguishes live page not listed in catalogue', () => {
  const result=classifyCourseResponse({
    sourceUrl:'https://www.futurelearn.com/courses/legacy',
    finalUrl:'https://www.futurelearn.com/courses/legacy',
    status:200,
    html:'<h1>Legacy</h1><button>Join now</button>',
    listedInCatalog:false
  });
  assert.equal(result.status,'active-unlisted');
});

test('classifyCourseResponse marks 404 and blocked responses', () => {
  assert.equal(classifyCourseResponse({sourceUrl:'https://www.futurelearn.com/courses/x',status:404,finalUrl:'',html:'',listedInCatalog:false}).status,'not-found');
  assert.equal(classifyCourseResponse({sourceUrl:'https://www.futurelearn.com/courses/x',status:429,finalUrl:'',html:'',listedInCatalog:false}).status,'blocked');
});
