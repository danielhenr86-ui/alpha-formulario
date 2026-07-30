'use strict';

const { createReadStream, existsSync, statSync } = require('node:fs');
const { createServer } = require('node:http');
const { extname, join, normalize, resolve } = require('node:path');
const leadHandler = require('../api/lead');

const projectRoot = resolve(__dirname, '..');
const args = process.argv.slice(2);

function getArg(name, fallback) {
  const index = args.indexOf(name);
  return index === -1 || !args[index + 1] ? fallback : args[index + 1];
}

const host = getArg('--host', '127.0.0.1');
const port = Number(getArg('--port', '4173'));

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8'
};

function staticPath(pathname) {
  const requestedPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const safePath = normalize(requestedPath);
  const resolvedPath = resolve(projectRoot, safePath);

  if (!resolvedPath.startsWith(projectRoot + '/') || !existsSync(resolvedPath)) {
    return null;
  }

  if (!statSync(resolvedPath).isFile()) return null;
  return resolvedPath;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/api/lead') {
    await leadHandler(req, res);
    return;
  }

  const filePath = staticPath(decodeURIComponent(url.pathname));
  if (!filePath) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Not found');
    return;
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', contentTypes[extname(filePath).toLowerCase()] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');
  createReadStream(filePath).pipe(res);
});

server.on('error', (error) => {
  console.error(`Dev server failed: ${error.message}`);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`MetOn preview ready on http://${host}:${port}`);
});
