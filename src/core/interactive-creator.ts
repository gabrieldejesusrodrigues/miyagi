import { writeFileSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawn } from 'child_process';
import { createBridge } from './providers/factory.js';
import type { ProviderBridge } from './providers/types.js';

export interface AgentAnswers {
  description: string;
  domains: string[];
  archetype: string;
  expertise: string;
  boundaries: string;
  tone: string;
  verbosity: string;
  communicationRules: string;
  workflow: string;
  uncertainty: string;
  alwaysDo: string;
  neverDo: string;
}

const DOMAIN_CHOICES = [
  { name: 'Programming', value: 'programming' },
  { name: 'Code Review', value: 'code-review' },
  { name: 'Architecture', value: 'architecture' },
  { name: 'Sales', value: 'sales' },
  { name: 'Negotiation', value: 'negotiation' },
  { name: 'Writing', value: 'writing' },
  { name: 'Documentation', value: 'documentation' },
  { name: 'Customer Support', value: 'customer-support' },
  { name: 'Business Analysis', value: 'business-analysis' },
  { name: 'Data Analysis', value: 'data-analysis' },
  { name: 'DevOps', value: 'devops' },
  { name: 'Security', value: 'security' },
  { name: 'Design', value: 'design' },
  { name: 'Marketing', value: 'marketing' },
  { name: 'Project Management', value: 'project-management' },
];

const ARCHETYPE_CHOICES = [
  { name: 'Specialist — Deep expertise in a narrow domain', value: 'Specialist' },
  { name: 'Generalist — Broad coordination across domains', value: 'Generalist' },
  { name: 'Contrarian — Challenges assumptions, stress-tests decisions', value: 'Contrarian' },
  { name: 'Producer — Creates artifacts with consistent quality', value: 'Producer' },
  { name: 'Investigator — Evidence-gathering, hypothesis testing', value: 'Investigator' },
];

const TONE_CHOICES = [
  { name: 'Professional — Polished, corporate-appropriate', value: 'Professional' },
  { name: 'Conversational — Relaxed, approachable', value: 'Conversational' },
  { name: 'Direct — Terse, no fluff, straight to the point', value: 'Direct' },
  { name: 'Academic — Thorough, precise, well-cited', value: 'Academic' },
  { name: 'Friendly — Warm, encouraging, supportive', value: 'Friendly' },
];

const VERBOSITY_CHOICES = [
  { name: 'Concise — Short answers, minimal explanation', value: 'Concise' },
  { name: 'Balanced — Clear but not excessive', value: 'Balanced' },
  { name: 'Detailed — Comprehensive, thorough explanations', value: 'Detailed' },
];

const UNCERTAINTY_CHOICES = [
  { name: 'Ask for clarification — Stop and ask before proceeding', value: 'Ask for clarification before proceeding' },
  { name: 'Best judgment — Make a reasonable choice and note the assumption', value: 'Make best judgment and flag the assumption' },
  { name: 'Flag and proceed — Note uncertainty but continue', value: 'Flag uncertainty and proceed with most likely interpretation' },
];

export class InteractiveCreator {
  private bridge: ProviderBridge;

  constructor(bridge?: ProviderBridge) {
    this.bridge = bridge ?? createBridge();
  }

