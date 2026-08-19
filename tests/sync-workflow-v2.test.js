const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');

test('V2 sync writes raw and clean platform-named files and manifest file references',()=>{
  const script=read('scripts/sync-course-catalogs.mjs');
  assert.match(script,/catalogs['"`],?\s*['"`]raw|RAW_DIR/);
  assert.match(script,/catalogs['"`],?\s*['"`]clean|CLEAN_DIR/);
  assert.match(script,/platformFileName/);
  assert.match(script,/rawFile/);
  assert.match(script,/cleanFile/);
  assert.match(script,/rawCount/);
  assert.match(script,/cleanCount/);
});

test('platform page loads cleanFile from manifest instead of legacy plat-id shard',()=>{
  const script=read('js/platform-detail.js');
  assert.match(script,/catalogs\/manifest\.json/);
  assert.match(script,/cleanFile/);
  assert.doesNotMatch(script,/catalogs\/\$\{encodeURIComponent\(id\)\}\.json/);
});

test('workflow identifies V2 sync and commits generated catalogs',()=>{
  const yml=read('.github/workflows/sync-course-catalogs.yml');
  assert.match(yml,/Sync course catalogs V2/);
  assert.match(yml,/node scripts\/sync-course-catalogs\.mjs --all/);
  assert.match(yml,/git add catalogs\//);
});
