import { describe, it, expect, vi } from 'vitest';
import { formatEvent, formatElapsed, createProgressCallback } from '../../src/cli/display/battle-display.js';
import type { BattleProgressEvent } from '../../src/types/index.js';

describe('formatElapsed', () => {
  it('formats under 1000ms as ms', () => {
    expect(formatElapsed(0)).toBe('0ms');
    expect(formatElapsed(500)).toBe('500ms');
    expect(formatElapsed(999)).toBe('999ms');
  });

  it('formats 1000-59999ms as seconds with 1 decimal', () => {
    expect(formatElapsed(1000)).toBe('1.0s');
    expect(formatElapsed(1500)).toBe('1.5s');
    expect(formatElapsed(59999)).toBe('60.0s');
  });

  it('formats 60000+ms as minutes and seconds', () => {
    expect(formatElapsed(60000)).toBe('1m 0s');
    expect(formatElapsed(90000)).toBe('1m 30s');
    expect(formatElapsed(3661000)).toBe('61m 1s');
  });
});

describe('formatEvent', () => {
  describe('setup phase', () => {
    it('formats setup/start with agent names from message', () => {
      const event: BattleProgressEvent = {
        phase: 'setup',
        type: 'start',
        message: 'agentA vs agentB',
      };
      const result = formatEvent(event);
      expect(result).toContain('Battle started');
      expect(result).toContain('agentA vs agentB');
    });

    it('formats setup/start without message gracefully', () => {
      const event: BattleProgressEvent = {
        phase: 'setup',
        type: 'start',
      };
      const result = formatEvent(event);
      expect(result).toContain('Battle started');
    });
  });

  describe('round phase', () => {
    it('formats round/start with round numbers', () => {
      const event: BattleProgressEvent = {
        phase: 'round',
        type: 'start',
        round: 2,
        totalRounds: 5,
      };
      const result = formatEvent(event);
      expect(result).toContain('Round 2/5');
    });

    it('formats round/start with agent name', () => {
      const event: BattleProgressEvent = {
        phase: 'round',
        type: 'start',
        round: 1,
        totalRounds: 3,
        agent: 'claude',
      };
      const result = formatEvent(event);
      expect(result).toContain('Round 1/3');
      expect(result).toContain('claude');
    });

    it('formats round/start with task message', () => {
      const event: BattleProgressEvent = {
        phase: 'round',
        type: 'start',
        round: 1,
        totalRounds: 5,
        message: 'TDD vs writing tests after implementation',
      };
      const result = formatEvent(event);
      expect(result).toContain('Round 1/5');
      expect(result).toContain('TDD vs writing tests after implementation');
    });

    it('formats round/info with agent as responding', () => {
      const event: BattleProgressEvent = {
        phase: 'round',
        type: 'info',
        agent: 'gpt-4',
      };
      const result = formatEvent(event);
      expect(result).toContain('gpt-4');
      expect(result).toContain('responding');
    });

    it('formats round/complete with agent under 1000ms', () => {
      const event: BattleProgressEvent = {
        phase: 'round',
        type: 'complete',
        agent: 'claude',
        elapsedMs: 800,
      };
      const result = formatEvent(event);
      expect(result).toContain('claude');
      expect(result).toContain('completed');
      expect(result).toContain('800ms');
    });

    it('formats round/complete with agent over 1000ms as seconds', () => {
      const event: BattleProgressEvent = {
        phase: 'round',
        type: 'complete',
        agent: 'claude',
        elapsedMs: 2500,
      };
      const result = formatEvent(event);
      expect(result).toContain('claude');
      expect(result).toContain('completed');
      expect(result).toContain('2.5s');
    });

    it('formats round/complete with response preview in message', () => {
      const event: BattleProgressEvent = {
        phase: 'round',
        type: 'complete',
        agent: 'claude',
        elapsedMs: 1500,
        message: 'I believe TDD is superior because it forces you to think about design first...',
      };
      const result = formatEvent(event);
      expect(result).toContain('claude');
      expect(result).toContain('completed');
      expect(result).toContain('1.5s');
      expect(result).toContain('I believe TDD is superior');
    });

    it('truncates long response previews', () => {
      const longResponse = 'A'.repeat(300);
      const event: BattleProgressEvent = {
        phase: 'round',
        type: 'complete',
        agent: 'claude',
        elapsedMs: 1000,
        message: longResponse,
      };
      const result = formatEvent(event);
      expect(result.length).toBeLessThan(400);
      expect(result).toContain('...');
    });

    it('formats round/complete without agent as round complete', () => {
      const event: BattleProgressEvent = {
        phase: 'round',
        type: 'complete',
        round: 3,
      };
      const result = formatEvent(event);
      expect(result).toContain('Round 3');
      expect(result).toContain('complete');
    });

    it('formats round/complete without agent or round number', () => {
      const event: BattleProgressEvent = {
        phase: 'round',
        type: 'complete',
      };
      const result = formatEvent(event);
      expect(result).toContain('complete');
    });
  });

  describe('judge phase', () => {
    it('formats judge/start', () => {
      const event: BattleProgressEvent = {
        phase: 'judge',
        type: 'start',
      };
      const result = formatEvent(event);
      expect(result).toContain('Judge');
      expect(result).toContain('evaluating');
    });

    it('formats judge/complete with elapsed', () => {
      const event: BattleProgressEvent = {
        phase: 'judge',
        type: 'complete',
        elapsedMs: 3000,
      };
      const result = formatEvent(event);
      expect(result).toContain('Judge');
      expect(result).toContain('complete');
      expect(result).toContain('3.0s');
    });

    it('formats judge/complete without elapsed', () => {
      const event: BattleProgressEvent = {
        phase: 'judge',
        type: 'complete',
      };
      const result = formatEvent(event);
      expect(result).toContain('Judge');
      expect(result).toContain('complete');
    });
  });

  describe('coach phase', () => {
    it('formats coach/start with agent', () => {
      const event: BattleProgressEvent = {
        phase: 'coach',
        type: 'start',
        agent: 'claude',
      };
      const result = formatEvent(event);
      expect(result).toContain('Coaching');
      expect(result).toContain('claude');
    });

    it('formats coach/complete with agent and elapsed', () => {
      const event: BattleProgressEvent = {
        phase: 'coach',
        type: 'complete',
        agent: 'gpt-4',
        elapsedMs: 1200,
      };
      const result = formatEvent(event);
      expect(result).toContain('gpt-4');
      expect(result).toContain('coached');
      expect(result).toContain('1.2s');
    });

    it('formats coach/start without agent gracefully', () => {
      const event: BattleProgressEvent = {
        phase: 'coach',
        type: 'start',
      };
      const result = formatEvent(event);
      expect(result).toContain('Coaching');
    });
  });

  describe('complete phase', () => {
    it('formats complete/complete', () => {
      const event: BattleProgressEvent = {
        phase: 'complete',
        type: 'complete',
      };
      const result = formatEvent(event);
      expect(result).toContain('Battle complete');
    });
  });

  describe('edge cases', () => {
    it('returns a sensible fallback for unknown phase/type combo', () => {
      const event: BattleProgressEvent = {
        phase: 'setup' as BattlePhase,
        type: 'info',
        message: 'some info',
      };
      const result = formatEvent(event);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('handles elapsedMs of 0 correctly', () => {
      const event: BattleProgressEvent = {
        phase: 'round',
        type: 'complete',
        agent: 'claude',
        elapsedMs: 0,
      };
      const result = formatEvent(event);
      expect(result).toContain('0ms');
    });

    it('handles very large elapsed times', () => {
      const event: BattleProgressEvent = {
        phase: 'judge',
        type: 'complete',
        elapsedMs: 3661000,
      };
      const result = formatEvent(event);
      expect(result).toContain('61m 1s');
    });

    it('does not crash with completely minimal event', () => {
      const event = { phase: 'complete' as BattlePhase, type: 'complete' as const };
      expect(() => formatEvent(event)).not.toThrow();
    });
  });
});

describe('createProgressCallback', () => {
  it('calls the provided writer with formatted output', () => {
    const writer = vi.fn();
    const cb = createProgressCallback(writer);
    cb({ phase: 'complete', type: 'complete' });
    expect(writer).toHaveBeenCalledOnce();
    expect(writer.mock.calls[0][0]).toContain('Battle complete');
  });

  it('uses console.log as default writer', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const cb = createProgressCallback();
    cb({ phase: 'judge', type: 'start' });
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it('returns a function', () => {
    const cb = createProgressCallback();
    expect(typeof cb).toBe('function');
  });
});

// Required import to satisfy TypeScript for the cast above
import type { BattlePhase } from '../../src/types/index.js';
