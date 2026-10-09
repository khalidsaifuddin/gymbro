import { createServer } from './serve-dist.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.env.GYMBRO_WEB_DIR ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const [host = '127.0.0.1', portText = '4121'] = (process.env.GYMBRO_FRONTEND_ADDR ?? '127.0.0.1:4121').split(':');
const server = createServer(root);
server.on('error', (error) => {
  process.stderr.write(`Gymbro web failed to listen: ${error.message}\n`);
  process.exitCode = 1;
});
server.listen(Number(portText), host, () => process.stdout.write(`Gymbro web listening on ${host}:${portText}\n`));
