import { randomUUID } from 'crypto';
import { readFileSync, mkdtempSync, rmSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { tmpdir } from 'os';

const CODE_EXTENSIONS = new Set([
  '.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.go', '.rs', '.rb',
  '.c', '.cpp', '.h', '.cs', '.php', '.swift', '.kt', '.scala',
  '.sh', '.bash', '.sql', '.html', '.css', '.json', '.yaml', '.yml',
  '.md', '.txt', '.toml', '.cfg', '.ini',
]);

function collectGeneratedFiles(dir: string, maxTotalSize = 30_000): string {
  const files: Array<{ path: string; content: string }> = [];
  let totalSize = 0;

  function walk(currentDir: string, prefix: string): void {
    let entries;
    try { entries = readdirSync(currentDir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const BLACKLIST_DIRS = new Set(['.omc', 'node_modules', '__pycache__', '.git', '.venv', 'venv', '.tox', '.mypy_cache', '.pytest_cache', 'dist', 'build', '.next', '.nuxt', 'coverage', '.cache']);
      const BLACKLIST_FILES = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'poetry.lock', 'Pipfile.lock', '.DS_Store', 'thumbs.db']);
      if (BLACKLIST_DIRS.has(entry.name)) continue;
      const fullPath = join(currentDir, entry.name);
      const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(fullPath, relPath);
      } else if (entry.isFile() && CODE_EXTENSIONS.has(extname(entry.name).toLowerCase()) && !BLACKLIST_FILES.has(entry.name)) {
        try {
          const size = statSync(fullPath).size;
          if (size > 5_000 || totalSize + size > maxTotalSize) continue;
          const content = readFileSync(fullPath, 'utf-8');
          files.push({ path: relPath, content });
          totalSize += size;
        } catch { /* skip unreadable */ }
      }
    }
  }

  walk(dir, '');
  if (files.length === 0) return '';

  let result = '\n\n--- Actual Generated Files ---\n';
  for (const f of files) {
    result += `\n<file path="${f.path}">\n${f.content}\n</file>\n`;
  }
  return result;
}
import type {
  BattleConfig, BattleMode, BattleRound, BattleResult, BattleProgressCallback,
} from '../types/index.js';
import type { AgentManager } from '../core/agent-manager.js';
import type { ClaudeBridge } from '../core/claude-bridge.js';
import { BattleMediator } from './mediator.js';
import { getModeConfig } from './modes/index.js';
import { parsePlan, mapStepsToRounds, buildPlanningPrompt, buildExecutionPrompt } from './planner.js';

const VALID_MODES: Set<string> = new Set([
  'same-task', 'code-challenge', 'iterative-refinement', 'speed-run',
  'debate', 'sales-roleplay', 'negotiation', 'review-duel',
  'interview', 'support-ticket',
]);

const DEFAULT_ROUNDS: Record<BattleMode, number> = {
  'same-task': 1,
  'code-challenge': 1,
  'iterative-refinement': 3,
  'speed-run': 1,
  'debate': 5,
  'sales-roleplay': 10,
  'negotiation': 8,
  'review-duel': 2,
  'interview': 6,
  'support-ticket': 4,
};

interface CreateConfigOptions {
  agentA: string;
  agentB: string;
  mode: BattleMode;
  task?: string;
  topic?: string;
  maxRounds?: number;
  background?: boolean;
}

export class BattleEngine {
  createConfig(options: CreateConfigOptions): BattleConfig {
    this.validateMode(options.mode);

    return {
      id: randomUUID(),
      mode: options.mode,
      agentA: options.agentA,
      agentB: options.agentB,
      task: options.task,
      topic: options.topic,
      maxRounds: options.maxRounds ?? DEFAULT_ROUNDS[options.mode],
      background: options.background ?? false,
      startedAt: new Date().toISOString(),
    };
  }

  validateMode(mode: string): void {
    if (!VALID_MODES.has(mode)) {
      throw new Error(`Invalid battle mode: "${mode}". Valid modes: ${[...VALID_MODES].join(', ')}`);
    }
  }

  assembleResult(
    config: BattleConfig,
    rounds: BattleRound[],
    terminationReason: BattleResult['terminationReason'],
  ): BattleResult {
    return {
      config,
      rounds,
      endedAt: new Date().toISOString(),
      terminationReason,
    };
  }

