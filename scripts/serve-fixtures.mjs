// Serves tests/fixtures/ at http://localhost:5181 so the fixture pages run
// over http (VisioFix only runs on http/https pages, not file://).
// No dependencies. Run with: npm run fixtures
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../tests/fixtures/', import.meta.url));
const PORT = Number(process.env.PORT) || 5181;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  let path = normalize(join(ROOT, decodeURIComponent(url.pathname)));
  // Never serve anything outside tests/fixtures.
  if (!path.startsWith(ROOT.replace(/[\\/]$/, '') + sep) && path !== ROOT.replace(/[\\/]$/, '')) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  try {
    if (statSync(path).isDirectory()) path = join(path, 'index.html');
    statSync(path);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    return;
  }
  // Slow the "slow image" down so its lazy loading is visible.
  const delay = url.searchParams.has('slow') ? 1500 : 0;
  setTimeout(() => {
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    createReadStream(path).pipe(res);
  }, delay);
}).listen(PORT, '127.0.0.1', () => {
  console.log(`VisioFix fixtures: http://localhost:${PORT}/`);
});
