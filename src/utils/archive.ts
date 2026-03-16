import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import * as tar from 'tar';
import { ReadEntry } from 'tar';
import archiver from 'archiver';
import AdmZip from 'adm-zip';
import { validateArchiveEntry } from '../cli/middleware/security.js';

export async function exportAgent(agentDir: string, outputPath: string, format: 'tar.gz' | 'zip' = 'tar.gz'): Promise<void> {
  if (format === 'tar.gz') {
    await tar.create(
      {
        gzip: true,
        file: outputPath,
        cwd: join(agentDir, '..'),
      },
      [basename(agentDir)],
    );
  } else {
    const output = createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(output);
    archive.directory(agentDir, basename(agentDir));
    await archive.finalize();
  }
}

export async function importAgent(sourcePath: string, targetDir: string): Promise<void> {
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  if (sourcePath.endsWith('.zip')) {
    const zip = new AdmZip(sourcePath);
    const entries = zip.getEntries();
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const entryPath = entry.entryName;
      const result = validateArchiveEntry(entryPath, {
        isSymlink: false,
        size: entry.header.size,
      });
      if (!result.valid) {
        console.warn(`Skipping unsafe entry: ${entryPath} — ${result.errors?.join(', ')}`);
        continue;
      }
      if (result.warning) {
        console.warn(result.warning);
      }
      zip.extractEntryTo(entry, targetDir, true, true);
    }
    return;
  }

  if (!sourcePath.endsWith('.tar.gz') && !sourcePath.endsWith('.tgz')) {
    throw new Error('Unsupported archive format. Supported: .tar.gz, .zip');
  }

  await tar.extract({
    file: sourcePath,
    cwd: targetDir,
    filter: (path, entry) => {
      const readEntry = entry instanceof ReadEntry ? entry : undefined;
      const result = validateArchiveEntry(path, {
        isSymlink: readEntry?.type === 'SymbolicLink',
        size: readEntry?.size,
      });
      if (!result.valid) {
        console.warn(`Skipping unsafe entry: ${path} — ${result.errors?.join(', ')}`);
        return false;
      }
      return true;
    },
  });
}
