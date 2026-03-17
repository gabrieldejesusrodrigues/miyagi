import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { BattleResult, JudgeVerdict } from '../types/index.js';
import { extractBalancedJson } from '../utils/json-parser.js';

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
    prompt += `Agent A (named "${result.config.agentA}"): This is a contestant you are evaluating.\n`;
    prompt += `Agent B (named "${result.config.agentB}"): This is a contestant you are evaluating.\n`;

    if (result.config.task) {
      prompt += `\n## Original Task Given to Both Contestants\n`;
      prompt += `The following task was assigned to both contestants. Use it as your primary criterion for scoring Task Completion — verify that each contestant actually delivered what was asked.\n`;
      prompt += `\`\`\`\n${result.config.task}\n\`\`\`\n`;
    }
    if (result.config.topic) {
      prompt += `\nTopic: ${result.config.topic}\n`;
    }

    prompt += `\n--- Battle Transcript (Contestant Outputs) ---\n\n`;

    for (const round of result.rounds) {
      prompt += `## Round ${round.round}\n\n`;
      prompt += `### Contestant "${result.config.agentA}" output:\n${round.agentAResponse}\n\n`;
      prompt += `### Contestant "${result.config.agentB}" output:\n${round.agentBResponse}\n\n`;
    }

    prompt += `\nTermination reason: ${result.terminationReason}\n`;
    prompt += `\nIMPORTANT EVALUATION RULES:\n`;
    prompt += `- Each contestant's output may include an "Actual Generated Files" section showing the real files they created (code, documents, configs, templates, etc.). If present, evaluate the ACTUAL FILE CONTENTS, not just the contestant's description of their work. Descriptions can be misleading — the files are the truth.\n`;
    prompt += `- Verify the generated files against the task requirements: if the task asked for specific features, methods, sections, or deliverables, check that the files actually contain them.\n`;
    prompt += `- If a contestant claims success but the actual files show bugs, missing requirements, incomplete implementations, or low-quality output, score Task Completion accordingly.\n`;
    prompt += `- Do not give high Task Completion scores to contestants who only described what they would do without delivering actual files or working solutions.\n`;
    prompt += `- In your analysis, reference specific details from the actual generated files when available.\n`;
    prompt += `\nProvide your evaluation as a compact JSON object. Be concise — keep narrative under 200 words and each analysis field under 100 words. Output ONLY the JSON, no markdown fences.`;

    return prompt;
  }

  parseVerdict(raw: string): JudgeVerdict {
    const jsonStr = extractBalancedJson(raw);
    if (!jsonStr) {
      throw new Error('Failed to parse judge verdict: no JSON found in response');
    }

    const parsed = JSON.parse(jsonStr);

    // Validate required fields
    if (!parsed.winner || !parsed.reason || !parsed.agentAAnalysis || !parsed.agentBAnalysis) {
      throw new Error('Judge verdict missing required fields');
    }

    return parsed as JudgeVerdict;
  }
}
