import { describe, it, expect } from 'vitest';
import { BattleMediator } from '../../src/battle/mediator.js';
import { BattleEngine } from '../../src/battle/engine.js';
import type { BattleModeConfig } from '../../src/types/index.js';

describe('BattleMediator edge cases', () => {
  const mediator = new BattleMediator();

  it('buildTurnPrompt with empty history omits conversation section', () => {
    const prompt = mediator.buildTurnPrompt('You are a customer', [], 1, 10);
    expect(prompt).toContain('Round 1 of 10');
    expect(prompt).not.toContain('Conversation so far');
  });

  it('buildRolePrompts without context omits context line', () => {
    const config: BattleModeConfig = {
      name: 'debate',
      type: 'asymmetric',
      description: 'Test debate',
      defaultRounds: 5,
      roles: { agentA: 'Pro', agentB: 'Con' },
    };

    const prompts = mediator.buildRolePrompts(config);
    expect(prompts.agentA).toContain('Pro');
    expect(prompts.agentA).not.toContain('Context:');
  });

  it('buildRolePrompts without roles uses defaults', () => {
    const config: BattleModeConfig = {
      name: 'same-task',
      type: 'symmetric',
      description: 'Same task battle',
      defaultRounds: 1,
    };

    const prompts = mediator.buildRolePrompts(config);
    expect(prompts.agentA).toContain('Agent A');
    expect(prompts.agentB).toContain('Agent B');
  });

  it('formatHistory with empty array returns empty string', () => {
    expect(mediator.formatHistory([])).toBe('');
  });

  it('isNaturalEnd detects all termination signals', () => {
    const signals = [
      '[END_CONVERSATION]',
      '[DEAL_CLOSED]',
      '[AGREEMENT_REACHED]',
      '[NEGOTIATION_COMPLETE]',
      '[INTERVIEW_COMPLETE]',
      '[TICKET_RESOLVED]',
    ];
    for (const signal of signals) {
      expect(mediator.isNaturalEnd(`Some text ${signal} more text`)).toBe(true);
    }
  });
});

describe('BattleEngine edge cases', () => {
  const engine = new BattleEngine();

  it('createConfig with debate mode gets 5 default rounds', () => {
    const config = engine.createConfig({
      agentA: 'a', agentB: 'b', mode: 'debate', topic: 'AI Ethics',
    });
    expect(config.maxRounds).toBe(5);
    expect(config.topic).toBe('AI Ethics');
  });

  it('validateMode rejects empty string', () => {
    expect(() => engine.validateMode('')).toThrow('Invalid battle mode');
  });

  it('assembleResult with empty rounds', () => {
    const config = engine.createConfig({ agentA: 'a', agentB: 'b', mode: 'same-task' });
    const result = engine.assembleResult(config, [], 'user-stopped');
    expect(result.rounds).toEqual([]);
    expect(result.terminationReason).toBe('user-stopped');
  });
});
