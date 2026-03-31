import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ConfigManager } from '../../src/core/config.js';
import { getConfigValue, setConfigValue, resetConfigValue } from '../../src/cli/commands/config.js';

describe('config command helpers', () => {
  let tempDir: string;
  let config: ConfigManager;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'miyagi-test-'));
    config = new ConfigManager(tempDir);
    config.ensureDirectories();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('getConfigValue', () => {
    it('returns undefined for missing key', () => {
      expect(getConfigValue(config, 'defaultModel')).toBeUndefined();
    });

    it('returns top-level value', () => {
      config.save({ defaultModel: 'claude/opus' });
      expect(getConfigValue(config, 'defaultModel')).toBe('claude/opus');
    });

    it('returns nested value with dot notation', () => {
      config.save({ judge: { model: 'claude/opus' } });
      expect(getConfigValue(config, 'judge.model')).toBe('claude/opus');
    });

    it('returns undefined for missing nested key', () => {
      config.save({});
      expect(getConfigValue(config, 'judge.model')).toBeUndefined();
    });
  });

  describe('setConfigValue', () => {
    it('sets top-level value', () => {
      setConfigValue(config, 'defaultModel', 'gemini/gemini-2.5-pro');
      const loaded = config.load();
      expect(loaded.defaultModel).toBe('gemini/gemini-2.5-pro');
    });

    it('sets nested value with dot notation', () => {
      setConfigValue(config, 'judge.model', 'claude/opus');
      const loaded = config.load();
      expect(loaded.judge?.model).toBe('claude/opus');
    });

    it('sets coach.model nested value', () => {
      setConfigValue(config, 'coach.model', 'claude/sonnet');
      const loaded = config.load();
      expect(loaded.coach?.model).toBe('claude/sonnet');
    });

    it('preserves existing config when setting new key', () => {
      config.save({ defaultModel: 'claude/opus' });
      setConfigValue(config, 'judge.model', 'claude/sonnet');
      const loaded = config.load();
      expect(loaded.defaultModel).toBe('claude/opus');
      expect(loaded.judge?.model).toBe('claude/sonnet');
    });

    it('validates model spec for model-related keys', () => {
      expect(() => setConfigValue(config, 'defaultModel', 'invalid/model')).toThrow('Unknown provider');
    });

    it('validates judge.model spec', () => {
      expect(() => setConfigValue(config, 'judge.model', 'bad/model')).toThrow('Unknown provider');
    });

    it('validates coach.model spec', () => {
      expect(() => setConfigValue(config, 'coach.model', 'wrong/model')).toThrow('Unknown provider');
    });

    it('accepts valid provider specs', () => {
      expect(() => setConfigValue(config, 'defaultModel', 'claude/opus')).not.toThrow();
      expect(() => setConfigValue(config, 'defaultModel', 'gemini/gemini-2.5-pro')).not.toThrow();
      expect(() => setConfigValue(config, 'defaultModel', 'codex/o4-mini')).not.toThrow();
    });

    it('accepts bare model names (defaults to claude)', () => {
      setConfigValue(config, 'defaultModel', 'opus');
      expect(config.load().defaultModel).toBe('opus');
    });
  });

  describe('resetConfigValue', () => {
    it('removes top-level key', () => {
      config.save({ defaultModel: 'claude/opus' });
      resetConfigValue(config, 'defaultModel');
      const loaded = config.load();
      expect(loaded.defaultModel).toBeUndefined();
    });

    it('removes nested key', () => {
      config.save({ judge: { model: 'claude/opus' } });
      resetConfigValue(config, 'judge.model');
      const loaded = config.load();
      expect(loaded.judge?.model).toBeUndefined();
    });

    it('does not throw for missing key', () => {
      expect(() => resetConfigValue(config, 'nonexistent')).not.toThrow();
    });
  });
});
