import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalFutureLearnCourseUrl,
  extractCourseImagePairs,
  extractCourseCountFromMarkdown,
  extractPrimaryCourseImage
} from '../scripts/futurelearn-images.mjs';

test('extractCourseImagePairs maps official FutureLearn thumbnail to its course URL',()=>{
  const md=`
[![Image 2: Three people working on the laptop.](https://ugc.futurelearn.com/uploads/images/72/fb/thumbnail_72fb47aa-a1a3-4d77-b66e-9230e7151dea.jpg) Short Course ### AWS Generative AI for Developers](https://www.futurelearn.com/courses/generative-ai-for-developers)
[![Image 3](https://ugc.futurelearn.com/uploads/images/a4/36/thumbnail_a436c6d3-363f-420b-bc36-7bfb130921b2.jpg) Short Course ### AI Security](https://www.futurelearn.com/courses/ai-security-automation-for-cybersecurity-operations?utm_source=x)`;
  assert.deepEqual(extractCourseImagePairs(md),[
    {sourceUrl:'https://www.futurelearn.com/courses/generative-ai-for-developers',imageUrl:'https://ugc.futurelearn.com/uploads/images/72/fb/thumbnail_72fb47aa-a1a3-4d77-b66e-9230e7151dea.jpg'},
    {sourceUrl:'https://www.futurelearn.com/courses/ai-security-automation-for-cybersecurity-operations',imageUrl:'https://ugc.futurelearn.com/uploads/images/a4/36/thumbnail_a436c6d3-363f-420b-bc36-7bfb130921b2.jpg'}
  ]);
});

test('extractCourseImagePairs ignores non-FutureLearn images and non-course links',()=>{
  const md=`
[![Logo](https://assets.futurelearn.com/logo.svg)](https://www.futurelearn.com/)
[![External](https://example.com/x.jpg)](https://www.futurelearn.com/courses/alpha)
[![Subject](https://ugc.futurelearn.com/uploads/images/x.jpg)](https://www.futurelearn.com/subjects/business)`;
  assert.deepEqual(extractCourseImagePairs(md),[]);
});

test('extractCourseCountFromMarkdown reads current Explore count',()=>{
  assert.equal(extractCourseCountFromMarkdown('## Explore 1,698 courses'),1698);
});

test('extractPrimaryCourseImage returns official course hero image',()=>{
  const md=`# A course\n![Hero](https://ugc.futurelearn.com/uploads/images/aa/bb/header_x.jpg)\n![Other](https://ugc.futurelearn.com/uploads/images/cc/dd/step.jpg)`;
  assert.equal(extractPrimaryCourseImage(md),'https://ugc.futurelearn.com/uploads/images/aa/bb/header_x.jpg');
});

test('extractPrimaryCourseImage prefers the current course header over unrelated featured thumbnails',()=>{
  const md=`
[![Featured](https://ugc.futurelearn.com/uploads/images/11/22/thumbnail_featured.jpg)](https://www.futurelearn.com/courses/featured-course)
[![Another](https://ugc.futurelearn.com/uploads/images/33/44/thumbnail_other.jpg)](https://www.futurelearn.com/courses/another-course)
![Current course hero](https://ugc.futurelearn.com/uploads/images/68/65/header_current-course.jpg)
`;
  assert.equal(extractPrimaryCourseImage(md),'https://ugc.futurelearn.com/uploads/images/68/65/header_current-course.jpg');
});

test('extractPrimaryCourseImage falls back to a thumbnail when no header exists',()=>{
  const md=`![Course](https://ugc.futurelearn.com/uploads/images/aa/bb/thumbnail_course.jpg)`;
  assert.equal(extractPrimaryCourseImage(md),'https://ugc.futurelearn.com/uploads/images/aa/bb/thumbnail_course.jpg');
});

test('canonicalFutureLearnCourseUrl strips query, hash and run suffix',()=>{
  assert.equal(canonicalFutureLearnCourseUrl('https://www.futurelearn.com/courses/alpha/1?x=1#top'),'https://www.futurelearn.com/courses/alpha');
});
