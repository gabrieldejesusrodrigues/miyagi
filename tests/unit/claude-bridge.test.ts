import { describe, it, expect, vi } from 'vitest';
import { ClaudeBridge } from '../../src/core/claude-bridge.js';

describe('ClaudeBridge', () => {
  it('builds correct command args for agent session', () => {
    const bridge = new ClaudeBridge();
    const args = bridge.buildSessionArgs({
      systemPrompt: '# Test Agent\nYou are a test agent.',
      dangerouslySkipPermissions: true,
    });

    expect(args).toContain('--append-system-prompt');
    expect(args).toContain('# Test Agent\nYou are a test agent.');
    expect(args).toContain('--dangerously-skip-permissions');
  });

  it('builds resume args correctly', () => {
    const bridge = new ClaudeBridge();
    const args = bridge.buildSessionArgs({
      systemPrompt: 'test',
      resume: true,
      sessionId: 'abc-123',
    });

    expect(args).toContain('--resume');
    expect(args).toContain('abc-123');
  });

  it('builds non-interactive args for battles', () => {
    const bridge = new ClaudeBridge();
    const args = bridge.buildBattleArgs({
      systemPrompt: 'You are agent A',
      prompt: 'Sell me this pen',
      dangerouslySkipPermissions: true,
    });

    expect(args).toContain('--print');
    expect(args).toContain('--dangerously-skip-permissions');
    // System prompt embedded in stdin via buildBattleStdin
    expect(args).not.toContain('--append-system-prompt');
  });

  it('finds claude binary path', () => {
    const bridge = new ClaudeBridge();
    const path = bridge.findClaudePath();
    expect(typeof path).toBe('string');
  });
});