  async runSymmetric(
    config: BattleConfig,
    agentManager: AgentManager,
    bridge: ClaudeBridge,
    effort?: string,
    onProgress?: BattleProgressCallback,
  ): Promise<BattleResult> {
    const agentA = await agentManager.get(config.agentA);
    const agentB = await agentManager.get(config.agentB);
    if (!agentA) throw new Error(`Agent "${config.agentA}" not found`);
    if (!agentB) throw new Error(`Agent "${config.agentB}" not found`);

    const identityA = readFileSync(agentA.identityPath, 'utf-8');
    const identityB = readFileSync(agentB.identityPath, 'utf-8');

    const rounds: BattleRound[] = [];
    const modeConfig = getModeConfig(config.mode);
    const taskLabel = config.task ?? config.topic ?? 'Complete the task.';

    // Persistent workspace per agent — files accumulate across rounds
    const tempDirA = mkdtempSync(join(tmpdir(), 'miyagi-battle-'));
    const tempDirB = mkdtempSync(join(tmpdir(), 'miyagi-battle-'));

    try {
      // Phase 0: Planning
      if (onProgress) onProgress({ phase: 'setup', type: 'info', message: 'Planning phase' });

      const planningPrompt = buildPlanningPrompt(taskLabel, modeConfig.name, modeConfig.description, config.maxRounds);
      const planOptsA = { systemPrompt: identityA, prompt: planningPrompt, effort, dangerouslySkipPermissions: true };
      const planOptsB = { systemPrompt: identityB, prompt: planningPrompt, effort, dangerouslySkipPermissions: true };

      const planDirA = mkdtempSync(join(tmpdir(), 'miyagi-plan-'));
      const planDirB = mkdtempSync(join(tmpdir(), 'miyagi-plan-'));

      let rawPlanA: string;
      let rawPlanB: string;
      try {
        [rawPlanA, rawPlanB] = await Promise.all([
          bridge.runAndCapture(bridge.buildBattleArgs(planOptsA), 120_000, bridge.buildBattleStdin(planOptsA), planDirA),
          bridge.runAndCapture(bridge.buildBattleArgs(planOptsB), 120_000, bridge.buildBattleStdin(planOptsB), planDirB),
        ]);
      } finally {
        rmSync(planDirA, { recursive: true, force: true });
        rmSync(planDirB, { recursive: true, force: true });
      }

      const planA = parsePlan(rawPlanA);
      const planB = parsePlan(rawPlanB);

      const hasPlanA = planA.steps.length > 0;
      const hasPlanB = planB.steps.length > 0;

      const roundAssignmentsA = hasPlanA ? mapStepsToRounds(planA.steps, config.maxRounds) : [];
      const roundAssignmentsB = hasPlanB ? mapStepsToRounds(planB.steps, config.maxRounds) : [];

      // Phase 1-N: Execution
      for (let round = 1; round <= config.maxRounds; round++) {
        if (onProgress) onProgress({ phase: 'round', type: 'start', round, totalRounds: config.maxRounds, message: taskLabel });

        const previousOutputsA = round > 1 ? rounds[round - 2].agentAResponse : undefined;
        const previousOutputsB = round > 1 ? rounds[round - 2].agentBResponse : undefined;

        let taskPromptA: string;
        let taskPromptB: string;

        if (hasPlanA) {
          taskPromptA = buildExecutionPrompt({
            taskLabel,
            plan: planA,
            assignedSteps: roundAssignmentsA[round - 1] ?? [],
            round,
            maxRounds: config.maxRounds,
            previousOutputs: previousOutputsA,
          });
        } else {
          taskPromptA = round === 1 ? taskLabel :
            `${taskLabel}\n\nPrevious round output:\n${config.agentA}: ${rounds[round - 2].agentAResponse}\n${config.agentB}: ${rounds[round - 2].agentBResponse}\n\nContinue and improve on the above.`;
        }

        if (hasPlanB) {
          taskPromptB = buildExecutionPrompt({
            taskLabel,
            plan: planB,
            assignedSteps: roundAssignmentsB[round - 1] ?? [],
            round,
            maxRounds: config.maxRounds,
            previousOutputs: previousOutputsB,
          });
        } else {
          taskPromptB = round === 1 ? taskLabel :
            `${taskLabel}\n\nPrevious round output:\n${config.agentA}: ${rounds[round - 2].agentAResponse}\n${config.agentB}: ${rounds[round - 2].agentBResponse}\n\nContinue and improve on the above.`;
        }

        const optsA = { systemPrompt: identityA, prompt: taskPromptA, effort, dangerouslySkipPermissions: true };
        const optsB = { systemPrompt: identityB, prompt: taskPromptB, effort, dangerouslySkipPermissions: true };

        if (onProgress) onProgress({ phase: 'round', type: 'info', agent: config.agentA, round });
        if (onProgress) onProgress({ phase: 'round', type: 'info', agent: config.agentB, round });

        const startTime = Date.now();
        const [resultA, resultB] = await Promise.all([
          bridge.runAndCapture(bridge.buildBattleArgs(optsA), 600_000, bridge.buildBattleStdin(optsA), tempDirA)
            .then(r => ({ response: r, elapsedMs: Date.now() - startTime })),
          bridge.runAndCapture(bridge.buildBattleArgs(optsB), 600_000, bridge.buildBattleStdin(optsB), tempDirB)
            .then(r => ({ response: r, elapsedMs: Date.now() - startTime })),
        ]);
        const rawResponseA = resultA.response;
        const rawResponseB = resultB.response;
        if (onProgress) onProgress({ phase: 'round', type: 'complete', agent: config.agentA, round, elapsedMs: resultA.elapsedMs, message: rawResponseA });
        if (onProgress) onProgress({ phase: 'round', type: 'complete', agent: config.agentB, round, elapsedMs: resultB.elapsedMs, message: rawResponseB });

        rounds.push({ round, agentAResponse: rawResponseA, agentBResponse: rawResponseB, timestamp: new Date().toISOString() });
      }

      // Collect final state of generated files (cumulative across all rounds)
      const filesA = collectGeneratedFiles(tempDirA);
      const filesB = collectGeneratedFiles(tempDirB);
      if (filesA || filesB) {
        const lastRound = rounds[rounds.length - 1];
        lastRound.agentAResponse += filesA;
        lastRound.agentBResponse += filesB;
      }

      const result = this.assembleResult(config, rounds, 'round-limit');
      if (hasPlanA) result.planA = planA;
      if (hasPlanB) result.planB = planB;
      return result;
    } finally {
      rmSync(tempDirA, { recursive: true, force: true });
      rmSync(tempDirB, { recursive: true, force: true });
    }
  }

