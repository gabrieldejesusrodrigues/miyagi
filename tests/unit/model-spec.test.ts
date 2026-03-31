import { describe, it, expect } from 'vitest';
import { parseModelSpec, resolveModel } from '../../src/types/provider.js';
import type { ModelSpec, ProviderName } from '../../src/types/provider.js';
import type { AgentManifest } from '../../src/types/agent.js';
import type { MiyagiConfig } from '../../src/types/config.js';

describe('parseModelSpec', () => {
  it('parses claude/opus correctly', () => {
    const result = parseModelSpec('claude/opus');
    expect(result).toEqual({ provider: 'claude', model: 'opus' });
  });

  it('parses claude/sonnet correctly', () => {
    const result = parseModelSpec('claude/sonnet');
    expect(result).toEqual({ provider: 'claude', model: 'sonnet' });
  });

  it('parses gemini/gemini-2.5-pro correctly', () => {
    const result = parseModelSpec('gemini/gemini-2.5-pro');
    expect(result).toEqual({ provider: 'gemini', model: 'gemini-2.5-pro' });
  });

  it('parses codex/o4-mini correctly', () => {
    const result = parseModelSpec('codex/o4-mini');
    expect(result).toEqual({ provider: 'codex', model: 'o4-mini' });
  });

  it('returns claude/sonnet for undefined input', () => {
    const result = parseModelSpec(undefined);
    expect(result).toEqual({ provider: 'claude', model: 'sonnet' });
  });

  it('returns claude/sonnet for empty string', () => {
    const result = parseModelSpec('');
    expect(result).toEqual({ provider: 'claude', model: 'sonnet' });
  });

  it('defaults to claude provider when no slash present', () => {
    const result = parseModelSpec('opus');
    expect(result).toEqual({ provider: 'claude', model: 'opus' });
  });

  it('defaults to claude provider for haiku', () => {
    const result = parseModelSpec('haiku');
    expect(result).toEqual({ provider: 'claude', model: 'haiku' });
  });

  it('throws for unknown provider', () => {
    expect(() => parseModelSpec('invalid/model')).toThrow('Unknown provider');
  });

  it('throws for another unknown provider', () => {
    expect(() => parseModelSpec('openai/gpt-4')).toThrow('Unknown provider');
  });

  it('handles model names with multiple slashes', () => {
    // Only the first slash separates provider from model
    const result = parseModelSpec('gemini/gemini-2.5-pro/latest');
    expect(result.provider).toBe('gemini');
    expect(result.model).toBe('gemini-2.5-pro/latest');
  });
});

describe('resolveModel', () => {
  const makeManifest = (model?: string): AgentManifest => ({
    name: 'test-agent',
    version: '1.0.0',
    author: 'test',
    createdAt: '2026-01-01',
    model,
  });

  const makeConfig = (defaultModel?: string): MiyagiConfig => ({
    ...(defaultModel ? { defaultModel } : {}),
  });

  it('CLI flag takes highest priority', () => {
    const result = resolveModel(
      'gemini/gemini-2.5-pro',
      makeManifest('codex/o4-mini'),
      makeConfig('claude/opus'),
    );
    expect(result).toEqual({ provider: 'gemini', model: 'gemini-2.5-pro' });
  });

  it('manifest takes priority over global config', () => {
    const result = resolveModel(
      undefined,
      makeManifest('codex/o4-mini'),
      makeConfig('claude/opus'),
    );
    expect(result).toEqual({ provider: 'codex', model: 'o4-mini' });
  });

  it('global config takes priority over default', () => {
    const result = resolveModel(
      undefined,
      makeManifest(),
      makeConfig('gemini/gemini-2.5-pro'),
    );
    expect(result).toEqual({ provider: 'gemini', model: 'gemini-2.5-pro' });
  });

  it('falls back to claude/sonnet when nothing is set', () => {
    const result = resolveModel(undefined, makeManifest(), makeConfig());
    expect(result).toEqual({ provider: 'claude', model: 'sonnet' });
  });

  it('falls back to claude/sonnet with no arguments', () => {
    const result = resolveModel();
    expect(result).toEqual({ provider: 'claude', model: 'sonnet' });
  });

  it('skips manifest when model is undefined', () => {
    const result = resolveModel(
      undefined,
      makeManifest(undefined),
      makeConfig('codex/o4-mini'),
    );
    expect(result).toEqual({ provider: 'codex', model: 'o4-mini' });
  });

  it('skips manifest when model is empty string', () => {
    const result = resolveModel(
      undefined,
      makeManifest(''),
      makeConfig('codex/o4-mini'),
    );
    expect(result).toEqual({ provider: 'codex', model: 'o4-mini' });
  });
});
