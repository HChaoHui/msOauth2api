const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');
const htmlPath = path.join(rootDir, 'public', 'boobar.html');
const scriptPath = path.join(rootDir, 'public', 'boobar-app.js');

test('public share page loads the dedicated share app shell', () => {
  assert.ok(fs.existsSync(htmlPath), 'expected public/boobar.html to exist');

  const html = fs.readFileSync(htmlPath, 'utf8');

  assert.match(html, /id="share-status"/);
  assert.match(html, /id="mail-table"/);
  assert.match(html, /id="folder-inbox"/);
  assert.match(html, /id="folder-junk"/);
  assert.match(html, /<script src="\/boobar-app\.js"><\/script>/);
});

test('public share page script calls the share mail API', () => {
  assert.ok(fs.existsSync(scriptPath), 'expected public/boobar-app.js to exist');

  const script = fs.readFileSync(scriptPath, 'utf8');

  assert.match(script, /\/api\/share-mail-list/);
  assert.match(script, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(script, /function loadMailbox\(/);
});
