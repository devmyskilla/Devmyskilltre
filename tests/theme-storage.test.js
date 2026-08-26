const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.resolve(__dirname, '../js/app.js'), 'utf8');

test('homepage theme initialization uses the defined STORAGE.theme key', () => {
  assert.doesNotMatch(app, /localStorage\.getItem\(STORAGE_THEME\)/);
  assert.match(app, /localStorage\.getItem\(STORAGE\.theme\)/);
});
