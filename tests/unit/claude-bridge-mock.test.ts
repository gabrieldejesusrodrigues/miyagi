import { describe, it, expect } from 'vitest';
import { ClaudeBridge } from '../../src/core/claude-bridge.js';

describe('ClaudeBridge', () => {
  describe('buildSessionArgs', () => {
    it('should include system prompt', () => {
      const bridge = new ClaudeBridge('echo');
      const args = bridge.buildSessionArgs({ systemPrompt: 'test prompt' });
      expect(args).toContain('--append-system-prompt');
      expect(args).toContain('test prompt');
    });

    it('should add dangerouslySkipPermissions flag', () => {
      const bridge = new ClaudeBridge('echo');
      const args = bridge.buildSessionArgs({
        systemPrompt: 'prompt',
        dangerouslySkipPermissions: true,
      });
      expect(args).toContain('--dangerously-skip-permissions');
    });

    it('should not add dangerouslySkipPermissions when false', () => {
      const bridge = new ClaudeBridge('echo');
      const args = bridge.buildSessionArgs({
        systemPrompt: 'prompt',
        dangerouslySkipPermissions: false,
      });
      expect(args).not.toContain('--dangerously-skip-permissions');
    });

    it('should add resume with session ID', () => {
      const bridge = new ClaudeBridge('echo');
      const args = bridge.buildSessionArgs({
        systemPrompt: 'prompt',
        resume: true,
        sessionId: 'abc-123',
      });
      expect(args).toContain('--resume');
      expect(args).toContain('abc-123');
    });

    it('should add resume without session ID', () => {
      const bridge = new ClaudeBridge('echo');
      const args = bridge.buildSessionArgs({
        systemPrompt: 'prompt',
        resume: true,
      });
      expect(args).toContain('--resume');
      expect(args).not.toContain('abc-123');
    });

    it('should not add resume when false', () => {
      const bridge = new ClaudeBridge('echo');
      const args = bridge.buildSessionArgs({ systemPrompt: 'prompt', resume: false });
      expect(args).not.toContain('--resume');
    });

    it('should add model flag', () => {
      const bridge = new ClaudeBridge('echo');
      const args = bridge.buildSessionArgs({ systemPrompt: 'prompt', model: 'claude-3-5-sonnet' });
      expect(args).toContain('--model');
      expect(args).toContain('claude-3-5-sonnet');
    });

    it('should not add model flag when omitted', () => {
      const bridge = new ClaudeBridge('echo');
      const args = bridge.buildSessionArgs({ systemPrompt: 'prompt' });
      expect(args).not.toContain('--model');
    });
  });

  describe('buildBattleArgs', () => {
    it('should include --print flag', () => {
      const bridge = new ClaudeBridge('echo');
      const args = bridge.buildBattleArgs({ systemPrompt: 'sys', prompt: 'user' });
      expect(args[0]).toBe('--print');
    });

    it('should include system prompt (prompt passed via stdin)', () => {
      const bridge = new ClaudeBridge('echo');
      const args = bridge.buildBattleArgs({ systemPrompt: 'sys prompt', prompt: 'user prompt' });
      expect(args).toContain('--append-system-prompt');
      expect(args).toContain('sys prompt');
      // prompt is passed via stdin in runAndCapture, not in args
      expect(args).not.toContain('user prompt');
    });

    it('should add dangerouslySkipPermissions flag', () => {
      const bridge = new ClaudeBridge('echo');
      const args = bridge.buildBattleArgs({
        systemPrompt: 'sys',
        prompt: 'user',
        dangerouslySkipPermissions: true,
      });
      expect(args).toContain('--dangerously-skip-permissions');
    });

    it('should add model flag', () => {
      const bridge = new ClaudeBridge('echo');
      const args = bridge.buildBattleArgs({
        systemPrompt: 'sys',
        prompt: 'user',
        model: 'claude-3-haiku',
      });
      expect(args).toContain('--model');
      expect(args).toContain('claude-3-haiku');
    });

    it('should not add model flag when omitted', () => {
      const bridge = new ClaudeBridge('echo');
      const args = bridge.buildBattleArgs({ systemPrompt: 'sys', prompt: 'user' });
      expect(args).not.toContain('--model');
    });
  });

  describe('runAndCapture', () => {
    it('should resolve with stdout on success', async () => {
      const bridge = new ClaudeBridge('echo');
      const result = await bridge.runAndCapture(['hello world']);
      expect(result.trim()).toBe('hello world');
    });

    it('should reject on non-zero exit code', async () => {
      const bridge = new ClaudeBridge('false');
      await expect(bridge.runAndCapture([])).rejects.toThrow(/exited with code 1/);
    });

    it('should reject on timeout', async () => {
      const bridge = new ClaudeBridge('sleep');
      await expect(bridge.runAndCapture(['10'], 100)).rejects.toThrow(/timed out/);
    });

    it('should reject on spawn error for missing command', async () => {
      const bridge = new ClaudeBridge('nonexistent-command-xyz-12345');
      await expect(bridge.runAndCapture([])).rejects.toThrow();
    });
  });
});
