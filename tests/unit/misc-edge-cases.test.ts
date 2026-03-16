import { describe, it, expect } from 'vitest';
import { formatStatsDisplay, formatComparisonDisplay } from '../../src/cli/display/stats-display.js';
import { parseArgs, CLAUDE_SHORT_FLAGS } from '../../src/core/claude-flags.js';
import { validateManifest, validateStatsJson, validateInstalledSkills } from '../../src/utils/validators.js';
import { validateArchiveEntry } from '../../src/cli/middleware/security.js';
import type { AgentStats } from '../../src/types/index.js';

describe('Stats display edge cases', () => {
  it('handles agent with zero battles', () => {
    const stats: AgentStats = {
      agent: 'newbie',
      elo: {},
      dimensions: {},
      battles: { total: 0, record: { wins: 0, losses: 0, draws: 0 } },
      coachNotes: [],
    };
    const output = formatStatsDisplay(stats);
    expect(output).toContain('newbie');
    expect(output).toContain('Total: 0');
    expect(output).not.toContain('Win Rate');
  });

  it('handles agent with empty ELO', () => {
    const stats: AgentStats = {
      agent: 'test',
      elo: {},
      dimensions: { quality: { current: 5, history: [5], trend: 'stable' } },
      battles: { total: 1, record: { wins: 1, losses: 0, draws: 0 } },
      coachNotes: [],
    };
    const output = formatStatsDisplay(stats);
    expect(output).not.toContain('ELO Ratings');
  });

  it('handles agent with empty dimensions', () => {
    const stats: AgentStats = {
      agent: 'test',
      elo: { general: 1200 },
      dimensions: {},
      battles: { total: 1, record: { wins: 1, losses: 0, draws: 0 } },
      coachNotes: [],
    };
    const output = formatStatsDisplay(stats);
    expect(output).not.toContain('Skill Dimensions');
    expect(output).toContain('1200');
  });

  it('shows only last 3 coach notes', () => {
    const stats: AgentStats = {
      agent: 'test',
      elo: {},
      dimensions: {},
      battles: { total: 4, record: { wins: 2, losses: 2, draws: 0 } },
      coachNotes: [
        { date: '2026-01-01', note: 'Note 1' },
        { date: '2026-01-02', note: 'Note 2' },
        { date: '2026-01-03', note: 'Note 3' },
        { date: '2026-01-04', note: 'Note 4' },
      ],
    };
    const output = formatStatsDisplay(stats);
    expect(output).not.toContain('Note 1');
    expect(output).toContain('Note 2');
    expect(output).toContain('Note 3');
    expect(output).toContain('Note 4');
  });

  it('comparison shows equal sign for matching dimensions', () => {
    const statsA: AgentStats = {
      agent: 'a', elo: {}, dimensions: { quality: { current: 7, history: [7], trend: 'stable' } },
      battles: { total: 1, record: { wins: 1, losses: 0, draws: 0 } }, coachNotes: [],
    };
    const statsB: AgentStats = {
      agent: 'b', elo: {}, dimensions: { quality: { current: 7, history: [7], trend: 'stable' } },
      battles: { total: 1, record: { wins: 0, losses: 1, draws: 0 } }, coachNotes: [],
    };
    const output = formatComparisonDisplay(statsA, statsB);
    expect(output).toContain('=');
  });

  it('comparison handles missing dimensions in one agent', () => {
    const statsA: AgentStats = {
      agent: 'a', elo: {}, dimensions: { quality: { current: 7, history: [7], trend: 'stable' } },
      battles: { total: 1, record: { wins: 1, losses: 0, draws: 0 } }, coachNotes: [],
    };
    const statsB: AgentStats = {
      agent: 'b', elo: {}, dimensions: {},
      battles: { total: 1, record: { wins: 0, losses: 1, draws: 0 } }, coachNotes: [],
    };
    const output = formatComparisonDisplay(statsA, statsB);
    expect(output).toContain('quality');
    expect(output).toContain('0.0');
  });
});

describe('parseArgs edge cases', () => {
  it('handles short flags correctly', () => {
    const { miyagiArgs, claudeArgs } = parseArgs(['use', 'agent', '-p']);
    expect(miyagiArgs).toEqual(['use', 'agent']);
    expect(claudeArgs).toEqual(['-p']);
  });

  it('handles short flag with value', () => {
    const { miyagiArgs, claudeArgs } = parseArgs(['use', 'agent', '-n', 'my-session']);
    expect(miyagiArgs).toEqual(['use', 'agent']);
    expect(claudeArgs).toEqual(['-n', 'my-session']);
  });

  it('handles empty args', () => {
    const { miyagiArgs, claudeArgs } = parseArgs([]);
    expect(miyagiArgs).toEqual([]);
    expect(claudeArgs).toEqual([]);
  });

  it('handles Claude flag at end without value', () => {
    const { miyagiArgs, claudeArgs } = parseArgs(['use', 'agent', '--model']);
    expect(miyagiArgs).toEqual(['use', 'agent']);
    // --model is at end with no following arg, so no value consumed
    expect(claudeArgs).toEqual(['--model']);
  });

  it('handles boolean Claude flags (no value)', () => {
    const { miyagiArgs, claudeArgs } = parseArgs(['use', 'agent', '--verbose', '--dangerously-skip-permissions']);
    expect(miyagiArgs).toEqual(['use', 'agent']);
    expect(claudeArgs).toEqual(['--verbose', '--dangerously-skip-permissions']);
  });
});

describe('Validator edge cases', () => {
  it('validateManifest rejects null', () => {
    const result = validateManifest(null);
    expect(result.valid).toBe(false);
  });

  it('validateManifest rejects non-object', () => {
    const result = validateManifest('string');
    expect(result.valid).toBe(false);
  });

  it('validateManifest catches missing version', () => {
    const result = validateManifest({ name: 'test' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('version is required');
  });

  it('validateManifest catches empty name', () => {
    const result = validateManifest({ name: '', version: '1.0.0' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('name is required');
  });

  it('validateStatsJson rejects null', () => {
    const result = validateStatsJson(null);
    expect(result.valid).toBe(false);
  });

  it('validateStatsJson catches individual missing fields', () => {
    const result = validateStatsJson({ agent: 'test' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('elo is required');
    expect(result.errors).toContain('battles is required');
  });

  it('validateInstalledSkills catches entries missing name', () => {
    const result = validateInstalledSkills([{ source: 'github:user/repo' }]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('name is required');
  });

  it('validateInstalledSkills catches entries missing source', () => {
    const result = validateInstalledSkills([{ name: 'test' }]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('source is required');
  });

  it('validateInstalledSkills accepts empty array', () => {
    const result = validateInstalledSkills([]);
    expect(result.valid).toBe(true);
  });
});

describe('Archive security edge cases', () => {
  it('handles file with no extension', () => {
    const result = validateArchiveEntry('Makefile');
    expect(result.valid).toBe(true);
  });

  it('rejects deeply nested path traversal', () => {
    const result = validateArchiveEntry('context/../../etc/passwd');
    expect(result.valid).toBe(false);
  });

  it('accepts nested valid paths', () => {
    const result = validateArchiveEntry('context/domain/knowledge.md');
    expect(result.valid).toBe(true);
  });
});