  async gatherInput(): Promise<AgentAnswers> {
    const { default: inquirer } = await import('inquirer');

    console.log('\n  Agent Identity Creator');
    console.log('  Answer the questions below to define your agent\'s identity.');
    console.log('  Press Enter to skip optional fields.\n');

    // Phase 1: Identity & Role
    console.log('  -- Identity & Role --\n');

    const phase1 = await inquirer.prompt<{
      description: string;
      domains: string[];
      customDomains: string;
      archetype: string;
    }>([
      {
        type: 'input',
        name: 'description',
        message: 'What does this agent do? (one sentence mission)',
        validate: (input: string) => input.trim().length > 0 || 'A description is required.',
      },
      {
        type: 'checkbox',
        name: 'domains',
        message: 'What domains does it specialize in? (select with space)',
        choices: DOMAIN_CHOICES,
      },
      {
        type: 'input',
        name: 'customDomains',
        message: 'Additional domains? (comma-separated, or Enter to skip)',
        default: '',
      },
      {
        type: 'list',
        name: 'archetype',
        message: 'What is its persona archetype?',
        choices: ARCHETYPE_CHOICES,
      },
    ]);

    const domains = [
      ...phase1.domains,
      ...phase1.customDomains
        .split(',')
        .map((d: string) => d.trim().toLowerCase())
        .filter((d: string) => d.length > 0),
    ];

    if (domains.length === 0) {
      const { fallbackDomain } = await inquirer.prompt<{ fallbackDomain: string }>([{
        type: 'input',
        name: 'fallbackDomain',
        message: 'At least one domain is required. Enter a domain:',
        validate: (input: string) => input.trim().length > 0 || 'Required.',
      }]);
      domains.push(fallbackDomain.trim().toLowerCase());
    }

    // Phase 2: Expertise & Knowledge
    console.log('\n  -- Expertise & Knowledge --\n');

    const phase2 = await inquirer.prompt<{
      expertise: string;
      boundaries: string;
    }>([
      {
        type: 'input',
        name: 'expertise',
        message: 'What specific techniques, tools, or frameworks should it know?',
        validate: (input: string) => input.trim().length > 0 || 'Expertise is required.',
      },
      {
        type: 'input',
        name: 'boundaries',
        message: 'What should it explicitly NOT handle? (optional)',
        default: '',
      },
    ]);

    // Phase 3: Communication Style
    console.log('\n  -- Communication Style --\n');

    const phase3 = await inquirer.prompt<{
      tone: string;
      verbosity: string;
      communicationRules: string;
    }>([
      {
        type: 'list',
        name: 'tone',
        message: 'What tone should it use?',
        choices: TONE_CHOICES,
      },
      {
        type: 'list',
        name: 'verbosity',
        message: 'How verbose should responses be?',
        choices: VERBOSITY_CHOICES,
      },
      {
        type: 'input',
        name: 'communicationRules',
        message: 'Any specific communication rules? (optional)',
        default: '',
      },
    ]);

    // Phase 4: Process & Workflow
    console.log('\n  -- Process & Workflow --\n');

    const phase4 = await inquirer.prompt<{
      workflow: string;
      uncertainty: string;
    }>([
      {
        type: 'input',
        name: 'workflow',
        message: 'Describe its ideal workflow when given a task (optional)',
        default: '',
      },
      {
        type: 'list',
        name: 'uncertainty',
        message: 'How should it handle uncertainty?',
        choices: UNCERTAINTY_CHOICES,
      },
    ]);

    // Phase 5: Constraints
    console.log('\n  -- Constraints --\n');

    const phase5 = await inquirer.prompt<{
      alwaysDo: string;
      neverDo: string;
    }>([
      {
        type: 'input',
        name: 'alwaysDo',
        message: 'What should it ALWAYS do? (optional)',
        default: '',
      },
      {
        type: 'input',
        name: 'neverDo',
        message: 'What should it NEVER do? (optional)',
        default: '',
      },
    ]);

    return {
      description: phase1.description.trim(),
      domains,
      archetype: phase1.archetype,
      expertise: phase2.expertise.trim(),
      boundaries: phase2.boundaries.trim(),
      tone: phase3.tone,
      verbosity: phase3.verbosity,
      communicationRules: phase3.communicationRules.trim(),
      workflow: phase4.workflow.trim(),
      uncertainty: phase4.uncertainty,
      alwaysDo: phase5.alwaysDo.trim(),
      neverDo: phase5.neverDo.trim(),
    };
  }

  buildGenerationPrompt(name: string, answers: AgentAnswers, feedback?: string): string {
    const lines: string[] = [];

    lines.push(`You are an expert AI agent designer. Create a complete identity.md file for a new AI agent called "${name}".`);
    lines.push('');
    lines.push('The identity.md will be injected as a system prompt when this agent is activated via Claude Code. It defines who the agent is, how it thinks, and how it works.');
    lines.push('');
    lines.push('## Requirements');
    lines.push('');
    lines.push(`**Name:** ${name}`);
    lines.push(`**Mission:** ${answers.description}`);
    lines.push(`**Domains:** ${answers.domains.join(', ')}`);
    lines.push(`**Archetype:** ${answers.archetype}`);
    lines.push(`**Expertise:** ${answers.expertise}`);
    lines.push(`**Tone:** ${answers.tone}`);
    lines.push(`**Verbosity:** ${answers.verbosity}`);
    lines.push(`**When Uncertain:** ${answers.uncertainty}`);

    if (answers.boundaries) {
      lines.push(`**Boundaries (out of scope):** ${answers.boundaries}`);
    }
    if (answers.communicationRules) {
      lines.push(`**Communication Rules:** ${answers.communicationRules}`);
    }
    if (answers.workflow) {
      lines.push(`**Workflow:** ${answers.workflow}`);
    }
    if (answers.alwaysDo) {
      lines.push(`**Always Do:** ${answers.alwaysDo}`);
    }
    if (answers.neverDo) {
      lines.push(`**Never Do:** ${answers.neverDo}`);
    }

    lines.push('');
    lines.push('## Format');
    lines.push('');
    lines.push('Generate the identity.md with exactly these sections:');
    lines.push('');
    lines.push(`# ${name}`);
    lines.push('');
    lines.push('## Personality');
    lines.push('2-3 sentences defining character, approach, and values. Be specific — concrete descriptors, not vague adjectives.');
    lines.push('');
    lines.push('## Strategy');
    lines.push('3-7 numbered steps of the primary workflow. Each step: **Bold Name** — explanation with specific techniques from the expertise.');
    lines.push('');
    lines.push('## Skill Directives');
    lines.push('5-10 bullet points of actionable behavioral rules. Concrete enough to evaluate ("Did the agent follow this rule?").');
    lines.push('');
    lines.push('## Context References');
    lines.push('- Product/domain knowledge files in /context/');
    lines.push('- Previous battle performance in /history/stats.json');
    lines.push('');
    lines.push('## Guidelines');
    lines.push('');
    lines.push('- Include specific techniques and frameworks from the expertise field');
    lines.push('- Match the requested tone and verbosity');
    lines.push('- The archetype shapes the overall stance (Specialist = deep narrow focus, Generalist = breadth, etc.)');
    lines.push('- Keep the identity under 50 lines — concise but complete');
    lines.push('- Do NOT include code blocks, JSON, or metadata');
    lines.push('');
    lines.push('Output ONLY the raw markdown content. No preamble, no explanation, no wrapping.');

    if (feedback) {
      lines.push('');
      lines.push('## Feedback on Previous Version');
      lines.push('');
      lines.push(`The user wants these changes: ${feedback}`);
    }

    return lines.join('\n');
  }

