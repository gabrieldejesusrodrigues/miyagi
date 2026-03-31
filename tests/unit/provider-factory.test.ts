import { describe, it, expect } from 'vitest';
import { createBridge } from '../../src/core/providers/factory.js';
import { ClaudeBridge } from '../../src/core/providers/claude-bridge.js';
import { GeminiBridge } from '../../src/core/providers/gemini-bridge.js';
import { CodexBridge } from '../../src/core/providers/codex-bridge.js';

describe('createBridge', () => {
  it('returns ClaudeBridge for claude provider', () => {
    const bridge = createBridge({ provider: 'claude', model: 'opus' });
    expect(bridge).toBeInstanceOf(ClaudeBridge);
    expect(bridge.provider).toBe('claude');
  });

  it('returns GeminiBridge for gemini provider', () => {
    const bridge = createBridge({ provider: 'gemini', model: 'gemini-2.5-pro' });
    expect(bridge).toBeInstanceOf(GeminiBridge);
    expect(bridge.provider).toBe('gemini');
  });

  it('returns CodexBridge for codex provider', () => {
    const bridge = createBridge({ provider: 'codex', model: 'o4-mini' });
    expect(bridge).toBeInstanceOf(CodexBridge);
    expect(bridge.provider).toBe('codex');
  });

  it('defaults to ClaudeBridge when no spec provided', () => {
    const bridge = createBridge();
    expect(bridge).toBeInstanceOf(ClaudeBridge);
    expect(bridge.provider).toBe('claude');
  });

  it('defaults to ClaudeBridge when spec has no provider', () => {
    const bridge = createBridge({ provider: 'claude', model: 'sonnet' });
    expect(bridge).toBeInstanceOf(ClaudeBridge);
  });
});
