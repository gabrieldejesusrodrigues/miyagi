import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { JudgeVerdict } from '../types/index.js';
import type { AgentManager } from '../core/agent-manager.js';
import { extractBalancedJson } from '../utils/json-parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface CoachingChange {
  file: string;
  section: string;
  action: 'add' | 'modify' | 'remove';
  content: string;
  reason: string;
}

interface CoachingResult {
  changes: CoachingChange[];
  summary: string;
  focusAreas: string[];
  expectedImprovement: string;
}

export class Coach {
  private readonly agentManager: AgentManager;
  private readonly identityPath: string;

  constructor(agentManager: AgentManager) {
    this.agentManager = agentManager;
    this.identityPath = join(__dirname, '..', 'builtin-agents', 'mr-miyagi', 'identity.md');
  }

  getIdentity(): string {
    return readFileSync(this.identityPath, 'utf-8');
  }

  buildCoachingPrompt(
    agentName: string,
    verdict: JudgeVerdict,
    agentIdentity: string = '',
    agentManifest: { description?: string; domains?: string[]; templateOrigin?: string } = {},
  ): string {
    const isAgentA = verdict.agentAAnalysis.agent === agentName;
    const analysis = isAgentA ? verdict.agentAAnalysis : verdict.agentBAnalysis;
    const priorities = isAgentA ? verdict.coachingPriorities.agentA : verdict.coachingPriorities.agentB;

    let prompt = `Train agent: ${agentName}\n\n`;
    prompt += `## Battle Result\n`;
    prompt += `Winner: ${verdict.winner}\n`;
    prompt += `Reason: ${verdict.reason}\n\n`;

    prompt += `## Agent Analysis\n`;
    prompt += `Strengths: ${analysis.strengths.join(', ')}\n`;
    prompt += `Weaknesses: ${analysis.weaknesses.join(', ')}\n`;
    prompt += `Missed Opportunities: ${analysis.missedOpportunities.join(', ')}\n\n`;

    prompt += `## Dimension Scores\n`;
    for (const [dim, score] of Object.entries(analysis.dimensionScores)) {
      prompt += `- ${dim}: ${score}/10\n`;
    }

    prompt += `\n## Coaching Priorities\n`;
    for (const priority of priorities) {
      prompt += `- ${priority}\n`;
    }

    prompt += `\n## Comparative Context\n${verdict.comparativeAnalysis}\n`;

    if (agentIdentity) {
      prompt += `\n## Student "${agentName}" — Current identity.md (this is the file you will modify)\n\`\`\`\n${agentIdentity}\n\`\`\`\n`;
    }

    if (agentManifest.description) {
      prompt += `\n## Student's Role Description\n${agentManifest.description}\n`;
    }

    if (agentManifest.domains?.length) {
      prompt += `\n## Student's Specialized Domains\n${agentManifest.domains.join(', ')}\n`;
    }

    if (agentManifest.templateOrigin) {
      prompt += `\n## Student's Template Origin\n${agentManifest.templateOrigin}\n`;
    }

    prompt += `\n## CRITICAL COACHING RULES\n`;
    prompt += `You are Mr. Miyagi, the coach. The student you are training is "${agentName}" (shown above). Your coaching changes MUST be domain-specific and tailored to this student's role:\n`;
    prompt += `- If the student is a developer/coding agent: prescribe specific coding practices, design patterns, TDD techniques, code review approaches, architectural principles. Reference concrete programming concepts.\n`;
    prompt += `- If the student is a sales agent: prescribe specific sales techniques (SPIN selling, Challenger Sale, MEDDIC), objection handling frameworks, discovery questions, closing strategies. Reference concrete sales methodology.\n`;
    prompt += `- If the student is a support agent: prescribe specific support frameworks (active listening, empathy mapping, escalation protocols, resolution tracking). Reference concrete customer service methodologies.\n`;
    prompt += `- If the student is a writer agent: prescribe specific writing techniques (structure, voice, audience awareness, editing frameworks). Reference concrete writing methodology.\n`;
    prompt += `- If the student is a business analyst: prescribe specific BA techniques (requirements gathering, stakeholder mapping, process modeling, acceptance criteria). Reference concrete BA methodology.\n`;
    prompt += `- For ANY student type: coaching must reference the student's existing identity shown above, build on their current strengths, and prescribe improvements using the vocabulary and frameworks of their specific domain.\n`;
    prompt += `- NEVER give generic advice like "be more strategic" or "improve communication". Every suggestion must be a concrete, actionable technique from the student's domain.\n`;
    prompt += `- Read the student's current identity carefully and make changes that ENHANCE it, not replace it with generic content.\n`;

    prompt += `\nProvide your coaching changes as a JSON object.`;

    return prompt;
  }

  parseCoachingResponse(raw: string): CoachingResult {
    const jsonStr = extractBalancedJson(raw);
    if (!jsonStr) {
      throw new Error('Failed to parse coaching response: no JSON found');
    }

    const parsed = JSON.parse(jsonStr);

    if (!parsed.changes || !Array.isArray(parsed.changes)) {
      throw new Error('Coaching response missing changes array');
    }

    return parsed as CoachingResult;
  }

  async getAgentFiles(agentName: string): Promise<{ identity: string; context: string[] }> {
    const agent = await this.agentManager.get(agentName);
    if (!agent) throw new Error(`Agent "${agentName}" not found`);

    const identity = readFileSync(agent.identityPath, 'utf-8');
    return { identity, context: [] };
  }

  async applyChanges(agentName: string, result: CoachingResult): Promise<void> {
    const agent = await this.agentManager.get(agentName);
    if (!agent) throw new Error(`Agent "${agentName}" not found`);

    for (const change of result.changes) {
      if (change.file === 'identity.md' && change.action === 'modify') {
        let identity = readFileSync(agent.identityPath, 'utf-8');
        const sectionRegex = new RegExp(`(## ${change.section}\\n)([\\s\\S]*?)(?=\\n## |$)`);
        if (sectionRegex.test(identity)) {
          identity = identity.replace(sectionRegex, `$1\n${change.content}\n`);
        } else {
          identity += `\n## ${change.section}\n\n${change.content}\n`;
        }
        writeFileSync(agent.identityPath, identity);
      } else if (change.action === 'add' && change.file.startsWith('context/')) {
        const filePath = join(agent.contextDir, change.file.replace('context/', ''));
        writeFileSync(filePath, change.content);
      } else if (change.action === 'add' && change.file.startsWith('skills/')) {
        const skillDir = join(agent.skillsDir, change.file.replace('skills/', '').split('/')[0]);
        if (!existsSync(skillDir)) mkdirSync(skillDir, { recursive: true });
        writeFileSync(join(skillDir, 'SKILL.md'), change.content);
      }
    }
  }
}
