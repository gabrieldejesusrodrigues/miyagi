import type { BattleModeConfig } from '../types/index.js';

interface ConversationEntry {
  role: string;
  content: string;
}

interface RolePrompts {
  agentA: string;
  agentB: string;
}

const TERMINATION_SIGNALS = [
  '[END_CONVERSATION]',
  '[DEAL_CLOSED]',
  '[AGREEMENT_REACHED]',
  '[NEGOTIATION_COMPLETE]',
  '[INTERVIEW_COMPLETE]',
  '[TICKET_RESOLVED]',
];

export class BattleMediator {
  buildRolePrompts(modeConfig: BattleModeConfig, context?: string): RolePrompts {
    const roleA = modeConfig.roles?.agentA ?? 'Agent A';
    const roleB = modeConfig.roles?.agentB ?? 'Agent B';

    let agentAPrompt = `You are playing the role of: ${roleA}\n`;
    agentAPrompt += `Battle mode: ${modeConfig.name}\n`;
    agentAPrompt += `${modeConfig.description}\n`;
    if (context) agentAPrompt += `\nContext: ${context}\n`;
    agentAPrompt += `\nRespond in character. Stay focused on your role.`;

    let agentBPrompt = `You are playing the role of: ${roleB}\n`;
    agentBPrompt += `Battle mode: ${modeConfig.name}\n`;
    agentBPrompt += `${modeConfig.description}\n`;
    if (context) agentBPrompt += `\nContext: ${context}\n`;
    agentBPrompt += `\nRespond in character. Stay focused on your role.`;

    return { agentA: agentAPrompt, agentB: agentBPrompt };
  }

  formatHistory(history: ConversationEntry[]): string {
    return history
      .map(entry => `**${entry.role}:** ${entry.content}`)
      .join('\n\n');
  }

  isNaturalEnd(response: string): boolean {
    return TERMINATION_SIGNALS.some(signal => response.includes(signal));
  }

  buildTurnPrompt(
    rolePrompt: string,
    history: ConversationEntry[],
    currentRound: number,
    maxRounds: number,
  ): string {
    let prompt = rolePrompt + '\n\n';
    prompt += `--- Round ${currentRound} of ${maxRounds} ---\n\n`;

    if (history.length > 0) {
      prompt += 'Conversation so far:\n\n';
      prompt += this.formatHistory(history);
      prompt += '\n\n';
    }

    prompt += 'Your response:';
    return prompt;
  }
}
