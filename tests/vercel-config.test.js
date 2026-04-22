const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const vercelConfigPath = path.join(__dirname, '..', 'vercel.json');

test('vercel config rewrites /boobar to the public share page', () => {
  const config = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));

  assert.ok(Array.isArray(config.rewrites), 'expected rewrites array to exist');
  assert.ok(
    config.rewrites.some(
      (rewrite) => rewrite.source === '/boobar' && rewrite.destination === '/boobar.html'
    ),
    'expected /boobar rewrite to /boobar.html'
  );
});