  async runAsymmetric(
    config: BattleConfig,
    agentManager: AgentManager,
    bridge: ClaudeBridge,
    effort?: string,
    onProgress?: BattleProgressCallback,
  ): Promise<BattleResult> {
    const agentA = await agentManager.get(config.agentA);
    const agentB = await agentManager.get(config.agentB);
    if (!agentA) throw new Error(`Agent "${config.agentA}" not found`);
    if (!agentB) throw new Error(`Agent "${config.agentB}" not found`);

    const identityA = readFileSync(agentA.identityPath, 'utf-8');
    const identityB = readFileSync(agentB.identityPath, 'utf-8');

    const mediator = new BattleMediator();
    const modeConfig = getModeConfig(config.mode);
    const rolePrompts = mediator.buildRolePrompts(modeConfig, config.topic ?? config.task);

    const history: { role: string; content: string }[] = [];
    const rounds: BattleRound[] = [];
    let terminationReason: BattleResult['terminationReason'] = 'round-limit';

    const tempDirA = mkdtempSync(join(tmpdir(), 'miyagi-battle-'));
    const tempDirB = mkdtempSync(join(tmpdir(), 'miyagi-battle-'));

    try {
      for (let round = 1; round <= config.maxRounds; round++) {
        const taskLabel = config.topic ?? config.task ?? modeConfig.description;
        if (onProgress) onProgress({ phase: 'round', type: 'start', round, totalRounds: config.maxRounds, message: taskLabel });

        const turnPromptA = mediator.buildTurnPrompt(rolePrompts.agentA, history, round, config.maxRounds);
        const optsA = { systemPrompt: identityA, prompt: turnPromptA, effort, dangerouslySkipPermissions: true };
        if (onProgress) onProgress({ phase: 'round', type: 'info', agent: config.agentA, round });
        const startA = Date.now();
        const rawResponseA = await bridge.runAndCapture(
          bridge.buildBattleArgs(optsA), undefined, bridge.buildBattleStdin(optsA), tempDirA,
        );
        if (onProgress) onProgress({ phase: 'round', type: 'complete', agent: config.agentA, round, elapsedMs: Date.now() - startA, message: rawResponseA });
        const responseA = rawResponseA + collectGeneratedFiles(tempDirA);
        history.push({ role: config.agentA, content: responseA });

        if (mediator.isNaturalEnd(rawResponseA)) {
          rounds.push({ round, agentAResponse: responseA, agentBResponse: '', timestamp: new Date().toISOString() });
          terminationReason = 'natural';
          break;
        }

        const turnPromptB = mediator.buildTurnPrompt(rolePrompts.agentB, history, round, config.maxRounds);
        const asymOptsB = { systemPrompt: identityB, prompt: turnPromptB, effort, dangerouslySkipPermissions: true };
        if (onProgress) onProgress({ phase: 'round', type: 'info', agent: config.agentB, round });
        const startB = Date.now();
        const rawResponseB = await bridge.runAndCapture(
          bridge.buildBattleArgs(asymOptsB), undefined, bridge.buildBattleStdin(asymOptsB), tempDirB,
        );
        if (onProgress) onProgress({ phase: 'round', type: 'complete', agent: config.agentB, round, elapsedMs: Date.now() - startB, message: rawResponseB });
        const responseB = rawResponseB + collectGeneratedFiles(tempDirB);
        history.push({ role: config.agentB, content: responseB });

        rounds.push({ round, agentAResponse: responseA, agentBResponse: responseB, timestamp: new Date().toISOString() });

        if (mediator.isNaturalEnd(responseB)) {
          terminationReason = 'natural';
          break;
        }
      }
    } finally {
      rmSync(tempDirA, { recursive: true, force: true });
      rmSync(tempDirB, { recursive: true, force: true });
    }

    return this.assembleResult(config, rounds, terminationReason);
  }
}
