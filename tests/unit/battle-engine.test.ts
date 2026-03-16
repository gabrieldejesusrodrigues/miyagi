import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BattleEngine } from '../../src/battle/engine.js';
import type { BattleConfig } from '../../src/types/index.js';

describe('BattleEngine', () => {
  let engine: BattleEngine;

  beforeEach(() => {
    engine = new BattleEngine();
  });

  it('creates a battle config with correct defaults', () => {
    const config = engine.createConfig({
      agentA: 'agent-a',
      agentB: 'agent-b',
      mode: 'same-task',
      task: 'Write a hello world program',
    });

    expect(config.agentA).toBe('agent-a');
    expect(config.agentB).toBe('agent-b');
    expect(config.mode).toBe('same-task');
    expect(config.task).toBe('Write a hello world program');
    expect(config.maxRounds).toBe(1);
    expect(config.background).toBe(false);
    expect(config.id).toBeTruthy();
    expect(config.startedAt).toBeTruthy();
  });

  it('creates a battle config with custom rounds', () => {
    const config = engine.createConfig({
      agentA: 'agent-a',
      agentB: 'agent-b',
      mode: 'same-task',
      maxRounds: 3,
    });

    expect(config.maxRounds).toBe(3);
  });

  it('creates a battle config for background mode', () => {
    const config = engine.createConfig({
      agentA: 'agent-a',
      agentB: 'agent-b',
      mode: 'code-challenge',
      background: true,
    });

    expect(config.background).toBe(true);
  });

  it('assembles a battle result from rounds', () => {
    const config = engine.createConfig({
      agentA: 'a',
      agentB: 'b',
      mode: 'same-task',
    });

    const rounds = [
      {
        round: 1,
        agentAResponse: 'Hello from A',
        agentBResponse: 'Hello from B',
        timestamp: new Date().toISOString(),
      },
    ];

    const result = engine.assembleResult(config, rounds, 'natural');

    expect(result.config).toBe(config);
    expect(result.rounds).toEqual(rounds);
    expect(result.terminationReason).toBe('natural');
    expect(result.endedAt).toBeTruthy();
  });

  it('validates mode exists', () => {
    expect(() => engine.validateMode('same-task')).not.toThrow();
    expect(() => engine.validateMode('code-challenge')).not.toThrow();
    expect(() => engine.validateMode('invalid-mode' as any)).toThrow();
  });
});
