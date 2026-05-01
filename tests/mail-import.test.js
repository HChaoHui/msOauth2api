const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');
const htmlPath = path.join(rootDir, 'public', 'mail.html');
const utilsPath = path.join(rootDir, 'public', 'mail-import-utils.js');

function loadMailImportUtils() {
  assert.ok(
    fs.existsSync(utilsPath),
    'expected public/mail-import-utils.js to exist for shared import parsing'
  );

  delete require.cache[require.resolve(utilsPath)];
  return require(utilsPath);
}

test('mail page uses consistent Chinese copy for file and paste import', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');

  assert.match(html, /id="delimiter"[^>]*value="----"/);
  assert.match(html, /id="paste-input"/);
  assert.match(html, /onclick="importEmailsFromText\(\)"/);
  assert.match(html, />点击或拖拽 TXT 文件到这里导入</);
  assert.match(html, /placeholder="选填：验证密码，未设置可留空"/);
  assert.match(html, /placeholder="请输入分隔符，如 ----"/);
  assert.match(html, />文件导入</);
  assert.match(html, />粘贴导入</);
  assert.match(html, />支持粘贴格式：email----password----clientId----refreshToken，每行一条。</);
  assert.match(html, /placeholder="请粘贴邮箱数据，每行一条&#10;示例：&#10;email----password----clientId----refreshToken/);
  assert.match(
    html,
    /email----password----clientId----refreshToken/
  );
});

test('parseEmailText parses pasted multiline rows with the provided delimiter', () => {
  const { parseEmailText } = loadMailImportUtils();

  const rows = [
    'vvqhixlkpjdxo@outlook.com----exbprezog38292----9e5f94bc-e8a4-4e73-b8be-63364c29d753----token-1',
    'demo@example.com----pass-2----client-2----token-2',
  ].join('\n');

  assert.deepEqual(parseEmailText(rows, '----'), [
    {
      email: 'vvqhixlkpjdxo@outlook.com',
      password: 'exbprezog38292',
      clientId: '9e5f94bc-e8a4-4e73-b8be-63364c29d753',
      refreshToken: 'token-1',
    },
    {
      email: 'demo@example.com',
      password: 'pass-2',
      clientId: 'client-2',
      refreshToken: 'token-2',
    },
  ]);
});

test('parseEmailText trims CRLF lines and skips blank or incomplete rows', () => {
  const { parseEmailText } = loadMailImportUtils();

  const rows = [
    'alpha@example.com----pass-a----client-a----token-a\r',
    '',
    'missing-fields----pass-b',
    'beta@example.com----pass-b----client-b----token-b\r',
  ].join('\n');

  assert.deepEqual(parseEmailText(rows, '----'), [
    {
      email: 'alpha@example.com',
      password: 'pass-a',
      clientId: 'client-a',
      refreshToken: 'token-a',
    },
    {
      email: 'beta@example.com',
      password: 'pass-b',
      clientId: 'client-b',
      refreshToken: 'token-b',
    },
  ]);
});
