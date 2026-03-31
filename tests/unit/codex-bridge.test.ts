import { describe, it, expect } from 'vitest';
import { CodexBridge } from '../../src/core/providers/codex-bridge.js';

describe('CodexBridge', () => {
  it('has provider set to codex', () => {
    const bridge = new CodexBridge('echo');
    expect(bridge.provider).toBe('codex');
  });

  describe('buildSessionArgs', () => {
    it('includes --model flag', () => {
      const bridge = new CodexBridge('echo');
      const args = bridge.buildSessionArgs({ systemPrompt: 'test', model: 'o4-mini' });
      expect(args).toContain('--model');
      expect(args).toContain('o4-mini');
    });

    it('includes --yolo for dangerouslySkipPermissions', () => {
      const bridge = new CodexBridge('echo');
      const args = bridge.buildSessionArgs({ systemPrompt: 'test', dangerouslySkipPermissions: true });
      expect(args).toContain('--yolo');
    });

    it('includes -c with instructions for system prompt', () => {
      const bridge = new CodexBridge('echo');
      const args = bridge.buildSessionArgs({ systemPrompt: 'You are a dev agent' });
      expect(args).toContain('-c');
      const cIdx = args.indexOf('-c');
      expect(args[cIdx + 1]).toContain('instructions=');
      expect(args[cIdx + 1]).toContain('You are a dev agent');
    });

    it('includes extra args', () => {
      const bridge = new CodexBridge('echo');
      const args = bridge.buildSessionArgs({ systemPrompt: 'test', extraArgs: ['--search'] });
      expect(args).toContain('--search');
    });
  });

  describe('buildBattleArgs', () => {
    it('starts with exec subcommand', () => {
      const bridge = new CodexBridge('echo');
      const args = bridge.buildBattleArgs({ systemPrompt: 'sys', prompt: 'task' });
      expect(args[0]).toBe('exec');
    });

    it('includes --model flag', () => {
      const bridge = new CodexBridge('echo');
      const args = bridge.buildBattleArgs({ systemPrompt: 'sys', prompt: 'task', model: 'gpt-4.1' });
      expect(args).toContain('--model');
      expect(args).toContain('gpt-4.1');
    });

    it('includes --yolo for skip permissions', () => {
      const bridge = new CodexBridge('echo');
      const args = bridge.buildBattleArgs({ systemPrompt: 'sys', prompt: 'task', dangerouslySkipPermissions: true });
      expect(args).toContain('--yolo');
    });

    it('includes -c with instructions for system prompt', () => {
      const bridge = new CodexBridge('echo');
      const args = bridge.buildBattleArgs({ systemPrompt: 'be a coder', prompt: 'task' });
      expect(args).toContain('-c');
      const cIdx = args.indexOf('-c');
      expect(args[cIdx + 1]).toContain('instructions=');
      expect(args[cIdx + 1]).toContain('be a coder');
    });

    it('includes - for stdin reading', () => {
      const bridge = new CodexBridge('echo');
      const args = bridge.buildBattleArgs({ systemPrompt: 'sys', prompt: 'task' });
      expect(args[args.length - 1]).toBe('-');
    });
  });

  describe('buildBattleStdin', () => {
    it('returns the prompt for stdin', () => {
      const bridge = new CodexBridge('echo');
      const stdin = bridge.buildBattleStdin({ systemPrompt: 'sys', prompt: 'Do this task' });
      expect(stdin).toBe('Do this task');
    });
  });

  describe('setupSkills', () => {
    it('does not throw', async () => {
      const bridge = new CodexBridge('echo');
      await expect(bridge.setupSkills('test', '/nonexistent')).resolves.toBeUndefined();
    });
  });

  describe('cleanupSkills', () => {
    it('does not throw', async () => {
      const bridge = new CodexBridge('echo');
      await expect(bridge.cleanupSkills()).resolves.toBeUndefined();
    });
  });

  describe('runAndCapture', () => {
    it('resolves with stdout on success', async () => {
      const bridge = new CodexBridge('echo');
      const result = await bridge.runAndCapture(['hello codex']);
      expect(result.trim()).toBe('hello codex');
    });

    it('rejects on non-zero exit code', async () => {
      const bridge = new CodexBridge('false');
      await expect(bridge.runAndCapture([])).rejects.toThrow(/exited with code 1/);
    });

    it('rejects on timeout', async () => {
      const bridge = new CodexBridge('sleep');
      await expect(bridge.runAndCapture(['10'], 100)).rejects.toThrow(/timed out/);
    });
  });
});