  buildSkeletonIdentity(name: string, answers: AgentAnswers): string {
    const lines: string[] = [];
    lines.push(`# ${name}`);
    lines.push('');
    lines.push('## Personality');
    lines.push(`You are a ${answers.tone.toLowerCase()}, ${answers.archetype.toLowerCase()} agent. ${answers.description}`);
    lines.push('');
    lines.push('## Strategy');
    if (answers.workflow) {
      lines.push(answers.workflow);
    } else {
      lines.push('1. **Understand** — Analyze the task requirements');
      lines.push('2. **Plan** — Outline approach before executing');
      lines.push('3. **Execute** — Implement the solution');
      lines.push('4. **Verify** — Confirm the result meets requirements');
    }
    lines.push('');
    lines.push('## Skill Directives');
    lines.push(`- Expertise: ${answers.expertise}`);
    if (answers.communicationRules) {
      lines.push(`- ${answers.communicationRules}`);
    }
    lines.push(`- When uncertain: ${answers.uncertainty}`);
    lines.push('');
    lines.push('## Context References');
    lines.push('- Domain knowledge files in /context/');
    lines.push('- Previous battle performance in /history/stats.json');
    lines.push('');
    return lines.join('\n');
  }

  async generateIdentity(name: string, answers: AgentAnswers, feedback?: string): Promise<string> {
    const prompt = this.buildGenerationPrompt(name, answers, feedback);
    const args = ['--print'];
    const result = await this.bridge.runAndCapture(args, 120_000, prompt);
    return result.trim();
  }

  async reviewLoop(identity: string, name: string, answers: AgentAnswers): Promise<string> {
    const { default: inquirer } = await import('inquirer');
    let current = identity;

    while (true) {
      console.log('\n  =======================================');
      console.log('    Generated Identity Preview');
      console.log('  =======================================\n');
      console.log(current);
      console.log('\n  =======================================\n');

      const { action } = await inquirer.prompt<{ action: string }>([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: 'Approve — save this identity', value: 'approve' },
            { name: 'Edit — open in $EDITOR for manual changes', value: 'edit' },
            { name: 'Regenerate — generate again with feedback', value: 'regenerate' },
            { name: 'Cancel — abort agent creation', value: 'cancel' },
          ],
        },
      ]);

      if (action === 'approve') {
        return current;
      }

      if (action === 'cancel') {
        throw new Error('Agent creation cancelled by user.');
      }

      if (action === 'edit') {
        current = await this.openInEditor(current);
      }

      if (action === 'regenerate') {
        const { userFeedback } = await inquirer.prompt<{ userFeedback: string }>([
          {
            type: 'input',
            name: 'userFeedback',
            message: 'What should be different?',
            validate: (input: string) => input.trim().length > 0 || 'Please provide feedback.',
          },
        ]);

        console.log('\nRegenerating...\n');
        try {
          current = await this.generateIdentity(name, answers, userFeedback);
        } catch {
          console.error('Regeneration failed. Keeping previous version.');
        }
      }
    }
  }

  private async openInEditor(content: string): Promise<string> {
    const tmpPath = join(tmpdir(), `miyagi-identity-${Date.now()}.md`);
    writeFileSync(tmpPath, content, 'utf-8');

    const editor = process.env.EDITOR || process.env.VISUAL || 'vi';
    await new Promise<void>((resolve, reject) => {
      const child = spawn(editor, [tmpPath], { stdio: 'inherit' });
      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Editor exited with code ${code}`));
      });
      child.on('error', reject);
    });

    const result = readFileSync(tmpPath, 'utf-8');
    try { unlinkSync(tmpPath); } catch { /* ignore */ }
    return result;
  }

  async run(name: string): Promise<{ identity: string; description: string; domains: string[] }> {
    const answers = await this.gatherInput();

    console.log('\nGenerating identity with Claude...\n');

    let identity: string;
    try {
      identity = await this.generateIdentity(name, answers);
    } catch {
      console.error('Failed to generate identity with Claude. Using skeleton identity instead.\n');
      identity = this.buildSkeletonIdentity(name, answers);
    }

    identity = await this.reviewLoop(identity, name, answers);

    return {
      identity,
      description: answers.description,
      domains: answers.domains,
    };
  }
}
