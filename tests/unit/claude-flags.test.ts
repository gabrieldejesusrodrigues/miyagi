import { describe, it, expect } from 'vitest';
import { parseArgs, CLAUDE_FLAGS } from '../../src/core/claude-flags.js';

describe('Claude Code flag pass-through', () => {
  it('recognizes all major claude flags', () => {
    expect(CLAUDE_FLAGS).toContain('--model');
    expect(CLAUDE_FLAGS).toContain('--print');
    expect(CLAUDE_FLAGS).toContain('--resume');
    expect(CLAUDE_FLAGS).toContain('--continue');
    expect(CLAUDE_FLAGS).toContain('--dangerously-skip-permissions');
    expect(CLAUDE_FLAGS).toContain('--append-system-prompt');
    expect(CLAUDE_FLAGS).toContain('--permission-mode');
    expect(CLAUDE_FLAGS).toContain('--effort');
    expect(CLAUDE_FLAGS).toContain('--worktree');
    expect(CLAUDE_FLAGS).toContain('--mcp-config');
    expect(CLAUDE_FLAGS).toContain('--allowedTools');
    expect(CLAUDE_FLAGS).toContain('--disallowedTools');
    expect(CLAUDE_FLAGS).toContain('--add-dir');
    expect(CLAUDE_FLAGS).toContain('--debug');
    expect(CLAUDE_FLAGS).toContain('--verbose');
    expect(CLAUDE_FLAGS).toContain('--output-format');
    expect(CLAUDE_FLAGS).toContain('--input-format');
    expect(CLAUDE_FLAGS).toContain('--system-prompt');
    expect(CLAUDE_FLAGS).toContain('--json-schema');
    expect(CLAUDE_FLAGS).toContain('--max-budget-usd');
    expect(CLAUDE_FLAGS).toContain('--name');
    expect(CLAUDE_FLAGS).toContain('--session-id');
  });

  it('separates miyagi args from claude pass-through args', () => {
    const { miyagiArgs, claudeArgs } = parseArgs([
      'use', 'sales-agent', '--model', 'opus', '--effort', 'high',
    ]);
    expect(miyagiArgs).toEqual(['use', 'sales-agent']);
    expect(claudeArgs).toEqual(['--model', 'opus', '--effort', 'high']);
  });

  it('keeps miyagi-specific flags with miyagi', () => {
    const { miyagiArgs, claudeArgs } = parseArgs([
      'battle', 'agent-a', 'agent-b', '--mode', 'debate', '--model', 'opus',
    ]);
    expect(miyagiArgs).toEqual(['battle', 'agent-a', 'agent-b', '--mode', 'debate']);
    expect(claudeArgs).toEqual(['--model', 'opus']);
  });
});
