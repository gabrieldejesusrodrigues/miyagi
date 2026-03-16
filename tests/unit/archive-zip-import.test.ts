import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import AdmZip from 'adm-zip';
import { importAgent } from '../../src/utils/archive.js';

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'miyagi-zip-test-'));
}

function createZip(entries: Array<{ name: string; content: string }>): string {
  const zip = new AdmZip();
  for (const { name, content } of entries) {
    zip.addFile(name, Buffer.from(content));
  }
  const dir = makeTempDir();
  const zipPath = join(dir, 'test.zip');
  zip.writeZip(zipPath);
  return zipPath;
}

const temps: string[] = [];

afterEach(() => {
  for (const dir of temps.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function tempDir(): string {
  const d = makeTempDir();
  temps.push(d);
  return d;
}

describe('importAgent — zip support', () => {
  it('extracts valid files from a zip archive', async () => {
    const zipPath = createZip([
      { name: 'agent/manifest.json', content: '{"name":"test"}' },
      { name: 'agent/identity.md', content: '# Test Agent' },
    ]);
    temps.push(zipPath.replace('/test.zip', ''));

    const target = tempDir();
    await importAgent(zipPath, target);

    expect(existsSync(join(target, 'agent', 'manifest.json'))).toBe(true);
    expect(readFileSync(join(target, 'agent', 'identity.md'), 'utf8')).toBe('# Test Agent');
  });

  it('skips entries that fail validation and still extracts valid ones', async () => {
    // AdmZip normalises path traversal at addFile() time, so we test
    // with an oversized entry (which validateArchiveEntry does reject)
    // alongside a valid entry.
    const zip = new AdmZip();
    zip.addFile('agent/manifest.json', Buffer.from('{}'));
    zip.addFile('agent/big.md', Buffer.alloc(2_000_001, 'x'));

    const dir = tempDir();
    const zipPath = join(dir, 'mixed.zip');
    zip.writeZip(zipPath);

    const target = tempDir();
    await importAgent(zipPath, target);

    // valid entry extracted
    expect(existsSync(join(target, 'agent', 'manifest.json'))).toBe(true);
    // oversized entry skipped
    expect(existsSync(join(target, 'agent', 'big.md'))).toBe(false);
  });

  it('throws a clear error for unsupported archive formats', async () => {
    const dir = tempDir();
    const fakePath = join(dir, 'archive.rar');
    writeFileSync(fakePath, 'fake');

    await expect(importAgent(fakePath, dir)).rejects.toThrow(
      'Unsupported archive format. Supported: .tar.gz, .zip',
    );
  });


});
