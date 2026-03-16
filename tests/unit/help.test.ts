import { describe, it, expect } from 'vitest';
import { formatTerminalHelp, formatInSessionHelp } from '../../src/cli/commands/miyagi-help.js';

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
});

describe('/miyagi:help (in-session)', () => {
  it('lists all miyagi in-session commands', () => {
    const output = formatInSessionHelp('sales-agent', [
      'discovery', 'objection-handling', 'closing-techniques',
    ]);
    expect(output).toContain('/miyagi:help');
    expect(output).toContain('/miyagi:skills');
    expect(output).toContain('/miyagi:battle');
    expect(output).toContain('/miyagi:train');
    expect(output).toContain('/miyagi:stats');
    expect(output).toContain('/miyagi:switch');
    expect(output).toContain('/miyagi:context');
    expect(output).toContain('/miyagi:identity');
  });

  it('shows active agent name', () => {
    const output = formatInSessionHelp('sales-agent', []);
    expect(output).toContain('sales-agent');
  });

  it('lists agent skills', () => {
    const output = formatInSessionHelp('dev-agent', ['tdd', 'debugging']);
    expect(output).toContain('/tdd');
    expect(output).toContain('/debugging');
  });

  it('notes that Claude Code /help still works', () => {
    const output = formatInSessionHelp('test', []);
    expect(output).toContain('/help');
    expect(output).toContain('Claude Code');
  });
});
