const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');
const htmlPath = path.join(rootDir, 'public', 'mail.html');
const scriptPath = path.join(rootDir, 'public', 'mail-admin-app.js');

test('mail admin page loads the local-storage admin script', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');

  assert.match(html, /<script src="\/mail-import-utils\.js\?v=cbb3198"><\/script>/);
  assert.match(html, /<script src="\/mail-admin-app\.js\?v=cbb3198"><\/script>/);
});

test('mail admin script stores imported accounts in local storage and does not call shared account APIs', () => {
  assert.ok(fs.existsSync(scriptPath), 'expected public/mail-admin-app.js to exist');

  const script = fs.readFileSync(scriptPath, 'utf8');

  assert.match(script, /ACCOUNT_STORAGE_KEY = 'mailAccounts'/);
  assert.match(script, /localStorage\.getItem\(ACCOUNT_STORAGE_KEY\)/);
  assert.match(script, /localStorage\.setItem\(ACCOUNT_STORAGE_KEY/);
  assert.match(script, /\/api\/mail-all/);
  assert.doesNotMatch(script, /\/api\/accounts\/list/);
  assert.doesNotMatch(script, /\/api\/accounts\/import/);
  assert.doesNotMatch(script, /\/api\/accounts\/mail-list/);
  assert.doesNotMatch(script, /\/api\/accounts\/reset-share/);
});
