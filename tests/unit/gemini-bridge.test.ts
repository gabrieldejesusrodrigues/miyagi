import { describe, it, expect } from 'vitest';
import { GeminiBridge } from '../../src/core/providers/gemini-bridge.js';

describe('GeminiBridge', () => {
  it('has provider set to gemini', () => {
    const bridge = new GeminiBridge('echo');
    expect(bridge.provider).toBe('gemini');
  });

  it('finds gemini binary path', () => {
    const bridge = new GeminiBridge();
    const path = bridge.findBinaryPath();
    expect(typeof path).toBe('string');
    expect(path.length).toBeGreaterThan(0);
  });

  describe('buildSessionArgs', () => {
    it('includes --model flag', () => {
      const bridge = new GeminiBridge('echo');
      const args = bridge.buildSessionArgs({ systemPrompt: 'test', model: 'gemini-2.5-pro' });
      expect(args).toContain('--model');
      expect(args).toContain('gemini-2.5-pro');
    });

    it('includes --yolo for dangerouslySkipPermissions', () => {
      const bridge = new GeminiBridge('echo');
      const args = bridge.buildSessionArgs({ systemPrompt: 'test', dangerouslySkipPermissions: true });
      expect(args).toContain('--yolo');
    });

    it('includes --prompt-interactive with system prompt', () => {
      const bridge = new GeminiBridge('echo');
      const args = bridge.buildSessionArgs({ systemPrompt: 'You are a sales agent' });
      expect(args).toContain('--prompt-interactive');
      const promptIdx = args.indexOf('--prompt-interactive');
      expect(args[promptIdx + 1]).toContain('You are a sales agent');
    });

    it('includes --resume for session resume', () => {
      const bridge = new GeminiBridge('echo');
      const args = bridge.buildSessionArgs({ systemPrompt: 'test', resumeSession: 'latest' });
      expect(args).toContain('--resume');
      expect(args).toContain('latest');
    });

    it('includes extra args', () => {
      const bridge = new GeminiBridge('echo');
      const args = bridge.buildSessionArgs({ systemPrompt: 'test', extraArgs: ['--sandbox'] });
      expect(args).toContain('--sandbox');
    });
  });

  describe('buildBattleArgs', () => {
    it('includes -p for non-interactive mode', () => {
      const bridge = new GeminiBridge('echo');
      const args = bridge.buildBattleArgs({ systemPrompt: 'sys', prompt: 'task' });
      expect(args).toContain('-p');
    });

    it('includes --model flag', () => {
      const bridge = new GeminiBridge('echo');
      const args = bridge.buildBattleArgs({ systemPrompt: 'sys', prompt: 'task', model: 'gemini-2.5-flash' });
      expect(args).toContain('--model');
      expect(args).toContain('gemini-2.5-flash');
    });

    it('includes --yolo for skip permissions', () => {
      const bridge = new GeminiBridge('echo');
      const args = bridge.buildBattleArgs({ systemPrompt: 'sys', prompt: 'task', dangerouslySkipPermissions: true });
      expect(args).toContain('--yolo');
    });

    it('does not include system prompt in args', () => {
      const bridge = new GeminiBridge('echo');
      const args = bridge.buildBattleArgs({ systemPrompt: 'secret system', prompt: 'task' });
      expect(args).not.toContain('secret system');
    });
  });

  describe('buildBattleStdin', () => {
    it('combines system prompt and user prompt', () => {
      const bridge = new GeminiBridge('echo');
      const stdin = bridge.buildBattleStdin({ systemPrompt: 'You are an agent', prompt: 'Do the task' });
      expect(stdin).toContain('You are an agent');
      expect(stdin).toContain('Do the task');
    });

    it('wraps system prompt in SYSTEM_INSTRUCTIONS tags', () => {
      const bridge = new GeminiBridge('echo');
      const stdin = bridge.buildBattleStdin({ systemPrompt: 'instructions', prompt: 'task' });
      expect(stdin).toContain('<SYSTEM_INSTRUCTIONS>');
      expect(stdin).toContain('</SYSTEM_INSTRUCTIONS>');
    });

    it('handles empty system prompt', () => {
      const bridge = new GeminiBridge('echo');
      const stdin = bridge.buildBattleStdin({ systemPrompt: '', prompt: 'task' });
      expect(stdin).toContain('task');
    });
  });

  describe('runAndCapture', () => {
    it('resolves with stdout on success', async () => {
      const bridge = new GeminiBridge('echo');
      const result = await bridge.runAndCapture(['hello gemini']);
      expect(result.trim()).toBe('hello gemini');
    });

    it('rejects on non-zero exit code', async () => {
      const bridge = new GeminiBridge('false');
      await expect(bridge.runAndCapture([])).rejects.toThrow(/exited with code 1/);
    });

    it('rejects on timeout', async () => {
      const bridge = new GeminiBridge('sleep');
      await expect(bridge.runAndCapture(['10'], 100)).rejects.toThrow(/timed out/);
    });

    it('rejects on spawn error for missing command', async () => {
      const bridge = new GeminiBridge('nonexistent-gemini-xyz');
      await expect(bridge.runAndCapture([])).rejects.toThrow();
    });
  });
});
