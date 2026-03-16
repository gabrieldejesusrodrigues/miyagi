import { normalize, isAbsolute } from 'path';

interface EntryOptions {
  isSymlink?: boolean;
  size?: number;
}

interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warning?: string;
}

const MAX_FILE_SIZE = 1_000_000; // 1MB

const EXECUTABLE_EXTENSIONS = new Set(['.sh', '.bash', '.zsh', '.py', '.rb', '.pl']);

export function validateArchiveEntry(entryPath: string, options: EntryOptions = {}): ValidationResult {
  const normalized = normalize(entryPath);

  // Reject absolute paths
  if (isAbsolute(normalized)) {
    return { valid: false, errors: ['Absolute paths are not allowed'] };
  }

  // Reject path traversal
  if (normalized.startsWith('..') || normalized.includes('/..') || normalized.includes('\\..')) {
    return { valid: false, errors: ['Path traversal is not allowed'] };
  }

  // Reject symlinks
  if (options.isSymlink) {
    return { valid: false, errors: ['Symlinks are not allowed in agent packages'] };
  }

  // Reject oversized files
  if (options.size && options.size > MAX_FILE_SIZE) {
    return { valid: false, errors: [`File exceeds maximum size of ${MAX_FILE_SIZE} bytes`] };
  }

  // Warn about executable files
  const ext = entryPath.substring(entryPath.lastIndexOf('.'));
  if (EXECUTABLE_EXTENSIONS.has(ext)) {
    return { valid: true, warning: `Contains executable file: ${entryPath}` };
  }

  return { valid: true };
}

interface DirectoryCheckOptions {
  hasManifest: boolean;
  hasIdentity: boolean;
}

export function validateImportDirectory(options: DirectoryCheckOptions): ValidationResult {
  const errors: string[] = [];

  if (!options.hasManifest) {
    errors.push('Missing required manifest.json');
  }

  return { valid: errors.length === 0, errors };
}
