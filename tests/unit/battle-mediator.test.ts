import { describe, it, expect } from 'vitest';
import { BattleMediator } from '../../src/battle/mediator.js';
import type { BattleModeConfig } from '../../src/types/index.js';

describe('BattleMediator', () => {
  it('creates role prompts for asymmetric battles', () => {
    const mediator = new BattleMediator();
    const modeConfig: BattleModeConfig = {
      name: 'sales-roleplay',
      type: 'asymmetric',
      description: 'Sales roleplay battle',
      defaultRounds: 10,
      roles: { agentA: 'Salesperson', agentB: 'Customer' },
    };

    const prompts = mediator.buildRolePrompts(modeConfig, 'Sell me this pen');
    expect(prompts.agentA).toContain('Salesperson');
    expect(prompts.agentB).toContain('Customer');
  });

  it('formats conversation history for next turn', () => {
    const mediator = new BattleMediator();
    const history = [
      { role: 'Agent A', content: 'Hello, I have something for you.' },
      { role: 'Agent B', content: 'What is it?' },
    ];

    const formatted = mediator.formatHistory(history);
    expect(formatted).toContain('Agent A');
    expect(formatted).toContain('Hello, I have something for you.');
    expect(formatted).toContain('Agent B');
    expect(formatted).toContain('What is it?');
  });

  it('detects natural termination signals', () => {
    const mediator = new BattleMediator();
    expect(mediator.isNaturalEnd('I accept your offer. Deal!')).toBe(false);
    expect(mediator.isNaturalEnd('[END_CONVERSATION]')).toBe(true);
    expect(mediator.isNaturalEnd('Thank you [DEAL_CLOSED] for your time')).toBe(true);
  });

  it('builds turn prompt with history context', () => {
    const mediator = new BattleMediator();
    const turnPrompt = mediator.buildTurnPrompt(
      'You are a customer',
      [{ role: 'Salesperson', content: 'Can I help you?' }],
      3,
      10,
    );
    expect(turnPrompt).toContain('Round 3 of 10');
    expect(turnPrompt).toContain('Salesperson');
    expect(turnPrompt).toContain('Can I help you?');
  });
});
