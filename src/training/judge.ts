import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { BattleResult, JudgeVerdict } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class Judge {
  private readonly identityPath: string;

  constructor() {
    this.identityPath = join(__dirname, '..', 'builtin-agents', 'miyagi-judge', 'identity.md');
  }

  getIdentity(): string {
    return readFileSync(this.identityPath, 'utf-8');
  }

  buildEvaluationPrompt(result: BattleResult): string {
    let prompt = 'Evaluate this battle:\n\n';
    prompt += `Mode: ${result.config.mode}\n`;
    prompt += `Agent A: ${result.config.agentA}\n`;
    prompt += `Agent B: ${result.config.agentB}\n`;

    if (result.config.task) {
      prompt += `Task: ${result.config.task}\n`;
    }
    if (result.config.topic) {
      prompt += `Topic: ${result.config.topic}\n`;
    }

    prompt += `\n--- Battle Transcript ---\n\n`;

    for (const round of result.rounds) {
      prompt += `## Round ${round.round}\n\n`;
      prompt += `### ${result.config.agentA}:\n${round.agentAResponse}\n\n`;
      prompt += `### ${result.config.agentB}:\n${round.agentBResponse}\n\n`;
    }

    prompt += `\nTermination reason: ${result.terminationReason}\n`;
    prompt += `\nProvide your evaluation as a JSON object.`;

    return prompt;
  }

  parseVerdict(raw: string): JudgeVerdict {
    // Try to extract JSON from the response (may have surrounding text)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse judge verdict: no JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required fields
    if (!parsed.winner || !parsed.reason || !parsed.agentAAnalysis || !parsed.agentBAnalysis) {
      throw new Error('Judge verdict missing required fields');
    }

    return parsed as JudgeVerdict;
  }
}
