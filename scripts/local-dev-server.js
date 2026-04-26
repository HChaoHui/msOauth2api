const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { URL } = require('node:url');

const rootDir = process.cwd();
const publicDir = path.join(rootDir, 'public');
const apiDir = path.join(rootDir, 'api');
const host = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT || 3000);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

function applyCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function enhanceResponse(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };

  res.json = (payload) => {
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    res.end(JSON.stringify(payload));
  };

  res.send = (payload) => {
    if (Buffer.isBuffer(payload)) {
      res.end(payload);
      return;
    }

    if (typeof payload === 'object' && payload !== null) {
      res.json(payload);
      return;
    }

    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }
    res.end(String(payload));
  };

  return res;
}

async function readRequestBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  const contentType = req.headers['content-type'] || '';

  if (contentType.includes('application/json')) {
    return raw ? JSON.parse(raw) : {};
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(raw));
  }

  return { raw };
}

function safeJoin(baseDir, targetPath) {
  const normalized = path.normalize(path.join(baseDir, targetPath));

  if (!normalized.startsWith(baseDir)) {
    return null;
  }

  return normalized;
}

async function serveStatic(req, res, pathname) {
  const rewrittenPath = pathname === '/boobar' ? '/boobar.html' : pathname;
  const relativePath = rewrittenPath === '/' ? 'index.html' : rewrittenPath.replace(/^\/+/, '');
  const filePath = safeJoin(publicDir, relativePath);

  if (!filePath) {
    res.status(403).send('Forbidden');
    return true;
  }

  try {
    const stats = await fsp.stat(filePath);
    const finalPath = stats.isDirectory() ? path.join(filePath, 'index.html') : filePath;
    const ext = path.extname(finalPath).toLowerCase();
    const file = await fsp.readFile(finalPath);

    if (rewrittenPath.startsWith('/assets/')) {
      res.setHeader('Cache-Control', 'max-age=31536000, immutable');
    }

    if (rewrittenPath === '/mail.html') {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }

    res.status(200);
    res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
    res.end(file);
    return true;
  } catch (error) {
    if (pathname === '/') {
      res.status(404).send('Not Found');
      return true;
    }

    return false;
  }
}

async function runApiHandler(req, res, pathname, searchParams) {
  const relativePath = pathname.replace(/^\/api\//, '');
  const handlerPath = safeJoin(apiDir, `${relativePath}.js`);

  if (!handlerPath || !fs.existsSync(handlerPath)) {
    return false;
  }

  delete require.cache[require.resolve(handlerPath)];
  const handler = require(handlerPath);

  req.query = Object.fromEntries(searchParams.entries());
  req.body = req.method === 'GET' ? {} : await readRequestBody(req);

  applyCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }

  await handler(req, res);
  return true;
}

const server = http.createServer(async (req, res) => {
  enhanceResponse(res);

  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host || `127.0.0.1:${port}`}`);
    const handledApi = requestUrl.pathname.startsWith('/api/')
      ? await runApiHandler(req, res, requestUrl.pathname, requestUrl.searchParams)
      : false;

    if (handledApi) {
      return;
    }

    const handledStatic = await serveStatic(req, res, requestUrl.pathname);

    if (handledStatic) {
      return;
    }

    const notFoundPath = path.join(publicDir, '404.html');

    if (fs.existsSync(notFoundPath)) {
      res.status(404);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(await fsp.readFile(notFoundPath));
      return;
    }

    res.status(404).send('Not Found');
  } catch (error) {
    console.error(error);

    if (!res.headersSent) {
      res.status(500).json({
        error: error.message,
      });
      return;
    }

    res.end();
  }
});

server.listen(port, host, () => {
  console.log(`local dev server listening on http://${host}:${port}`);
});
