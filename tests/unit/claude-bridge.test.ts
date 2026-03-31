import { describe, it, expect } from 'vitest';
import { ClaudeBridge } from '../../src/core/providers/claude-bridge.js';

describe('ClaudeBridge', () => {
  it('has provider set to claude', () => {
    const bridge = new ClaudeBridge();
    expect(bridge.provider).toBe('claude');
  });

  it('finds claude binary path', () => {
    const bridge = new ClaudeBridge();
    const path = bridge.findBinaryPath();
    expect(typeof path).toBe('string');
    expect(path.length).toBeGreaterThan(0);
  });

  it('builds session args with system prompt', () => {
    const bridge = new ClaudeBridge();
    const args = bridge.buildSessionArgs({
      systemPrompt: '# Test Agent\nYou are a test agent.',
    });

    expect(args).toContain('--append-system-prompt');
    expect(args).toContain('# Test Agent\nYou are a test agent.');
  });

  it('builds session args with dangerouslySkipPermissions', () => {
    const bridge = new ClaudeBridge();
    const args = bridge.buildSessionArgs({
      systemPrompt: 'test',
      dangerouslySkipPermissions: true,
    });

    expect(args).toContain('--dangerously-skip-permissions');
  });

  it('builds session args with resume', () => {
    const bridge = new ClaudeBridge();
    const args = bridge.buildSessionArgs({
      systemPrompt: 'test',
      resumeSession: 'abc-123',
    });

    expect(args).toContain('--resume');
    expect(args).toContain('abc-123');
  });

  it('builds session args with model', () => {
    const bridge = new ClaudeBridge();
    const args = bridge.buildSessionArgs({
      systemPrompt: 'test',
      model: 'opus',
    });

    expect(args).toContain('--model');
    expect(args).toContain('opus');
  });

  it('builds session args with effort', () => {
    const bridge = new ClaudeBridge();
    const args = bridge.buildSessionArgs({
      systemPrompt: 'test',
      effort: 'high',
    });

    expect(args).toContain('--effort');
    expect(args).toContain('high');
  });

  it('builds session args with extra pass-through args', () => {
    const bridge = new ClaudeBridge();
    const args = bridge.buildSessionArgs({
      systemPrompt: 'test',
      extraArgs: ['--worktree', '--debug'],
    });

    expect(args).toContain('--worktree');
    expect(args).toContain('--debug');
  });

  it('builds battle args with --print flag', () => {
    const bridge = new ClaudeBridge();
    const args = bridge.buildBattleArgs({
      systemPrompt: 'You are agent A',
      prompt: 'Sell me this pen',
    });

    expect(args).toContain('--print');
    expect(args).not.toContain('--append-system-prompt');
  });

  it('builds battle args with dangerouslySkipPermissions', () => {
    const bridge = new ClaudeBridge();
    const args = bridge.buildBattleArgs({
      systemPrompt: 'You are agent A',
      prompt: 'Sell me this pen',
      dangerouslySkipPermissions: true,
    });

    expect(args).toContain('--dangerously-skip-permissions');
  });

  it('builds battle args with model and effort', () => {
    const bridge = new ClaudeBridge();
    const args = bridge.buildBattleArgs({
      systemPrompt: 'test',
      prompt: 'task',
      model: 'opus',
      effort: 'high',
    });

    expect(args).toContain('--model');
    expect(args).toContain('opus');
    expect(args).toContain('--effort');
    expect(args).toContain('high');
  });

  it('builds battle stdin with system prompt wrapped in tags', () => {
    const bridge = new ClaudeBridge();
    const stdin = bridge.buildBattleStdin({
      systemPrompt: 'You are an agent',
      prompt: 'Do the task',
    });

    expect(stdin).toContain('<SYSTEM_PROMPT>');
    expect(stdin).toContain('You are an agent');
    expect(stdin).toContain('</SYSTEM_PROMPT>');
    expect(stdin).toContain('Do the task');
  });

  it('accepts custom binary path', () => {
    const bridge = new ClaudeBridge('/usr/local/bin/claude');
    expect(bridge.findBinaryPath()).toBeTruthy();
  });
});
