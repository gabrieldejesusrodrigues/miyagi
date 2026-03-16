import { describe, it, expect } from 'vitest';
import { validateArchiveEntry, validateImportDirectory } from '../../src/cli/middleware/security.js';

describe('Archive security', () => {
  it('rejects path traversal attempts', () => {
    expect(validateArchiveEntry('../../../etc/passwd').valid).toBe(false);
  });

  it('rejects absolute paths', () => {
    expect(validateArchiveEntry('/etc/passwd').valid).toBe(false);
  });

  it('rejects symlinks in entries', () => {
    expect(validateArchiveEntry('identity.md', { isSymlink: true }).valid).toBe(false);
  });

  it('accepts valid markdown files', () => {
    expect(validateArchiveEntry('identity.md').valid).toBe(true);
  });

  it('accepts valid json files', () => {
    expect(validateArchiveEntry('manifest.json').valid).toBe(true);
  });

  it('warns but allows executable files', () => {
    const result = validateArchiveEntry('scripts/setup.sh');
    expect(result.valid).toBe(true);
    expect(result.warning).toContain('executable');
  });

  it('rejects files exceeding size limit', () => {
    expect(validateArchiveEntry('identity.md', { size: 2_000_000 }).valid).toBe(false);
  });
});

describe('Import directory validation', () => {
  it('rejects if manifest.json is missing', () => {
    const result = validateImportDirectory({ hasManifest: false, hasIdentity: true });
    expect(result.valid).toBe(false);
  });

  it('accepts valid directory structure', () => {
    const result = validateImportDirectory({ hasManifest: true, hasIdentity: true });
    expect(result.valid).toBe(true);
  });
});
