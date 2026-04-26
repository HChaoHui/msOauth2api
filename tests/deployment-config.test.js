const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('local dev server binds to a container-friendly host by default', () => {
  const serverSource = fs.readFileSync(
    path.join(process.cwd(), 'scripts', 'local-dev-server.js'),
    'utf8',
  );

  assert.match(serverSource, /const host = process\.env\.HOST \|\| '0\.0\.0\.0';/);
  assert.match(serverSource, /server\.listen\(port, host,/);
});

test('docker deployment assets exist', () => {
  assert.equal(fs.existsSync(path.join(process.cwd(), 'Dockerfile')), true);
  assert.equal(fs.existsSync(path.join(process.cwd(), 'docker-compose.yml')), true);
  assert.equal(fs.existsSync(path.join(process.cwd(), '.dockerignore')), true);
});

test('README documents Docker, Redis, and Baota deployment', () => {
  const readme = fs.readFileSync(path.join(process.cwd(), 'README.md'), 'utf8');

  assert.match(readme, /Docker/i);
  assert.match(readme, /Redis/i);
  assert.match(readme, /宝塔|Baota/i);
});
