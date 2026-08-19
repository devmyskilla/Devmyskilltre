const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

test('catalog runtime exists and exposes normalization + manifest counts', () => {
  const runtimePath = path.join(ROOT, 'js/catalog-runtime.js');
  assert.ok(fs.existsSync(runtimePath), 'js/catalog-runtime.js must exist');
  const runtime = require(runtimePath);
  assert.equal(runtime.manifestTotal({platforms:{a:{cleanCount:12},b:{cleanCount:8}}}), 20);
  const c = runtime.normalizeCourse({id:'x',title:'Course X',sourceUrl:'https://example.com/x',language:'English'}, {name:'Example',category:'programming',thumbnail:'x.png'});
  assert.equal(c.catalogOnly, true);
  assert.deepEqual(c.language, ['English']);
  assert.deepEqual(c.skills, []);
  assert.equal(c.editorialScore, 0);
  assert.equal(c.category, 'programming');
});

test('homepage uses manifest metadata without preloading all platform catalogs', () => {
  const html = fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  const app = fs.readFileSync(path.join(ROOT,'js/app.js'),'utf8');
  assert.match(html, /js\/catalog-runtime\.js/);
  assert.match(app, /CatalogRuntime\.manifestTotal/);
  assert.match(app, /cleanCount/);
  assert.doesNotMatch(app, /CatalogRuntime\.loadAll/);
  assert.match(app, /loadCatalogManifest/);
  assert.match(app, /catalogOnly/);
});
