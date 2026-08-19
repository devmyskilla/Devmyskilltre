import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT=path.resolve('.');
function loadPlatforms(){
  const code=fs.readFileSync(path.join(ROOT,'js/platforms.js'),'utf8');
  const ctx={}; vm.createContext(ctx); vm.runInContext(code,ctx); return ctx.PLATFORMS_DATA;
}

test('static snapshot manifest maps all 110 platforms to local catalog descriptors',()=>{
  const platforms=loadPlatforms();
  assert.equal(platforms.length,110);
  const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'catalogs/manifest-static.json'),'utf8'));
  assert.equal(manifest.mode,'static-snapshot');
  assert.equal(manifest.platformCount,110);
  for(const p of platforms){
    const meta=manifest.platforms[p.id];
    assert.ok(meta,`missing manifest entry ${p.id}`);
    assert.ok(meta.catalogFile?.startsWith('catalogs/'));
    const abs=path.join(ROOT,meta.catalogFile);
    assert.ok(fs.existsSync(abs),`missing descriptor ${meta.catalogFile}`);
    const d=JSON.parse(fs.readFileSync(abs,'utf8'));
    assert.equal(d.platformId,p.id);
    assert.equal(d.snapshotCommit,'b473ffad15c105b55d5b0b6378bc6a90deb2fa08');
    assert.equal(Array.isArray(d.snapshotUrls),true);
    assert.equal(d.snapshotUrls.length,2);
  }
});

test('runtime prefers local cleanFile course data and falls back to legacy platform shard',()=>{
  const js=fs.readFileSync(path.join(ROOT,'js/platform-detail.js'),'utf8');
  assert.match(js,/meta\?\.cleanFile/);
  assert.match(js,/meta\?\.catalogFile/);
  assert.match(js,/catalogs\/\$\{id\}\.json/);
  assert.match(js,/PLATFORM_PAGE_SIZE=60/);
  assert.match(js,/slice\(0,visiblePlatformLimit\)/);
});

test('static cleaner recovers a useful title from generic catalog CTA text',()=>{
  const code=fs.readFileSync(path.join(ROOT,'js/static-catalog.js'),'utf8');
  const ctx={window:{},URL,decodeURIComponent}; vm.createContext(ctx); vm.runInContext(code,ctx);
  const platform={id:'plat-1',name:'FutureLearn',link:'https://www.futurelearn.com/courses'};
  const rows=[{title:'Find out more',sourceUrl:'https://www.futurelearn.com/courses/generative-ai-for-developers'}];
  const clean=ctx.window.StaticCatalog.clean(rows,platform);
  assert.equal(clean.length,1);
  assert.equal(clean[0].title,'Generative Ai For Developers');
});
