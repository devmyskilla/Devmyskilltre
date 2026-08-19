import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync('/mnt/data/devmyskilla-global-catalog-fix/js/app.js','utf8');
const platform=fs.readFileSync('/mnt/data/devmyskilla-global-catalog-fix/js/platform-detail.js','utf8');

test('home page does not preload all 110 catalogs',()=>{
  assert.equal(app.includes('CatalogRuntime.loadAll('), false, 'home must not call loadAll');
  assert.equal(app.includes('loadFullCatalog();'), false, 'startup must not trigger full catalog loading');
  assert.match(app,/catalogs\/manifest\.json/,'home should load only manifest metadata');
});

test('platform page paginates large catalogs',()=>{
  assert.match(platform,/PLATFORM_PAGE_SIZE\s*=\s*60/);
  assert.match(platform,/slice\(0,visiblePlatformLimit\)/);
  assert.match(platform,/loadMorePlatformCourses/);
});
