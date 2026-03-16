import { describe, it, expect } from 'vitest';
import { formatStatsDisplay, formatComparisonDisplay } from '../../src/cli/display/stats-display.js';
import type { AgentStats } from '../../src/types/index.js';

describe('Stats display', () => {
  const mockStats: AgentStats = {
    agent: 'test-agent',
    elo: { sales: 1250, coding: 1100 },
    dimensions: {
      rapport: { current: 8.5, history: [5, 6, 7, 8, 8.5], trend: 'up' },
      closing: { current: 6.0, history: [6, 6, 6, 6], trend: 'stable' },
      empathy: { current: 4.0, history: [7, 6, 5, 4], trend: 'down' },
    },
    battles: { total: 10, record: { wins: 6, losses: 3, draws: 1 } },
    coachNotes: [{ date: '2026-03-14', note: 'Focus on empathy' }],
    lastBattle: 'battle-123',
  };

  it('formats agent name and record', () => {
    const output = formatStatsDisplay(mockStats);
    expect(output).toContain('test-agent');
    expect(output).toContain('6');
    expect(output).toContain('3');
    expect(output).toContain('1');
  });

  it('shows ELO ratings', () => {
    const output = formatStatsDisplay(mockStats);
    expect(output).toContain('1250');
    expect(output).toContain('sales');
  });

  it('shows dimension bars with trends', () => {
    const output = formatStatsDisplay(mockStats);
    expect(output).toContain('rapport');
    expect(output).toContain('8.5');
  });

  it('formats comparison between two agents', () => {
    const statsB: AgentStats = {
      ...mockStats,
      agent: 'other-agent',
      elo: { sales: 1300 },
      battles: { total: 5, record: { wins: 3, losses: 2, draws: 0 } },
    };

    const output = formatComparisonDisplay(mockStats, statsB);
    expect(output).toContain('test-agent');
    expect(output).toContain('other-agent');
  });
});
