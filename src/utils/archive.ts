import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import * as tar from 'tar';
import { ReadEntry } from 'tar';
import archiver from 'archiver';
import { validateArchiveEntry } from '../cli/middleware/security.js';

export async function exportAgent(agentDir: string, outputPath: string, format: 'tar.gz' | 'zip' = 'tar.gz'): Promise<void> {
  if (format === 'tar.gz') {
    await tar.create(
      {
        gzip: true,
        file: outputPath,
        cwd: join(agentDir, '..'),
      },
      [agentDir.split('/').pop()!],
    );
  } else {
    const output = createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(output);
    archive.directory(agentDir, agentDir.split('/').pop()!);
    await archive.finalize();
  }
}

export async function importAgent(sourcePath: string, targetDir: string): Promise<void> {
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
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
