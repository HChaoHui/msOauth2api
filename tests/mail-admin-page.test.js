const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');
const htmlPath = path.join(rootDir, 'public', 'mail.html');
const scriptPath = path.join(rootDir, 'public', 'mail-admin-app.js');

test('mail admin page loads the new server-backed admin script', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');

  assert.match(html, /<script src="\/mail-import-utils\.js"><\/script>/);
  assert.match(html, /<script src="\/mail-admin-app\.js"><\/script>/);
  assert.doesNotMatch(html, /localStorage\.getItem\('emailData'\)/);
  assert.doesNotMatch(html, /localStorage\.setItem\('emailData'/);
});

test('mail admin script talks to server-backed account APIs and share actions', () => {
  assert.ok(fs.existsSync(scriptPath), 'expected public/mail-admin-app.js to exist');

  const script = fs.readFileSync(scriptPath, 'utf8');

  assert.match(script, /\/api\/accounts\/list/);
  assert.match(script, /\/api\/accounts\/import/);
  assert.match(script, /\/api\/accounts\/mail-list/);
  assert.match(script, /\/api\/accounts\/reset-share/);
  assert.match(script, /navigator\.clipboard\.writeText/);
  assert.match(script, /function copyShareLink\(/);
});
