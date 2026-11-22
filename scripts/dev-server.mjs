#!/usr/bin/env node
// Zero-dependency local HTTP server for glassworks-cameras.
// Serves /viewer/, /src/, /assets/, and maps /vendor/three/ directly to node_modules/three/.
//   npm run dev                 (defaults to http://localhost:4173/viewer/)
//   node scripts/dev-server.mjs 8080
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

export const REPO_ROOT = resolve(new URL('..', import.meta.url).pathname);
const THREE_ROOT = join(REPO_ROOT, 'node_modules', 'three');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

const isFile = (p) => { try { return statSync(p).isFile(); } catch { return false; } };

export function resolveStaticPath(urlPath) {
  let rel;
  try { rel = normalize(decodeURIComponent(urlPath)); } catch { return null; }
  if (rel.includes('..')) return null;
  if (rel === '/' || rel === '/viewer' || rel === '/viewer/') {
    const idx = join(REPO_ROOT, 'viewer', 'index.html');
    return isFile(idx) ? idx : null;
  }
  if (rel.startsWith('/vendor/three/')) {
    const sub = rel.slice('/vendor/three/'.length);
    const candidate = join(THREE_ROOT, sub);
    return isFile(candidate) ? candidate : null;
  }
  const p = join(REPO_ROOT, rel.replace(/^\/+/, ''));
  for (const c of [p, `${p}.html`, join(p, 'index.html')]) {
    if (isFile(c)) return c;
  }
  return null;
}

export function createStaticServer() {
  if (!existsSync(join(THREE_ROOT, 'build', 'three.module.js'))) {
    throw new Error('node_modules/three not found — run `npm install` first.');
  }
  return createServer((req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    const file = resolveStaticPath(u.pathname);
    const head = { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' };
    if (!file) { res.writeHead(404, head).end('Not Found'); return; }
    const size = statSync(file).size;
    const type = TYPES[extname(file).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { ...head, 'Content-Type': type, 'Content-Length': size });
    if (req.method === 'HEAD') res.end();
    else createReadStream(file).pipe(res);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = +(process.argv[2] || process.env.PORT || 4173);
  const server = createStaticServer();
  server.listen({ port, host: '127.0.0.1', backlog: 512 }, () => {
    console.log(`glassworks-cameras viewer: http://127.0.0.1:${port}/viewer/`);
    console.log(`deterministic studio page: http://127.0.0.1:${port}/viewer/review.html?camera=503cx`);
  });
}
