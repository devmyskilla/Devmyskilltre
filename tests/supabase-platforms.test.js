const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const runtime = require(path.join(ROOT, 'js/supabase-runtime.js'));

test('Supabase runtime loads active platform ids from the database', async () => {
  const calls = [];
  const fetchFn = async (url, options) => {
    calls.push({url:String(url), options});
    return {ok:true,status:200,json:async()=>[
      {id:1,external_id:'plat-1',name:'FutureLearn',status:'active'},
      {id:2,external_id:'plat-2',name:'Agora',status:'active'}
    ]};
  };
  assert.equal(typeof runtime.loadActivePlatforms, 'function');
  const rows = await runtime.loadActivePlatforms({
    projectUrl:'https://demo.supabase.co',
    publishableKey:'sb_publishable_test',
    fetchFn
  });
  assert.deepEqual(rows.map(x=>x.external_id), ['plat-1','plat-2']);
  assert.match(calls[0].url, /\/rest\/v1\/platforms/);
  assert.match(calls[0].url, /status=eq\.active/);
});

test('homepage filters its local platform metadata using active Supabase platforms', () => {
  const app = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
  assert.match(app, /SupabaseRuntime\.loadActivePlatforms/);
  assert.match(app, /activePlatformIds/);
  assert.match(app, /PLATFORMS_DATA\s*=\s*PLATFORMS_DATA\.filter/);
});
