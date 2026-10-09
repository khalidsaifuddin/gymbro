import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { createServer } from './serve-dist.mjs';

let root;
let server;
let origin;

before(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'gymbro-web-'));
  await mkdir(path.join(root, 'assets'));
  await writeFile(path.join(root, 'index.html'), '<main>Gymbro</main>');
  await writeFile(path.join(root, 'assets', 'app-a1b2c3d4e5.js'), 'console.log("ok")');
  await writeFile(path.join(root, 'assets', 'shape.svg'), '<svg/>');
  server = createServer(root);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await rm(root, { recursive: true, force: true });
});

test('serves app entry, health, and content types with safe caching', async () => {
  const html = await fetch(origin);
  assert.equal(html.status, 200);
  assert.match(html.headers.get('content-type'), /text\/html/);
  assert.equal(html.headers.get('cache-control'), 'no-cache');
  const health = await fetch(`${origin}/health`);
  assert.deepEqual(await health.json(), { status: 'ok' });
  const js = await fetch(`${origin}/assets/app-a1b2c3d4e5.js`);
  assert.match(js.headers.get('content-type'), /javascript/);
  assert.match(js.headers.get('cache-control'), /immutable/);
  const svg = await fetch(`${origin}/assets/shape.svg`);
  assert.match(svg.headers.get('content-type'), /image\/svg\+xml/);
});

test('uses SPA fallback only for navigation and rejects traversal or unsupported methods', async () => {
  const route = await fetch(`${origin}/workout/session`, { headers: { accept: 'text/html' } });
  assert.equal(route.status, 200);
  assert.match(await route.text(), /Gymbro/);
  assert.equal((await fetch(`${origin}/assets/missing.svg`)).status, 404);
  const encodedTraversal = await new Promise((resolve, reject) => {
    const request = http.request({ host: '127.0.0.1', port: server.address().port, path: '/%2e%2e/secrets', headers: { accept: 'text/html' } }, resolve);
    request.on('error', reject); request.end();
  });
  assert.equal(encodedTraversal.statusCode, 404);
  assert.equal((await fetch(origin, { method: 'POST' })).status, 405);
});

test('starts when PM2 launches the server through a current-release symlink', async () => {
  const alias = path.join(root, 'current-start-dist.mjs');
  await symlink(new URL('./start-dist.mjs', import.meta.url), alias);
  const probe = http.createServer();
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));

  const child = spawn(process.execPath, [alias], {
    env: { ...process.env, GYMBRO_FRONTEND_ADDR: `127.0.0.1:${port}`, GYMBRO_WEB_DIR: root },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    const healthy = await Promise.race([
      new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(false), 1500);
        child.stdout.on('data', (chunk) => {
          if (chunk.toString().includes('Gymbro web listening')) {
            clearTimeout(timeout);
            resolve(true);
          }
        });
        child.once('exit', () => { clearTimeout(timeout); resolve(false); });
      }),
    ]);
    assert.equal(healthy, true);
    assert.deepEqual(await fetch(`http://127.0.0.1:${port}/health`).then((response) => response.json()), { status: 'ok' });
  } finally {
    child.kill('SIGTERM');
    if (child.exitCode === null) await new Promise((resolve) => child.once('exit', resolve));
  }
});
