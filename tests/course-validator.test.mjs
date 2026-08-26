import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalCourseUrl,
  classifyCourseResponse,
  extractCatalogCourseUrls,
  extractOfficialCourseCount,
  extractOfficialCourseImage,
  findMissingCatalogUrls,
  sampleStatuses
} from '../scripts/course-validator.mjs';

test('canonicalCourseUrl strips query/hash/trailing slash', () => {
  assert.equal(canonicalCourseUrl('https://www.futurelearn.com/courses/test-course/?utm_source=x#top'), 'https://www.futurelearn.com/courses/test-course');
});

test('extractOfficialCourseCount reads Explore count', () => {
  assert.equal(extractOfficialCourseCount('<h2>Explore 1,688 courses</h2>'), 1688);
});

test('extractOfficialCourseImage prefers official og:image regardless of attribute order', () => {
  const html=`
    <meta content="https://ugc.futurelearn.com/uploads/images/course.jpg?width=800&amp;height=450" property="og:image">
    <meta name="twitter:image" content="https://ugc.futurelearn.com/uploads/images/twitter.jpg">`;
  assert.equal(
    extractOfficialCourseImage(html,'https://www.futurelearn.com/courses/alpha'),
    'https://ugc.futurelearn.com/uploads/images/course.jpg?width=800&height=450'
  );
});

test('extractOfficialCourseImage falls back to twitter:image and resolves relative URLs', () => {
  const html='<meta content="/images/course-card.jpg" name="twitter:image">';
  assert.equal(
    extractOfficialCourseImage(html,'https://www.futurelearn.com/courses/alpha'),
    'https://www.futurelearn.com/images/course-card.jpg'
  );
});

test('extractOfficialCourseImage falls back to JSON-LD image', () => {
  const html='<script type="application/ld+json">{"@type":"Course","image":["https://ugc.futurelearn.com/uploads/images/jsonld.jpg"]}</script>';
  assert.equal(
    extractOfficialCourseImage(html,'https://www.futurelearn.com/courses/alpha'),
    'https://ugc.futurelearn.com/uploads/images/jsonld.jpg'
  );
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

test('findMissingCatalogUrls returns current catalogue URLs absent from database', () => {
  assert.deepEqual(findMissingCatalogUrls(
    new Set([
      'https://www.futurelearn.com/courses/alpha',
      'https://www.futurelearn.com/courses/beta',
      'https://www.futurelearn.com/courses/gamma'
    ]),
    new Set([
      'https://www.futurelearn.com/courses/alpha',
      'https://www.futurelearn.com/courses/gamma'
    ])
  ), ['https://www.futurelearn.com/courses/beta']);
});

test('sampleStatuses groups a limited sample for each validation status', () => {
  const samples=sampleStatuses([
    {id:'1',status:'active-listed'},
    {id:'2',status:'not-course-page'},
    {id:'3',status:'not-course-page'},
    {id:'4',status:'not-course-page'}
  ],2);
  assert.deepEqual(samples['active-listed'].map(x=>x.id),['1']);
  assert.deepEqual(samples['not-course-page'].map(x=>x.id),['2','3']);
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
