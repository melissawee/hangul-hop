#!/usr/bin/env node
/* Tiny static server for local development and tests.
 * Serves ./public and applies the "headers" rules from vercel.json, so you see
 * (and the tests check) the same Content-Security-Policy / cache headers Vercel will send.
 *
 *   npm start                 -> http://localhost:3000
 *   PORT=4000 npm start
 *   ROOT=/some/copy npm start (a folder containing public/ and vercel.json)
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.ROOT ? path.resolve(process.env.ROOT) : path.resolve(here, '..');
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT) || 3000;

const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const rules = (cfg.headers || []).map(h => ({
  re: new RegExp('^' + h.source.replace(/[.+?^${}|[\]\\]/g, '\\$&').replace(/\(\\\.\*\)|\(\.\*\)/g, '.*') + '$'),
  headers: h.headers
}));

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8'
};

http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400).end('Bad request'); return; }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = path.normalize(path.join(PUBLIC, pathname));
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403).end('Forbidden'); return; }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); return; }
    const headers = { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'public, max-age=0, must-revalidate' };
    for (const r of rules) if (r.re.test(pathname)) for (const h of r.headers) headers[h.key] = h.value;   // later rules win, like Vercel
    res.writeHead(200, headers);
    if (req.method === 'HEAD') res.end(); else fs.createReadStream(file).pipe(res);
  });
}).listen(PORT, () => console.log(`Hangul Hop running at http://localhost:${PORT}`));
