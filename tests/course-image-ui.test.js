const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const app=fs.readFileSync('js/app.js','utf8');
const platform=fs.readFileSync('js/platform-detail.js','utf8');
const css=fs.readFileSync('css/style.css','utf8');

test('homepage recognizes official FutureLearn UGC thumbnails as course photos',()=>{
  assert.match(app,/ugc\\?\.futurelearn\\?\.com|ugc\.futurelearn\.com/i);
  assert.match(app,/course-photo/);
});

test('platform cards recognize official FutureLearn UGC thumbnails as course photos',()=>{
  assert.match(platform,/ugc\\?\.futurelearn\\?\.com|ugc\.futurelearn\.com/i);
  assert.match(platform,/course-photo/);
});

test('official course photos fill the card header and crop cleanly',()=>{
  assert.match(css,/\.course-logo\.course-photo\s*\{/);
  assert.match(css,/\.course-logo\.course-photo img\s*\{[^}]*object-fit:cover/);
});

test('broken course images have a local icon fallback',()=>{
  assert.match(app,/icon\.svg/);
  assert.match(platform,/icon\.svg/);
  assert.match(app,/addEventListener\(['"]error['"]/);
  assert.match(platform,/addEventListener\(['"]error['"]/);
});
