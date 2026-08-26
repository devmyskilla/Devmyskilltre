const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const runtimePath = path.join(ROOT, 'js/supabase-runtime.js');

test('Supabase runtime exists', () => {
  assert.ok(fs.existsSync(runtimePath), 'js/supabase-runtime.js must exist');
});

test('Supabase runtime maps database rows into catalog courses', () => {
  const runtime = require(runtimePath);
  const course = runtime.normalizeCourseRow({
    id: 42,
    external_id: 'fl-42',
    title: 'AI for Everyone',
    provider: 'Example University',
    short_description: 'Intro course',
    level: 'beginner',
    languages: ['en'],
    is_free: true,
    has_certificate: false,
    duration_hours: 8,
    thumbnail_url: 'https://example.com/image.png',
    source_url: 'https://example.com/course',
    status: 'verified',
    last_verified: '2026-08-26',
    platforms: { id: 1, external_id: 'plat-1', name: 'FutureLearn' },
    categories: { slug: 'ai', name: 'AI' }
  });
  assert.equal(course.id, 'fl-42');
  assert.equal(course.platform, 'FutureLearn');
  assert.equal(course.platformId, 'plat-1');
  assert.equal(course.category, 'ai');
  assert.equal(course.free, true);
  assert.equal(course.certificate, false);
  assert.deepEqual(course.language, ['en']);
  assert.equal(course.catalogOnly, true);
  assert.equal(course.sourceUrl, 'https://example.com/course');
});

test('Supabase runtime paginates verified rows and sends publishable key as apikey', async () => {
  const runtime = require(runtimePath);
  const calls = [];
  const pages = [
    [{id:1,title:'A',source_url:'https://x/a',status:'verified'},{id:2,title:'B',source_url:'https://x/b',status:'verified'}],
    [{id:3,title:'C',source_url:'https://x/c',status:'verified'}]
  ];
  const fetchFn = async (url, options) => {
    calls.push({url:String(url), options});
    const body = pages.shift() || [];
    return { ok:true, status:200, json:async()=>body };
  };
  const result = await runtime.loadAllVerified({
    projectUrl:'https://demo.supabase.co',
    publishableKey:'sb_publishable_test',
    pageSize:2,
    fetchFn
  });
  assert.equal(result.length, 3);
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /status=eq\.verified/);
  assert.match(calls[0].url, /limit=2/);
  assert.match(calls[0].url, /offset=0/);
  assert.match(calls[1].url, /offset=2/);
  assert.equal(calls[0].options.headers.apikey, 'sb_publishable_test');
  assert.equal(calls[0].options.headers.Authorization, undefined);
});

test('site pages load Supabase config/runtime before page scripts', () => {
  const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const platform = fs.readFileSync(path.join(ROOT, 'platform.html'), 'utf8');
  assert.match(index, /js\/supabase-config\.js[\s\S]*js\/supabase-runtime\.js[\s\S]*js\/app\.js/);
  assert.match(platform, /js\/supabase-config\.js[\s\S]*js\/supabase-runtime\.js[\s\S]*js\/platform-detail\.js/);
});

test('homepage and platform page prefer Supabase with JSON fallback', () => {
  const app = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
  const detail = fs.readFileSync(path.join(ROOT, 'js/platform-detail.js'), 'utf8');
  assert.match(app, /SupabaseRuntime\.loadAllVerified/);
  assert.match(app, /supabaseCatalogLoaded/);
  assert.match(detail, /SupabaseRuntime\.loadPlatformVerified/);
  assert.match(detail, /loadShard/);
});
