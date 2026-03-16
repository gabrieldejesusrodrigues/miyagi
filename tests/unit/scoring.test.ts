import { describe, it, expect } from 'vitest';
import { calculateElo, updateDimensionScores, determineTrend } from '../../src/training/scoring.js';

describe('ELO calculation', () => {
  it('winner gains more points when beating higher-rated opponent', () => {
    const { winnerNew, loserNew } = calculateElo(1200, 1600, 'win');
    expect(winnerNew).toBeGreaterThan(1200 + 20);
    expect(loserNew).toBeLessThan(1600);
  });

  it('winner gains fewer points when beating lower-rated opponent', () => {
    const { winnerNew } = calculateElo(1600, 1200, 'win');
    expect(winnerNew - 1600).toBeLessThan(16);
  });

  it('handles draws', () => {
    const { winnerNew, loserNew } = calculateElo(1200, 1200, 'draw');
    expect(winnerNew).toBe(1200);
    expect(loserNew).toBe(1200);
  });
});

describe('Dimension scoring', () => {
  it('updates dimension history', () => {
    const dims = {};
    const updated = updateDimensionScores(dims, { 'rapport': 7.5, 'closing': 6.0 });
    expect(updated['rapport'].current).toBe(7.5);
    expect(updated['rapport'].history).toEqual([7.5]);
  });

  it('appends to existing history', () => {
    const dims = { rapport: { current: 5.0, history: [5.0], trend: 'stable' as const } };
    const updated = updateDimensionScores(dims, { rapport: 7.5 });
    expect(updated['rapport'].history).toEqual([5.0, 7.5]);
    expect(updated['rapport'].current).toBe(7.5);
  });
});

describe('Trend detection', () => {
  it('detects upward trend', () => {
    expect(determineTrend([3, 4, 5, 6, 7])).toBe('up');
  });

  it('detects downward trend', () => {
    expect(determineTrend([7, 6, 5, 4, 3])).toBe('down');
  });

  it('detects stable trend', () => {
    expect(determineTrend([5, 5.1, 4.9, 5, 5.1])).toBe('stable');
  });
});
