import { describe, it, expect } from 'vitest';
import { formatTerminalHelp } from '../../src/cli/commands/miyagi-help.js';

describe('miyagi --help (terminal)', () => {
  it('shows miyagi commands', () => {
    const output = formatTerminalHelp();
    expect(output).toContain('Miyagi Commands');
    expect(output).toContain('create');
    expect(output).toContain('use');
    expect(output).toContain('battle');
  });

  it('shows Claude Code pass-through flags', () => {
    const output = formatTerminalHelp();
    expect(output).toContain('Claude Code Options');
    expect(output).toContain('--model');
    expect(output).toContain('--resume');
    expect(output).toContain('--dangerously-skip-permissions');
    expect(output).toContain('--effort');
    expect(output).toContain('--worktree');
  });

  it('separates miyagi and claude sections clearly', () => {
    const output = formatTerminalHelp();
    const miyagiIdx = output.indexOf('Miyagi Commands');
    const claudeIdx = output.indexOf('Claude Code Options');
    expect(miyagiIdx).toBeLessThan(claudeIdx);
  });

  it('does not reference in-session miyagi commands', () => {
    const output = formatTerminalHelp();
    expect(output).not.toContain('/miyagi:');
  });
});
