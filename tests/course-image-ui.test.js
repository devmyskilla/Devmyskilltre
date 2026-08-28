const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const app=fs.readFileSync('js/app.js','utf8');
const platform=fs.readFileSync('js/platform-detail.js','utf8');
const runtime=fs.readFileSync('js/supabase-runtime.js','utf8');
const css=fs.readFileSync('css/style.css','utf8');

test('Supabase runtime exposes image verification state to the UI',()=>{
  assert.match(runtime,/image_verified/);
  assert.match(runtime,/imageVerified/);
});

test('homepage treats any verified course artwork as a full course photo',()=>{
  assert.match(app,/imageVerified\s*===\s*true/);
  assert.match(app,/course-photo/);
});

test('platform cards treat any verified course artwork as a full course photo',()=>{
  assert.match(platform,/imageVerified\s*===\s*true/);
  assert.match(platform,/course-photo/);
});

test('unverified database thumbnails are not promoted as course artwork',()=>{
  assert.match(app,/courseImageSrc/);
  assert.match(platform,/courseImageSrc/);
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
