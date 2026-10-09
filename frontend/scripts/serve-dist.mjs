import { createReadStream, realpathSync } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'], ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'], ['.jpeg', 'image/jpeg'], ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'], ['.png', 'image/png'], ['.svg', 'image/svg+xml'],
  ['.wasm', 'application/wasm'], ['.webp', 'image/webp'], ['.woff', 'font/woff'], ['.woff2', 'font/woff2'],
]);

function withinRoot(root, file) {
  return file === root || file.startsWith(`${root}${path.sep}`);
}

export function createServer(directory) {
  const requestedRoot = path.resolve(directory);
  return http.createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    let pathname;
    try {
      const rawPath = request.url.split(/[?#]/, 1)[0];
      const decodedPath = decodeURIComponent(rawPath);
      if (decodedPath.split('/').some((segment) => segment === '..' || segment === '.')) {
        response.writeHead(404).end();
        return;
      }
      pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    } catch {
      response.writeHead(400).end();
      return;
    }
    if (pathname === '/health') {
      response.writeHead(200, { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' });
      response.end(request.method === 'HEAD' ? undefined : '{"status":"ok"}');
      return;
    }

    let root;
    try { root = await realpath(requestedRoot); } catch { response.writeHead(503).end(); return; }
    let candidate = path.resolve(root, `.${pathname}`);
    if (!withinRoot(root, candidate)) {
      response.writeHead(404).end();
      return;
    }
    let info;
    try {
      info = await stat(candidate);
      if (info.isDirectory()) {
        candidate = path.join(candidate, 'index.html');
        info = await stat(candidate);
      }
    } catch {
      if (path.extname(pathname) || !request.headers.accept?.includes('text/html')) {
        response.writeHead(404).end();
        return;
      }
      candidate = path.join(root, 'index.html');
      try { info = await stat(candidate); } catch { response.writeHead(404).end(); return; }
    }

    let resolved;
    try { resolved = await realpath(candidate); } catch { response.writeHead(404).end(); return; }
    if (!withinRoot(root, resolved) || !info.isFile()) {
      response.writeHead(404).end();
      return;
    }
    const extension = path.extname(resolved).toLowerCase();
    const immutable = pathname.includes('/exercise-media/') || /[.-][a-f0-9]{8,}\./i.test(path.basename(pathname));
    response.writeHead(200, {
      'Cache-Control': extension === '.html' ? 'no-cache' : immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=300',
      'Content-Length': info.size,
      'Content-Type': mimeTypes.get(extension) ?? 'application/octet-stream',
    });
    if (request.method === 'HEAD') response.end();
    else createReadStream(resolved).pipe(response);
  });
}

if (process.argv[1] && realpathSync(path.resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url))) {
  const root = process.env.GYMBRO_WEB_DIR ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
  const [host = '127.0.0.1', portText = '4121'] = (process.env.GYMBRO_FRONTEND_ADDR ?? '127.0.0.1:4121').split(':');
  const server = createServer(root);
  server.listen(Number(portText), host, () => process.stdout.write(`Gymbro web listening on ${host}:${portText}\n`));
}
