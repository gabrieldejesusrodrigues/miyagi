import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigManager } from '../../src/core/config.js';
import { mkdtempSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ConfigManager', () => {
  let tempDir: string;
  let configManager: ConfigManager;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'miyagi-test-'));
    configManager = new ConfigManager(tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('initializes default config when none exists', () => {
    const config = configManager.load();
    expect(config.defaultModel).toBeUndefined();
    expect(config.claudePath).toBeUndefined();
  });

  it('saves and loads config', () => {
    configManager.save({ defaultModel: 'opus', claudePath: '/usr/bin/claude' });
    const config = configManager.load();
    expect(config.defaultModel).toBe('opus');
    expect(config.claudePath).toBe('/usr/bin/claude');
  });

  it('creates miyagi directory structure on init', () => {
    configManager.ensureDirectories();
    const fs = require('fs');
    expect(fs.existsSync(join(tempDir, 'agents'))).toBe(true);
    expect(fs.existsSync(join(tempDir, 'templates'))).toBe(true);
    expect(fs.existsSync(join(tempDir, 'reports'))).toBe(true);
  });

  it('creates battles directory on ensureDirectories', () => {
    configManager.ensureDirectories();
    const fs = require('fs');
    expect(fs.existsSync(join(tempDir, 'battles'))).toBe(true);
    expect(configManager.battlesDir).toBe(join(tempDir, 'battles'));
  });
});
