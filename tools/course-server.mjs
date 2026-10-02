// Serves the fixture courses on the isolated course origin used by the e2e suite.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../test/fixtures', import.meta.url));
const port = Number(process.env.COURSE_PORT ?? 4300);
const hostOrigin = process.env.HOST_ORIGIN ?? 'http://localhost:4200';
const types = {
  '.xml': 'application/xml',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.zip': 'application/zip',
};

createServer(async (request, response) => {
  const path = normalize(decodeURIComponent(new URL(request.url, 'http://x').pathname));
  response.setHeader('Access-Control-Allow-Origin', hostOrigin);
  try {
    const body = await readFile(join(root, path));
    response.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
}).listen(port, '127.0.0.1');
