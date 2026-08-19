import test from 'node:test';
import assert from 'node:assert/strict';
import { platformFileName, cleanCourseRecords } from '../scripts/catalog-tools.mjs';

test('platformFileName creates stable human-readable JSON filenames',()=>{
  assert.equal(platformFileName('Coursera','plat-26'),'Coursera.json');
  assert.equal(platformFileName('Ahrefs Academy','plat-110'),'Ahrefs-Academy.json');
  assert.equal(platformFileName('إدراك Edraak','plat-31'),'إدراك-Edraak.json');
  assert.equal(platformFileName('openlearn.aucegypt.edu','plat-11'),'openlearn.aucegypt.edu.json');
});

test('cleanCourseRecords keeps course roots and removes lesson/exam child pages',()=>{
  const rows=[
    {title:'SEO Training Course',sourceUrl:'https://ahrefs.com/academy/seo-training-course'},
    {title:'Lesson 0 1',sourceUrl:'https://ahrefs.com/academy/seo-training-course/lesson-0-1'},
    {title:'Take Exam',sourceUrl:'https://ahrefs.com/academy/seo-training-course/exam'},
    {title:'Blogging for Business',sourceUrl:'https://ahrefs.com/academy/blogging-for-business'},
    {title:'Overview',sourceUrl:'https://ahrefs.com/academy/blogging-for-business/overview'}
  ];
  const cleaned=cleanCourseRecords(rows,{name:'Ahrefs Academy',link:'https://ahrefs.com/academy/'});
  assert.deepEqual(cleaned.map(r=>r.title),['SEO Training Course','Blogging for Business']);
});

test('cleanCourseRecords removes duplicates and obvious navigation records',()=>{
  const rows=[
    {title:'Python Basics',sourceUrl:'https://example.org/courses/python-basics'},
    {title:'Python Basics duplicate',sourceUrl:'https://example.org/courses/python-basics/'},
    {title:'Courses',sourceUrl:'https://example.org/courses'},
    {title:'Home',sourceUrl:'https://example.org/'}
  ];
  const cleaned=cleanCourseRecords(rows,{name:'Example',link:'https://example.org/courses'});
  assert.equal(cleaned.length,1);
  assert.equal(cleaned[0].sourceUrl,'https://example.org/courses/python-basics');
});
