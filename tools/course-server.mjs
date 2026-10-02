// Serves the fixture courses on the isolated course origin used by the e2e suite.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const fixtures = fileURLToPath(new URL('../test/fixtures', import.meta.url));
const wrapper = fileURLToPath(new URL('../dist/wrapper', import.meta.url));
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

// Course files the host uploads for ZIP packages, keyed by request path.
const delivered = new Map();

createServer(async (request, response) => {
  const path = posix.normalize(decodeURIComponent(new URL(request.url, 'http://x').pathname));
  response.setHeader('Access-Control-Allow-Origin', hostOrigin);
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Methods': 'PUT, GET',
      'Access-Control-Allow-Headers': '*',
    });
    return response.end();
  }
  if (request.method === 'PUT' && path.startsWith('/delivery/')) {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    delivered.set(path, Buffer.concat(chunks));
    return response.writeHead(204).end();
  }
  if (path.startsWith('/delivery/')) {
    const body = delivered.get(path);
    if (!body) return response.writeHead(404).end();
    response.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream' });
    return response.end(body);
  }
  try {
    const body = path.startsWith('/wrapper/')
      ? await readFile(join(wrapper, path.slice('/wrapper/'.length)))
      : await readFile(join(fixtures, path));
    response.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
}).listen(port, '127.0.0.1');
