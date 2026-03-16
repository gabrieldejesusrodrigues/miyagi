import type { DimensionScore } from '../types/index.js';

const K_FACTOR = 32;

export function calculateElo(
  winnerRating: number,
  loserRating: number,
  outcome: 'win' | 'draw',
): { winnerNew: number; loserNew: number } {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  const expectedLoser = 1 - expectedWinner;

  if (outcome === 'draw') {
    const winnerNew = Math.round(winnerRating + K_FACTOR * (0.5 - expectedWinner));
    const loserNew = Math.round(loserRating + K_FACTOR * (0.5 - expectedLoser));
    return { winnerNew, loserNew };
  }

  const winnerNew = Math.round(winnerRating + K_FACTOR * (1 - expectedWinner));
  const loserNew = Math.round(loserRating + K_FACTOR * (0 - expectedLoser));
  return { winnerNew, loserNew };
}

export function updateDimensionScores(
  existing: Record<string, DimensionScore>,
  newScores: Record<string, number>,
): Record<string, DimensionScore> {
  const updated = { ...existing };

  for (const [dimension, score] of Object.entries(newScores)) {
    if (updated[dimension]) {
      updated[dimension] = {
        current: score,
        history: [...updated[dimension].history, score],
        trend: determineTrend([...updated[dimension].history, score]),
      };
    } else {
      updated[dimension] = {
        current: score,
        history: [score],
        trend: 'stable',
      };
    }
  }

  return updated;
}

export function determineTrend(history: number[]): 'up' | 'down' | 'stable' {
  if (history.length < 2) return 'stable';

  const recent = history.slice(-5);
  if (recent.length < 2) return 'stable';

  let upCount = 0;
  let downCount = 0;

  for (let i = 1; i < recent.length; i++) {
    const diff = recent[i] - recent[i - 1];
    if (diff > 0.2) upCount++;
    else if (diff < -0.2) downCount++;
  }

  if (upCount > downCount && upCount >= recent.length / 2) return 'up';
  if (downCount > upCount && downCount >= recent.length / 2) return 'down';
  return 'stable';
}
