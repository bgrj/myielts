import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(process.env.SERVE_DIST ? 'dist' : 'web');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let rel = decodeURIComponent(url.pathname).replace(/^\/(?:myielts|ielts)(?=\/)/, '');
    if (/^\/feeds\/(reading|listening)\.json$/.test(rel)) {
      const kind = rel.includes('reading') ? 'reading' : 'listening';
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(await readFile(`content/${kind}.json`)); return;
    }
    if (/^\/recordings\/[a-z0-9-]+\.mp3$/.test(rel)) {
      res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=31536000, immutable' });
      res.end(await readFile(`content/audio/${rel.split('/').pop()}`)); return;
    }
    let file = path.resolve(root, '.' + rel);
    if (!file.startsWith(root + path.sep) && file !== root) throw new Error();
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(4173, '127.0.0.1', () => console.log('Local: http://127.0.0.1:4173/myielts/'));
