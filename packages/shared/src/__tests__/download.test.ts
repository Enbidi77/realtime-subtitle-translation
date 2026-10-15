import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { downloadFile } from '../network/download.js';

describe('Shared Network Utilities', () => {
  let server: http.Server;
  let serverPort: number;
  const tempDir = path.join(os.tmpdir(), `echolingo_shared_test_${Date.now()}`);

  beforeAll(async () => {
    await fsp.mkdir(tempDir, { recursive: true });

    server = http.createServer((req, res) => {
      if (req.url === '/file.txt') {
        const payload = 'Hello from EchoLingo downloadFile test!';
        res.writeHead(200, {
          'Content-Type': 'text/plain',
          'Content-Length': Buffer.byteLength(payload).toString(),
        });
        res.end(payload);
      } else if (req.url === '/redirect') {
        res.writeHead(302, { Location: '/file.txt' });
        res.end();
      } else if (req.url === '/not-found') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
      } else {
        res.writeHead(400);
        res.end();
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr !== null) {
          serverPort = addr.port;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('downloads a file directly and reports progress', async () => {
    const targetFile = path.join(tempDir, 'direct.txt');
    const progresses: number[] = [];

    await downloadFile(
      `http://127.0.0.1:${serverPort}/file.txt`,
      targetFile,
      (p) => progresses.push(p)
    );

    expect(fs.existsSync(targetFile)).toBe(true);
    const content = await fsp.readFile(targetFile, 'utf8');
    expect(content).toBe('Hello from EchoLingo downloadFile test!');
    expect(progresses.length).toBeGreaterThan(0);
    expect(progresses[progresses.length - 1]).toBe(100);
  });

  it('follows HTTP redirects seamlessly', async () => {
    const targetFile = path.join(tempDir, 'redirected.txt');

    await downloadFile(`http://127.0.0.1:${serverPort}/redirect`, targetFile);

    expect(fs.existsSync(targetFile)).toBe(true);
    const content = await fsp.readFile(targetFile, 'utf8');
    expect(content).toBe('Hello from EchoLingo downloadFile test!');
  });

  it('rejects on HTTP error status like 404', async () => {
    const targetFile = path.join(tempDir, 'missing.txt');

    await expect(
      downloadFile(`http://127.0.0.1:${serverPort}/not-found`, targetFile)
    ).rejects.toThrow('HTTP 404');

    expect(fs.existsSync(targetFile)).toBe(false);
  });
});

