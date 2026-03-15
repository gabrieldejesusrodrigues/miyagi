# Miyagi CLI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an npm-installable CLI that wraps Claude Code to provide agent creation, skill management, battle training, and coaching.

**Architecture:** TypeScript CLI using Commander.js for routing, Inquirer.js for interactive prompts, Ink for TUI rendering. Wraps `claude` CLI via child_process. Agents stored as markdown + JSON in `~/.miyagi/` (global) and `.miyagi/` (project-local). Battle system spawns parallel Claude processes with a Judge and Coach pipeline.

**Tech Stack:** TypeScript, Commander.js, Inquirer.js, Ink, simple-git, tar/archiver, Handlebars, Chart.js, Vitest, tsup, pnpm

**Design Doc:** `docs/plans/2026-03-14-miyagi-cli-design.md`

---

## Phase 1: Project Scaffolding & Core Types

### Task 1: Initialize project and build toolchain

**Files:**
- Create: `miyagi/package.json`
- Create: `miyagi/tsconfig.json`
- Create: `miyagi/tsup.config.ts`
- Create: `miyagi/.gitignore`
- Create: `miyagi/bin/miyagi.ts`

**Step 1: Create project directory and initialize**

```bash
mkdir -p ~/miyagi && cd ~/miyagi
pnpm init
```

**Step 2: Install dependencies**

```bash
pnpm add commander inquirer chalk ora simple-git handlebars tar archiver
pnpm add -D typescript vitest tsup @types/node @types/inquirer @types/tar @types/archiver
```

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*", "bin/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Step 4: Create tsup.config.ts**

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['bin/miyagi.ts'],
  format: ['esm'],
  target: 'node18',
  outDir: 'dist/bin',
  clean: true,
  sourcemap: true,
  dts: false,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
```

**Step 5: Create bin/miyagi.ts entry point**

```typescript
import { createProgram } from '../src/cli/program.js';

const program = createProgram();
program.parse(process.argv);
```

**Step 6: Update package.json**

Add to package.json:
```json
{
  "name": "miyagi",
  "version": "0.1.0",
  "description": "Agent & Skill Trainer for Claude Code",
  "type": "module",
  "bin": {
    "miyagi": "./dist/bin/miyagi.js"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit"
  },
  "engines": {
    "node": ">=18"
  }
}
```

**Step 7: Create .gitignore**

```
node_modules/
dist/
*.tgz
.DS_Store
```

**Step 8: Initialize git and commit**

```bash
cd ~/miyagi
git init
git add .
git commit -m "chore: initialize miyagi project scaffolding"
```

---

### Task 2: Define core types and interfaces

**Files:**
- Create: `miyagi/src/types/agent.ts`
- Create: `miyagi/src/types/skill.ts`
- Create: `miyagi/src/types/battle.ts`
- Create: `miyagi/src/types/scoring.ts`
- Create: `miyagi/src/types/config.ts`
- Create: `miyagi/src/types/index.ts`
- Test: `miyagi/tests/unit/types.test.ts`

**Step 1: Write type validation tests**

```typescript
// tests/unit/types.test.ts
import { describe, it, expect } from 'vitest';
import {
  validateManifest,
  validateStatsJson,
  validateInstalledSkills,
} from '../src/utils/validators.js';

describe('Manifest validation', () => {
  it('accepts a valid manifest', () => {
    const manifest = {
      name: 'sales-agent',
      version: '1.0.0',
      author: 'gabriel',
      templateOrigin: 'salesman',
      createdAt: '2026-03-14T00:00:00Z',
    };
    expect(validateManifest(manifest)).toEqual({ valid: true, errors: [] });
  });

  it('rejects manifest without name', () => {
    const manifest = { version: '1.0.0' };
    const result = validateManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('name is required');
  });
});

describe('Stats JSON validation', () => {
  it('accepts valid stats', () => {
    const stats = {
      agent: 'test-agent',
      elo: { sales: 1200 },
      dimensions: {},
      battles: { total: 0, record: { wins: 0, losses: 0, draws: 0 } },
      coachNotes: [],
    };
    expect(validateStatsJson(stats)).toEqual({ valid: true, errors: [] });
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd ~/miyagi && pnpm test -- tests/unit/types.test.ts
```

Expected: FAIL — modules not found

**Step 3: Create type definitions**

```typescript
// src/types/agent.ts
export interface AgentManifest {
  name: string;
  version: string;
  author: string;
  templateOrigin?: string;
  createdAt: string;
  updatedAt?: string;
  description?: string;
  domains?: string[];
}

export interface Agent {
  name: string;
  manifest: AgentManifest;
  identityPath: string;
  contextDir: string;
  skillsDir: string;
  historyDir: string;
  rootDir: string;
  scope: 'global' | 'project';
}

export interface InstalledSkillEntry {
  name: string;
  source: string;
  installedAt: string;
  version?: string;
}
```

```typescript
// src/types/skill.ts
export interface SkillMetadata {
  name: string;
  description: string;
  internal?: boolean;
}

export interface AgentSkill {
  name: string;
  metadata: SkillMetadata;
  path: string;
  type: 'installed' | 'custom';
  source?: string;
}
```

```typescript
// src/types/battle.ts
export type BattleType = 'symmetric' | 'asymmetric';

export type BattleMode =
  | 'same-task'
  | 'code-challenge'
  | 'iterative-refinement'
  | 'speed-run'
  | 'debate'
  | 'sales-roleplay'
  | 'negotiation'
  | 'review-duel'
  | 'interview'
  | 'support-ticket';

export interface BattleModeConfig {
  name: BattleMode;
  type: BattleType;
  description: string;
  defaultRounds: number;
  roles?: { agentA: string; agentB: string };
}

export interface BattleConfig {
  id: string;
  mode: BattleMode;
  agentA: string;
  agentB: string;
  task?: string;
  topic?: string;
  maxRounds: number;
  background: boolean;
  startedAt: string;
}

export interface BattleRound {
  round: number;
  agentAResponse: string;
  agentBResponse: string;
  timestamp: string;
}

export interface BattleResult {
  config: BattleConfig;
  rounds: BattleRound[];
  endedAt: string;
  terminationReason: 'natural' | 'round-limit' | 'user-stopped' | 'judge-called';
}
```

```typescript
// src/types/scoring.ts
export interface DimensionScore {
  current: number;
  history: number[];
  trend: 'up' | 'down' | 'stable';
}

export interface AgentStats {
  agent: string;
  elo: Record<string, number>;
  dimensions: Record<string, DimensionScore>;
  battles: {
    total: number;
    record: { wins: number; losses: number; draws: number };
  };
  coachNotes: Array<{ date: string; note: string }>;
  lastBattle?: string;
}

export interface JudgeVerdict {
  winner: string | 'draw';
  reason: string;
  narrative: string;
  agentAAnalysis: AgentAnalysis;
  agentBAnalysis: AgentAnalysis;
  comparativeAnalysis: string;
  coachingPriorities: {
    agentA: string[];
    agentB: string[];
  };
}

export interface AgentAnalysis {
  agent: string;
  strengths: string[];
  weaknesses: string[];
  missedOpportunities: string[];
  dimensionScores: Record<string, number>;
}
```

```typescript
// src/types/config.ts
export interface MiyagiConfig {
  defaultModel?: string;
  claudePath?: string;
  reportsDir?: string;
  defaultBattleRounds?: number;
}

export interface SessionEntry {
  id: string;
  agent: string;
  startedAt: string;
  endedAt?: string;
  claudeSessionId?: string;
}
```

```typescript
// src/types/index.ts
export * from './agent.js';
export * from './skill.js';
export * from './battle.js';
export * from './scoring.js';
export * from './config.js';
```

**Step 4: Create validators**

```typescript
// src/utils/validators.ts
import type { AgentManifest, AgentStats } from '../types/index.js';

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateManifest(data: unknown): ValidationResult {
  const errors: string[] = [];
  const obj = data as Record<string, unknown>;

  if (!obj || typeof obj !== 'object') {
    return { valid: false, errors: ['manifest must be an object'] };
  }
  if (typeof obj.name !== 'string' || !obj.name) {
    errors.push('name is required');
  }
  if (typeof obj.version !== 'string' || !obj.version) {
    errors.push('version is required');
  }

  return { valid: errors.length === 0, errors };
}

export function validateStatsJson(data: unknown): ValidationResult {
  const errors: string[] = [];
  const obj = data as Record<string, unknown>;

  if (!obj || typeof obj !== 'object') {
    return { valid: false, errors: ['stats must be an object'] };
  }
  if (typeof obj.agent !== 'string') errors.push('agent is required');
  if (!obj.elo || typeof obj.elo !== 'object') errors.push('elo is required');
  if (!obj.battles || typeof obj.battles !== 'object') errors.push('battles is required');

  return { valid: errors.length === 0, errors };
}

export function validateInstalledSkills(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(data)) {
    return { valid: false, errors: ['installed skills must be an array'] };
  }

  for (const [i, entry] of data.entries()) {
    if (typeof entry.name !== 'string') errors.push(`entry[${i}].name is required`);
    if (typeof entry.source !== 'string') errors.push(`entry[${i}].source is required`);
  }

  return { valid: errors.length === 0, errors };
}
```

**Step 5: Run tests to verify they pass**

```bash
cd ~/miyagi && pnpm test -- tests/unit/types.test.ts
```

Expected: PASS

**Step 6: Commit**

```bash
git add src/types/ src/utils/validators.ts tests/unit/types.test.ts
git commit -m "feat: define core types and validators"
```

---

## Phase 2: Core Infrastructure

### Task 3: Config manager

**Files:**
- Create: `miyagi/src/core/config.ts`
- Test: `miyagi/tests/unit/config.test.ts`

**Step 1: Write failing tests**

```typescript
// tests/unit/config.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigManager } from '../../src/core/config.js';
import { mkdtempSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ConfigManager', () => {
  let tempDir: string;
  let configManager: ConfigManager;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'miyagi-test-'));
    configManager = new ConfigManager(tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('initializes default config when none exists', () => {
    const config = configManager.load();
    expect(config.defaultModel).toBeUndefined();
    expect(config.claudePath).toBeUndefined();
  });

  it('saves and loads config', () => {
    configManager.save({ defaultModel: 'opus', claudePath: '/usr/bin/claude' });
    const config = configManager.load();
    expect(config.defaultModel).toBe('opus');
    expect(config.claudePath).toBe('/usr/bin/claude');
  });

  it('creates miyagi directory structure on init', () => {
    configManager.ensureDirectories();
    const fs = require('fs');
    expect(fs.existsSync(join(tempDir, 'agents'))).toBe(true);
    expect(fs.existsSync(join(tempDir, 'templates'))).toBe(true);
    expect(fs.existsSync(join(tempDir, 'reports'))).toBe(true);
  });
});
```

**Step 2: Run tests — verify fail**

```bash
cd ~/miyagi && pnpm test -- tests/unit/config.test.ts
```

**Step 3: Implement ConfigManager**

```typescript
// src/core/config.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { MiyagiConfig } from '../types/index.js';

export class ConfigManager {
  private readonly rootDir: string;
  private readonly configPath: string;

  constructor(rootDir?: string) {
    this.rootDir = rootDir ?? join(homedir(), '.miyagi');
    this.configPath = join(this.rootDir, 'config.json');
  }

  get root(): string {
    return this.rootDir;
  }

  get agentsDir(): string {
    return join(this.rootDir, 'agents');
  }

  get templatesDir(): string {
    return join(this.rootDir, 'templates');
  }

  get reportsDir(): string {
    return join(this.rootDir, 'reports');
  }

  ensureDirectories(): void {
    const dirs = [
      this.rootDir,
      this.agentsDir,
      this.templatesDir,
      this.reportsDir,
    ];
    for (const dir of dirs) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
  }

  load(): MiyagiConfig {
    if (!existsSync(this.configPath)) {
      return {};
    }
    const raw = readFileSync(this.configPath, 'utf-8');
    return JSON.parse(raw) as MiyagiConfig;
  }

  save(config: MiyagiConfig): void {
    this.ensureDirectories();
    writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
  }
}
```

**Step 4: Run tests — verify pass**

```bash
cd ~/miyagi && pnpm test -- tests/unit/config.test.ts
```

**Step 5: Commit**

```bash
git add src/core/config.ts tests/unit/config.test.ts
git commit -m "feat: add ConfigManager for miyagi settings"
```

---

### Task 4: Agent manager — CRUD operations

**Files:**
- Create: `miyagi/src/core/agent-manager.ts`
- Test: `miyagi/tests/unit/agent-manager.test.ts`

**Step 1: Write failing tests**

```typescript
// tests/unit/agent-manager.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AgentManager } from '../../src/core/agent-manager.js';
import { ConfigManager } from '../../src/core/config.js';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('AgentManager', () => {
  let tempDir: string;
  let agentManager: AgentManager;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'miyagi-test-'));
    const config = new ConfigManager(tempDir);
    config.ensureDirectories();
    agentManager = new AgentManager(config);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates an agent with correct directory structure', async () => {
    await agentManager.create('test-agent', {
      author: 'test',
      description: 'A test agent',
    });
    const agentDir = join(tempDir, 'agents', 'test-agent');
    expect(existsSync(join(agentDir, 'manifest.json'))).toBe(true);
    expect(existsSync(join(agentDir, 'identity.md'))).toBe(true);
    expect(existsSync(join(agentDir, 'context'))).toBe(true);
    expect(existsSync(join(agentDir, 'skills'))).toBe(true);
    expect(existsSync(join(agentDir, 'history'))).toBe(true);
  });

  it('creates default stats.json on agent creation', async () => {
    await agentManager.create('test-agent', { author: 'test' });
    const statsPath = join(tempDir, 'agents', 'test-agent', 'history', 'stats.json');
    const stats = JSON.parse(readFileSync(statsPath, 'utf-8'));
    expect(stats.agent).toBe('test-agent');
    expect(stats.elo).toEqual({});
    expect(stats.battles.total).toBe(0);
  });

  it('lists agents', async () => {
    await agentManager.create('agent-a', { author: 'test' });
    await agentManager.create('agent-b', { author: 'test' });
    const agents = await agentManager.list();
    expect(agents.map(a => a.name).sort()).toEqual(['agent-a', 'agent-b']);
  });

  it('gets an agent by name', async () => {
    await agentManager.create('my-agent', { author: 'test', description: 'hello' });
    const agent = await agentManager.get('my-agent');
    expect(agent).not.toBeNull();
    expect(agent!.manifest.name).toBe('my-agent');
  });

  it('returns null for non-existent agent', async () => {
    const agent = await agentManager.get('nonexistent');
    expect(agent).toBeNull();
  });

  it('deletes an agent', async () => {
    await agentManager.create('doomed-agent', { author: 'test' });
    await agentManager.delete('doomed-agent');
    const agent = await agentManager.get('doomed-agent');
    expect(agent).toBeNull();
  });

  it('clones an agent', async () => {
    await agentManager.create('original', { author: 'test' });
    await agentManager.clone('original', 'cloned');
    const cloned = await agentManager.get('cloned');
    expect(cloned).not.toBeNull();
    expect(cloned!.manifest.name).toBe('cloned');
  });

  it('throws when creating duplicate agent', async () => {
    await agentManager.create('dupe', { author: 'test' });
    await expect(agentManager.create('dupe', { author: 'test' }))
      .rejects.toThrow('Agent "dupe" already exists');
  });
});
```

**Step 2: Run tests — verify fail**

```bash
cd ~/miyagi && pnpm test -- tests/unit/agent-manager.test.ts
```

**Step 3: Implement AgentManager**

```typescript
// src/core/agent-manager.ts
import {
  existsSync, mkdirSync, readFileSync, writeFileSync,
  readdirSync, rmSync, cpSync,
} from 'fs';
import { join } from 'path';
import type { Agent, AgentManifest, AgentStats } from '../types/index.js';
import type { ConfigManager } from './config.js';

interface CreateOptions {
  author: string;
  description?: string;
  templateOrigin?: string;
}

export class AgentManager {
  private readonly config: ConfigManager;
  private readonly projectDir?: string;

  constructor(config: ConfigManager, projectDir?: string) {
    this.config = config;
    this.projectDir = projectDir;
  }

  async create(name: string, options: CreateOptions): Promise<Agent> {
    const agentDir = join(this.config.agentsDir, name);

    if (existsSync(agentDir)) {
      throw new Error(`Agent "${name}" already exists`);
    }

    // Create directory structure
    mkdirSync(agentDir, { recursive: true });
    mkdirSync(join(agentDir, 'context'));
    mkdirSync(join(agentDir, 'skills'));
    mkdirSync(join(agentDir, 'history'));

    // Create manifest
    const manifest: AgentManifest = {
      name,
      version: '1.0.0',
      author: options.author,
      description: options.description,
      templateOrigin: options.templateOrigin,
      createdAt: new Date().toISOString(),
    };
    writeFileSync(join(agentDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

    // Create default identity.md
    const identity = `# ${name}\n\n## Personality\n\n## Strategy\n\n## Skill Directives\n\n## Context References\n`;
    writeFileSync(join(agentDir, 'identity.md'), identity);

    // Create default stats
    const stats: AgentStats = {
      agent: name,
      elo: {},
      dimensions: {},
      battles: { total: 0, record: { wins: 0, losses: 0, draws: 0 } },
      coachNotes: [],
    };
    writeFileSync(join(agentDir, 'history', 'stats.json'), JSON.stringify(stats, null, 2));

    // Create empty battles log
    writeFileSync(join(agentDir, 'history', 'battles.json'), '[]');

    // Create training log
    writeFileSync(join(agentDir, 'history', 'training-log.md'), `# Training Log — ${name}\n`);

    // Create installed skills registry
    writeFileSync(join(agentDir, '.installed-skills.json'), '[]');

    return this.buildAgent(name, agentDir, manifest, 'global');
  }

  async get(name: string): Promise<Agent | null> {
    // Check project-local first
    if (this.projectDir) {
      const projectAgentDir = join(this.projectDir, '.miyagi', 'agents', name);
      if (existsSync(projectAgentDir)) {
        const manifest = this.readManifest(projectAgentDir);
        return this.buildAgent(name, projectAgentDir, manifest, 'project');
      }
    }

    // Then check global
    const globalAgentDir = join(this.config.agentsDir, name);
    if (existsSync(globalAgentDir)) {
      const manifest = this.readManifest(globalAgentDir);
      return this.buildAgent(name, globalAgentDir, manifest, 'global');
    }

    return null;
  }

  async list(): Promise<Agent[]> {
    const agents: Agent[] = [];
    const seen = new Set<string>();

    // Project-local agents first (they override global)
    if (this.projectDir) {
      const projectAgentsDir = join(this.projectDir, '.miyagi', 'agents');
      if (existsSync(projectAgentsDir)) {
        for (const name of readdirSync(projectAgentsDir)) {
          const agentDir = join(projectAgentsDir, name);
          const manifest = this.readManifest(agentDir);
          agents.push(this.buildAgent(name, agentDir, manifest, 'project'));
          seen.add(name);
        }
      }
    }

    // Global agents
    if (existsSync(this.config.agentsDir)) {
      for (const name of readdirSync(this.config.agentsDir)) {
        if (seen.has(name)) continue;
        const agentDir = join(this.config.agentsDir, name);
        const manifest = this.readManifest(agentDir);
        agents.push(this.buildAgent(name, agentDir, manifest, 'global'));
      }
    }

    return agents;
  }

  async delete(name: string): Promise<void> {
    const agentDir = join(this.config.agentsDir, name);
    if (!existsSync(agentDir)) {
      throw new Error(`Agent "${name}" not found`);
    }
    rmSync(agentDir, { recursive: true, force: true });
  }

  async clone(sourceName: string, targetName: string): Promise<Agent> {
    const source = await this.get(sourceName);
    if (!source) {
      throw new Error(`Agent "${sourceName}" not found`);
    }

    const targetDir = join(this.config.agentsDir, targetName);
    if (existsSync(targetDir)) {
      throw new Error(`Agent "${targetName}" already exists`);
    }

    cpSync(source.rootDir, targetDir, { recursive: true });

    // Update manifest with new name
    const manifest = this.readManifest(targetDir);
    manifest.name = targetName;
    manifest.createdAt = new Date().toISOString();
    delete manifest.updatedAt;
    writeFileSync(join(targetDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

    // Update stats
    const statsPath = join(targetDir, 'history', 'stats.json');
    if (existsSync(statsPath)) {
      const stats = JSON.parse(readFileSync(statsPath, 'utf-8'));
      stats.agent = targetName;
      writeFileSync(statsPath, JSON.stringify(stats, null, 2));
    }

    return this.buildAgent(targetName, targetDir, manifest, 'global');
  }

  private readManifest(agentDir: string): AgentManifest {
    const manifestPath = join(agentDir, 'manifest.json');
    return JSON.parse(readFileSync(manifestPath, 'utf-8')) as AgentManifest;
  }

  private buildAgent(
    name: string,
    rootDir: string,
    manifest: AgentManifest,
    scope: 'global' | 'project',
  ): Agent {
    return {
      name,
      manifest,
      identityPath: join(rootDir, 'identity.md'),
      contextDir: join(rootDir, 'context'),
      skillsDir: join(rootDir, 'skills'),
      historyDir: join(rootDir, 'history'),
      rootDir,
      scope,
    };
  }
}
```

**Step 4: Run tests — verify pass**

```bash
cd ~/miyagi && pnpm test -- tests/unit/agent-manager.test.ts
```

**Step 5: Commit**

```bash
git add src/core/agent-manager.ts tests/unit/agent-manager.test.ts
git commit -m "feat: add AgentManager with CRUD operations"
```

---

### Task 5: Skill manager — skills.sh integration

**Files:**
- Create: `miyagi/src/core/skill-manager.ts`
- Test: `miyagi/tests/unit/skill-manager.test.ts`

**Step 1: Write failing tests**

```typescript
// tests/unit/skill-manager.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SkillManager } from '../../src/core/skill-manager.js';
import { AgentManager } from '../../src/core/agent-manager.js';
import { ConfigManager } from '../../src/core/config.js';
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('SkillManager', () => {
  let tempDir: string;
  let skillManager: SkillManager;
  let agentManager: AgentManager;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'miyagi-test-'));
    const config = new ConfigManager(tempDir);
    config.ensureDirectories();
    agentManager = new AgentManager(config);
    skillManager = new SkillManager(agentManager);
    await agentManager.create('test-agent', { author: 'test' });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('lists skills for an agent', async () => {
    const skills = await skillManager.list('test-agent');
    expect(skills).toEqual([]);
  });

  it('lists custom skills after manual creation', async () => {
    const agent = await agentManager.get('test-agent');
    const skillDir = join(agent!.skillsDir, 'miyagi-test-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: miyagi-test-skill\ndescription: test\n---\n# Test');

    const skills = await skillManager.list('test-agent');
    expect(skills.length).toBe(1);
    expect(skills[0].name).toBe('miyagi-test-skill');
    expect(skills[0].type).toBe('custom');
  });

  it('removes a skill from an agent', async () => {
    const agent = await agentManager.get('test-agent');
    const skillDir = join(agent!.skillsDir, 'miyagi-test-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: miyagi-test-skill\ndescription: test\n---\n# Test');

    await skillManager.remove('miyagi-test-skill', 'test-agent');
    expect(existsSync(skillDir)).toBe(false);
  });
});
```

**Step 2: Run tests — verify fail**

```bash
cd ~/miyagi && pnpm test -- tests/unit/skill-manager.test.ts
```

**Step 3: Implement SkillManager**

```typescript
// src/core/skill-manager.ts
import {
  existsSync, readdirSync, readFileSync, rmSync, writeFileSync,
} from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import type { AgentSkill, InstalledSkillEntry } from '../types/index.js';
import type { AgentManager } from './agent-manager.js';

export class SkillManager {
  private readonly agentManager: AgentManager;

  constructor(agentManager: AgentManager) {
    this.agentManager = agentManager;
  }

  async list(agentName: string): Promise<AgentSkill[]> {
    const agent = await this.agentManager.get(agentName);
    if (!agent) throw new Error(`Agent "${agentName}" not found`);

    const skills: AgentSkill[] = [];
    if (!existsSync(agent.skillsDir)) return skills;

    const installedSkills = this.readInstalledSkills(agent.rootDir);
    const installedNames = new Set(installedSkills.map(s => s.name));

    for (const entry of readdirSync(agent.skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillMdPath = join(agent.skillsDir, entry.name, 'SKILL.md');
      if (!existsSync(skillMdPath)) continue;

      const metadata = this.parseSkillMetadata(skillMdPath);
      skills.push({
        name: entry.name,
        metadata,
        path: join(agent.skillsDir, entry.name),
        type: installedNames.has(entry.name) ? 'installed' : 'custom',
        source: installedSkills.find(s => s.name === entry.name)?.source,
      });
    }

    return skills;
  }

  async install(source: string, agentName: string): Promise<void> {
    const agent = await this.agentManager.get(agentName);
    if (!agent) throw new Error(`Agent "${agentName}" not found`);

    // Use npx skills add to install into the agent's skills directory
    execSync(`npx skills add ${source} --copy`, {
      cwd: agent.skillsDir,
      stdio: 'inherit',
    });
  }

  async remove(skillName: string, agentName: string): Promise<void> {
    const agent = await this.agentManager.get(agentName);
    if (!agent) throw new Error(`Agent "${agentName}" not found`);

    const skillDir = join(agent.skillsDir, skillName);
    if (!existsSync(skillDir)) {
      throw new Error(`Skill "${skillName}" not found in agent "${agentName}"`);
    }

    rmSync(skillDir, { recursive: true, force: true });

    // Remove from installed skills registry if present
    const installed = this.readInstalledSkills(agent.rootDir);
    const updated = installed.filter(s => s.name !== skillName);
    this.writeInstalledSkills(agent.rootDir, updated);
  }

  async updateAll(agentName: string): Promise<void> {
    const agent = await this.agentManager.get(agentName);
    if (!agent) throw new Error(`Agent "${agentName}" not found`);

    const installed = this.readInstalledSkills(agent.rootDir);
    for (const skill of installed) {
      execSync(`npx skills add ${skill.source} --copy --yes`, {
        cwd: agent.skillsDir,
        stdio: 'inherit',
      });
    }
  }

  private parseSkillMetadata(skillMdPath: string): { name: string; description: string } {
    const content = readFileSync(skillMdPath, 'utf-8');
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

    if (!frontmatterMatch) {
      return { name: 'unknown', description: '' };
    }

    const frontmatter = frontmatterMatch[1];
    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
    const descMatch = frontmatter.match(/^description:\s*["']?(.+?)["']?\s*$/m);

    return {
      name: nameMatch?.[1]?.trim() ?? 'unknown',
      description: descMatch?.[1]?.trim() ?? '',
    };
  }

  private readInstalledSkills(agentRootDir: string): InstalledSkillEntry[] {
    const path = join(agentRootDir, '.installed-skills.json');
    if (!existsSync(path)) return [];
    return JSON.parse(readFileSync(path, 'utf-8'));
  }

  private writeInstalledSkills(agentRootDir: string, entries: InstalledSkillEntry[]): void {
    const path = join(agentRootDir, '.installed-skills.json');
    writeFileSync(path, JSON.stringify(entries, null, 2));
  }
}
```

**Step 4: Run tests — verify pass**

```bash
cd ~/miyagi && pnpm test -- tests/unit/skill-manager.test.ts
```

**Step 5: Commit**

```bash
git add src/core/skill-manager.ts tests/unit/skill-manager.test.ts
git commit -m "feat: add SkillManager with skills.sh integration"
```

---

### Task 6: Claude bridge — spawning and managing claude processes

**Files:**
- Create: `miyagi/src/core/claude-bridge.ts`
- Test: `miyagi/tests/unit/claude-bridge.test.ts`

**Step 1: Write failing tests**

```typescript
// tests/unit/claude-bridge.test.ts
import { describe, it, expect, vi } from 'vitest';
import { ClaudeBridge } from '../../src/core/claude-bridge.js';

describe('ClaudeBridge', () => {
  it('builds correct command args for agent session', () => {
    const bridge = new ClaudeBridge();
    const args = bridge.buildSessionArgs({
      systemPrompt: '# Test Agent\nYou are a test agent.',
      dangerouslySkipPermissions: true,
    });

    expect(args).toContain('--append-system-prompt');
    expect(args).toContain('# Test Agent\nYou are a test agent.');
    expect(args).toContain('--dangerously-skip-permissions');
  });

  it('builds resume args correctly', () => {
    const bridge = new ClaudeBridge();
    const args = bridge.buildSessionArgs({
      systemPrompt: 'test',
      resume: true,
      sessionId: 'abc-123',
    });

    expect(args).toContain('--resume');
    expect(args).toContain('abc-123');
  });

  it('builds non-interactive args for battles', () => {
    const bridge = new ClaudeBridge();
    const args = bridge.buildBattleArgs({
      systemPrompt: 'You are agent A',
      prompt: 'Sell me this pen',
      dangerouslySkipPermissions: true,
    });

    expect(args).toContain('--print');
    expect(args).toContain('--append-system-prompt');
    expect(args).toContain('--dangerously-skip-permissions');
  });

  it('finds claude binary path', () => {
    const bridge = new ClaudeBridge();
    const path = bridge.findClaudePath();
    // Should return a string (may or may not exist in test env)
    expect(typeof path).toBe('string');
  });
});
```

**Step 2: Run tests — verify fail**

```bash
cd ~/miyagi && pnpm test -- tests/unit/claude-bridge.test.ts
```

**Step 3: Implement ClaudeBridge**

```typescript
// src/core/claude-bridge.ts
import { spawn, execSync, type ChildProcess } from 'child_process';

interface SessionOptions {
  systemPrompt: string;
  dangerouslySkipPermissions?: boolean;
  resume?: boolean;
  sessionId?: string;
  model?: string;
}

interface BattleAgentOptions {
  systemPrompt: string;
  prompt: string;
  dangerouslySkipPermissions?: boolean;
  model?: string;
}

export class ClaudeBridge {
  private claudePath: string;

  constructor(claudePath?: string) {
    this.claudePath = claudePath ?? this.findClaudePath();
  }

  findClaudePath(): string {
    try {
      return execSync('which claude', { encoding: 'utf-8' }).trim();
    } catch {
      return 'claude'; // Fallback — let PATH resolve it
    }
  }

  buildSessionArgs(options: SessionOptions): string[] {
    const args: string[] = [];

    if (options.dangerouslySkipPermissions) {
      args.push('--dangerously-skip-permissions');
    }

    args.push('--append-system-prompt', options.systemPrompt);

    if (options.resume && options.sessionId) {
      args.push('--resume', options.sessionId);
    } else if (options.resume) {
      args.push('--resume');
    }

    if (options.model) {
      args.push('--model', options.model);
    }

    return args;
  }

  buildBattleArgs(options: BattleAgentOptions): string[] {
    const args: string[] = ['--print'];

    if (options.dangerouslySkipPermissions) {
      args.push('--dangerously-skip-permissions');
    }

    args.push('--append-system-prompt', options.systemPrompt);

    if (options.model) {
      args.push('--model', options.model);
    }

    args.push('--prompt', options.prompt);

    return args;
  }

  spawnInteractive(args: string[]): ChildProcess {
    return spawn(this.claudePath, args, {
      stdio: 'inherit',
      env: { ...process.env },
    });
  }

  spawnNonInteractive(args: string[]): ChildProcess {
    return spawn(this.claudePath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });
  }

  async runAndCapture(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = this.spawnNonInteractive(args);
      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => { stdout += data.toString(); });
      child.stderr?.on('data', (data) => { stderr += data.toString(); });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Claude exited with code ${code}: ${stderr}`));
        }
      });

      child.on('error', reject);
    });
  }
}
```

**Step 4: Run tests — verify pass**

```bash
cd ~/miyagi && pnpm test -- tests/unit/claude-bridge.test.ts
```

**Step 5: Commit**

```bash
git add src/core/claude-bridge.ts tests/unit/claude-bridge.test.ts
git commit -m "feat: add ClaudeBridge for managing claude CLI processes"
```

---

### Task 7: Session manager

**Files:**
- Create: `miyagi/src/core/session-manager.ts`
- Test: `miyagi/tests/unit/session-manager.test.ts`

**Step 1: Write failing tests**

```typescript
// tests/unit/session-manager.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionManager } from '../../src/core/session-manager.js';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('SessionManager', () => {
  let tempDir: string;
  let sessionManager: SessionManager;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'miyagi-test-'));
    sessionManager = new SessionManager(tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('records a session', () => {
    sessionManager.record('agent-a', 'session-123');
    const sessions = sessionManager.listForAgent('agent-a');
    expect(sessions.length).toBe(1);
    expect(sessions[0].claudeSessionId).toBe('session-123');
  });

  it('gets the latest session for an agent', () => {
    sessionManager.record('agent-a', 'session-1');
    sessionManager.record('agent-a', 'session-2');
    const latest = sessionManager.getLatest('agent-a');
    expect(latest?.claudeSessionId).toBe('session-2');
  });

  it('returns null for agent with no sessions', () => {
    const latest = sessionManager.getLatest('nonexistent');
    expect(latest).toBeNull();
  });

  it('keeps sessions separated by agent', () => {
    sessionManager.record('agent-a', 'session-a');
    sessionManager.record('agent-b', 'session-b');
    expect(sessionManager.listForAgent('agent-a').length).toBe(1);
    expect(sessionManager.listForAgent('agent-b').length).toBe(1);
  });
});
```

**Step 2: Run tests — verify fail**

```bash
cd ~/miyagi && pnpm test -- tests/unit/session-manager.test.ts
```

**Step 3: Implement SessionManager**

```typescript
// src/core/session-manager.ts
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type { SessionEntry } from '../types/index.js';

export class SessionManager {
  private readonly sessionsPath: string;

  constructor(rootDir: string) {
    if (!existsSync(rootDir)) mkdirSync(rootDir, { recursive: true });
    this.sessionsPath = join(rootDir, 'sessions.json');
  }

  record(agentName: string, claudeSessionId: string): SessionEntry {
    const sessions = this.loadAll();
    const entry: SessionEntry = {
      id: randomUUID(),
      agent: agentName,
      startedAt: new Date().toISOString(),
      claudeSessionId,
    };
    sessions.push(entry);
    this.saveAll(sessions);
    return entry;
  }

  listForAgent(agentName: string): SessionEntry[] {
    return this.loadAll()
      .filter(s => s.agent === agentName)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  getLatest(agentName: string): SessionEntry | null {
    const sessions = this.listForAgent(agentName);
    return sessions[0] ?? null;
  }

  endSession(sessionId: string): void {
    const sessions = this.loadAll();
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      session.endedAt = new Date().toISOString();
      this.saveAll(sessions);
    }
  }

  private loadAll(): SessionEntry[] {
    if (!existsSync(this.sessionsPath)) return [];
    return JSON.parse(readFileSync(this.sessionsPath, 'utf-8'));
  }

  private saveAll(sessions: SessionEntry[]): void {
    writeFileSync(this.sessionsPath, JSON.stringify(sessions, null, 2));
  }
}
```

**Step 4: Run tests — verify pass**

```bash
cd ~/miyagi && pnpm test -- tests/unit/session-manager.test.ts
```

**Step 5: Commit**

```bash
git add src/core/session-manager.ts tests/unit/session-manager.test.ts
git commit -m "feat: add SessionManager for tracking agent sessions"
```

---

## Phase 3: CLI Command Routing

### Task 8: Commander program setup with all command stubs

**Files:**
- Create: `miyagi/src/cli/program.ts`
- Create: `miyagi/src/cli/commands/agent.ts`
- Create: `miyagi/src/cli/commands/skill.ts`
- Create: `miyagi/src/cli/commands/use.ts`
- Create: `miyagi/src/cli/commands/battle.ts`
- Create: `miyagi/src/cli/commands/train.ts`
- Create: `miyagi/src/cli/commands/stats.ts`
- Create: `miyagi/src/cli/commands/export-import.ts`
- Create: `miyagi/src/cli/commands/templates.ts`
- Create: `miyagi/src/cli/commands/report.ts`
- Create: `miyagi/src/cli/commands/sessions.ts`
- Test: `miyagi/tests/unit/cli-program.test.ts`

**Step 1: Write failing tests**

```typescript
// tests/unit/cli-program.test.ts
import { describe, it, expect } from 'vitest';
import { createProgram } from '../../src/cli/program.js';

describe('CLI Program', () => {
  it('creates a program with correct name', () => {
    const program = createProgram();
    expect(program.name()).toBe('miyagi');
  });

  it('has all top-level commands registered', () => {
    const program = createProgram();
    const commandNames = program.commands.map(c => c.name());
    expect(commandNames).toContain('create');
    expect(commandNames).toContain('edit');
    expect(commandNames).toContain('delete');
    expect(commandNames).toContain('clone');
    expect(commandNames).toContain('list');
    expect(commandNames).toContain('use');
    expect(commandNames).toContain('battle');
    expect(commandNames).toContain('train');
    expect(commandNames).toContain('stats');
    expect(commandNames).toContain('export');
    expect(commandNames).toContain('import');
    expect(commandNames).toContain('templates');
    expect(commandNames).toContain('report');
    expect(commandNames).toContain('sessions');
    expect(commandNames).toContain('install');
    expect(commandNames).toContain('update');
  });
});
```

**Step 2: Run tests — verify fail**

```bash
cd ~/miyagi && pnpm test -- tests/unit/cli-program.test.ts
```

**Step 3: Create command stubs and program**

Each command file exports a function that registers subcommands. Implementation details come in later tasks — these are routing stubs that print "not yet implemented" for now.

```typescript
// src/cli/program.ts
import { Command } from 'commander';
import { registerAgentCommands } from './commands/agent.js';
import { registerSkillCommands } from './commands/skill.js';
import { registerUseCommand } from './commands/use.js';
import { registerBattleCommand } from './commands/battle.js';
import { registerTrainCommand } from './commands/train.js';
import { registerStatsCommand } from './commands/stats.js';
import { registerExportImportCommands } from './commands/export-import.js';
import { registerTemplatesCommand } from './commands/templates.js';
import { registerReportCommand } from './commands/report.js';
import { registerSessionsCommand } from './commands/sessions.js';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('miyagi')
    .description('Agent & Skill Trainer for Claude Code')
    .version('0.1.0');

  registerAgentCommands(program);
  registerSkillCommands(program);
  registerUseCommand(program);
  registerBattleCommand(program);
  registerTrainCommand(program);
  registerStatsCommand(program);
  registerExportImportCommands(program);
  registerTemplatesCommand(program);
  registerReportCommand(program);
  registerSessionsCommand(program);

  return program;
}
```

```typescript
// src/cli/commands/agent.ts
import type { Command } from 'commander';

export function registerAgentCommands(program: Command): void {
  program
    .command('create')
    .argument('<type>', 'What to create: agent or skill')
    .argument('<name>', 'Name of the agent or skill')
    .option('-t, --template <template>', 'Template to use')
    .option('-a, --agent <agent>', 'Target agent (for skills)')
    .description('Create a new agent or skill')
    .action(async (type, name, options) => {
      console.log(`Creating ${type}: ${name}`);
    });

  program
    .command('edit')
    .argument('<type>', 'What to edit: agent')
    .argument('<name>', 'Name of the agent')
    .description('Edit an agent interactively')
    .action(async (type, name) => {
      console.log(`Editing ${type}: ${name}`);
    });

  program
    .command('delete')
    .argument('<type>', 'What to delete: agent')
    .argument('<name>', 'Name of the agent')
    .description('Delete an agent')
    .action(async (type, name) => {
      console.log(`Deleting ${type}: ${name}`);
    });

  program
    .command('clone')
    .argument('<type>', 'What to clone: agent')
    .argument('<source>', 'Source agent name')
    .argument('<target>', 'Target agent name')
    .description('Clone an agent')
    .action(async (type, source, target) => {
      console.log(`Cloning ${type}: ${source} -> ${target}`);
    });

  program
    .command('list')
    .argument('<type>', 'What to list: agents or skills')
    .option('-a, --agent <agent>', 'Target agent (for skills)')
    .description('List agents or skills')
    .action(async (type, options) => {
      console.log(`Listing ${type}`);
    });
}
```

```typescript
// src/cli/commands/skill.ts
import type { Command } from 'commander';

export function registerSkillCommands(program: Command): void {
  program
    .command('install')
    .argument('<type>', 'What to install: skill')
    .argument('<source>', 'Skill source (skills.sh path)')
    .argument('<agent>', 'Target agent')
    .description('Install a skill into an agent')
    .action(async (type, source, agent) => {
      console.log(`Installing ${type} ${source} into ${agent}`);
    });

  program
    .command('update')
    .argument('<type>', 'What to update: skills')
    .argument('<agent>', 'Target agent')
    .description('Update skills for an agent')
    .action(async (type, agent) => {
      console.log(`Updating ${type} for ${agent}`);
    });
}
```

```typescript
// src/cli/commands/use.ts
import type { Command } from 'commander';

export function registerUseCommand(program: Command): void {
  program
    .command('use')
    .argument('<agent>', 'Agent to impersonate')
    .option('-r, --resume [sessionId]', 'Resume a previous session')
    .description('Start a Claude Code session as an agent')
    .action(async (agent, options) => {
      console.log(`Using agent: ${agent}`);
    });
}
```

```typescript
// src/cli/commands/battle.ts
import type { Command } from 'commander';

export function registerBattleCommand(program: Command): void {
  program
    .command('battle')
    .argument('[agent1]', 'First agent')
    .argument('[agent2]', 'Second agent')
    .option('-m, --mode <mode>', 'Battle mode')
    .option('-b, --background', 'Run in background')
    .option('-t, --task <task>', 'Task description (for symmetric modes)')
    .option('--topic <topic>', 'Topic (for debate mode)')
    .option('--rounds <rounds>', 'Max rounds', parseInt)
    .description('Start a battle between two agents')
    .action(async (agent1, agent2, options) => {
      console.log(`Battle: ${agent1} vs ${agent2}`);
    });
}
```

```typescript
// src/cli/commands/train.ts
import type { Command } from 'commander';

export function registerTrainCommand(program: Command): void {
  program
    .command('train')
    .argument('<agent>', 'Agent to train')
    .option('-d, --dry-run', 'Show suggestions without applying')
    .option('--revert', 'Revert last coaching changes')
    .description('Train an agent with Mr. Miyagi coaching')
    .action(async (agent, options) => {
      console.log(`Training agent: ${agent}`);
    });
}
```

```typescript
// src/cli/commands/stats.ts
import type { Command } from 'commander';

export function registerStatsCommand(program: Command): void {
  program
    .command('stats')
    .argument('<agent>', 'Agent to show stats for')
    .option('-c, --compare <agent>', 'Compare with another agent')
    .description('Show agent stats, ELO, and skill radar')
    .action(async (agent, options) => {
      console.log(`Stats for: ${agent}`);
    });
}
```

```typescript
// src/cli/commands/export-import.ts
import type { Command } from 'commander';

export function registerExportImportCommands(program: Command): void {
  program
    .command('export')
    .argument('<agent>', 'Agent to export')
    .option('-f, --format <format>', 'Export format: tar.gz or zip', 'tar.gz')
    .option('--no-history', 'Exclude battle history')
    .option('-o, --output <path>', 'Output path')
    .description('Export an agent package')
    .action(async (agent, options) => {
      console.log(`Exporting agent: ${agent}`);
    });

  program
    .command('import')
    .argument('<source>', 'File or directory to import')
    .description('Import an agent package')
    .action(async (source) => {
      console.log(`Importing from: ${source}`);
    });
}
```

```typescript
// src/cli/commands/templates.ts
import type { Command } from 'commander';

export function registerTemplatesCommand(program: Command): void {
  program
    .command('templates')
    .argument('<action>', 'Action: list, install, or create')
    .argument('[source]', 'Template source or name')
    .description('Manage agent templates')
    .action(async (action, source) => {
      console.log(`Templates ${action}: ${source}`);
    });
}
```

```typescript
// src/cli/commands/report.ts
import type { Command } from 'commander';

export function registerReportCommand(program: Command): void {
  program
    .command('report')
    .argument('<target>', 'Battle ID or agent name')
    .option('-t, --type <type>', 'Report type: battle, profile, evolution', 'battle')
    .option('-c, --compare <agent>', 'Compare with another agent')
    .option('--open', 'Open in browser after generating')
    .option('-o, --output <path>', 'Output path')
    .description('Generate an HTML report')
    .action(async (target, options) => {
      console.log(`Generating report for: ${target}`);
    });
}
```

```typescript
// src/cli/commands/sessions.ts
import type { Command } from 'commander';

export function registerSessionsCommand(program: Command): void {
  program
    .command('sessions')
    .argument('<agent>', 'Agent to list sessions for')
    .description('List past sessions for an agent')
    .action(async (agent) => {
      console.log(`Sessions for: ${agent}`);
    });
}
```

**Step 4: Run tests — verify pass**

```bash
cd ~/miyagi && pnpm test -- tests/unit/cli-program.test.ts
```

**Step 5: Verify build works**

```bash
cd ~/miyagi && pnpm build
```

**Step 6: Commit**

```bash
git add src/cli/ bin/ tests/unit/cli-program.test.ts
git commit -m "feat: add CLI command routing with Commander.js"
```

---

## Phase 4: Agent Impersonation

### Task 9: `miyagi use` — impersonate agent with skill symlinks

**Files:**
- Modify: `miyagi/src/cli/commands/use.ts`
- Create: `miyagi/src/core/impersonation.ts`
- Test: `miyagi/tests/unit/impersonation.test.ts`

**Step 1: Write failing tests**

```typescript
// tests/unit/impersonation.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ImpersonationManager } from '../../src/core/impersonation.js';
import { AgentManager } from '../../src/core/agent-manager.js';
import { ConfigManager } from '../../src/core/config.js';
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir, homedir } from 'os';

describe('ImpersonationManager', () => {
  let tempDir: string;
  let claudeSkillsDir: string;
  let impersonation: ImpersonationManager;
  let agentManager: AgentManager;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'miyagi-test-'));
    claudeSkillsDir = join(tempDir, 'claude-skills');
    mkdirSync(claudeSkillsDir, { recursive: true });

    const config = new ConfigManager(tempDir);
    config.ensureDirectories();
    agentManager = new AgentManager(config);
    impersonation = new ImpersonationManager(agentManager, claudeSkillsDir);

    // Create agent with a skill
    await agentManager.create('test-agent', { author: 'test' });
    const agent = await agentManager.get('test-agent');
    const skillDir = join(agent!.skillsDir, 'test-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: test-skill\ndescription: test\n---\n# Test');
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates prefixed symlinks for agent skills', async () => {
    await impersonation.activate('test-agent');
    const symlinkPath = join(claudeSkillsDir, 'miyagi-test-agent-test-skill');
    expect(existsSync(symlinkPath)).toBe(true);
  });

  it('cleans up symlinks on deactivate', async () => {
    await impersonation.activate('test-agent');
    await impersonation.deactivate();
    const symlinkPath = join(claudeSkillsDir, 'miyagi-test-agent-test-skill');
    expect(existsSync(symlinkPath)).toBe(false);
  });

  it('builds system prompt from identity.md', async () => {
    const prompt = await impersonation.buildSystemPrompt('test-agent');
    expect(prompt).toContain('# test-agent');
  });
});
```

**Step 2: Run tests — verify fail**

```bash
cd ~/miyagi && pnpm test -- tests/unit/impersonation.test.ts
```

**Step 3: Implement ImpersonationManager**

```typescript
// src/core/impersonation.ts
import { existsSync, symlinkSync, unlinkSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type { AgentManager } from './agent-manager.js';

export class ImpersonationManager {
  private readonly agentManager: AgentManager;
  private readonly claudeSkillsDir: string;
  private activeSymlinks: string[] = [];
  private activeAgent: string | null = null;

  constructor(agentManager: AgentManager, claudeSkillsDir: string) {
    this.agentManager = agentManager;
    this.claudeSkillsDir = claudeSkillsDir;
  }

  async activate(agentName: string): Promise<void> {
    const agent = await this.agentManager.get(agentName);
    if (!agent) throw new Error(`Agent "${agentName}" not found`);

    // Symlink each skill with prefixed name
    if (existsSync(agent.skillsDir)) {
      for (const entry of readdirSync(agent.skillsDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const skillPath = join(agent.skillsDir, entry.name);
        const symlinkName = `miyagi-${agentName}-${entry.name}`;
        const symlinkPath = join(this.claudeSkillsDir, symlinkName);

        if (existsSync(symlinkPath)) unlinkSync(symlinkPath);
        symlinkSync(skillPath, symlinkPath);
        this.activeSymlinks.push(symlinkPath);
      }
    }

    this.activeAgent = agentName;
  }

  async deactivate(): Promise<void> {
    for (const symlinkPath of this.activeSymlinks) {
      if (existsSync(symlinkPath)) {
        unlinkSync(symlinkPath);
      }
    }
    this.activeSymlinks = [];
    this.activeAgent = null;
  }

  async buildSystemPrompt(agentName: string): Promise<string> {
    const agent = await this.agentManager.get(agentName);
    if (!agent) throw new Error(`Agent "${agentName}" not found`);

    let prompt = readFileSync(agent.identityPath, 'utf-8');

    // Append context files
    if (existsSync(agent.contextDir)) {
      for (const file of readdirSync(agent.contextDir, { withFileTypes: true })) {
        if (file.isFile() && file.name.endsWith('.md')) {
          const content = readFileSync(join(agent.contextDir, file.name), 'utf-8');
          prompt += `\n\n---\n\n# Context: ${file.name}\n\n${content}`;
        }
      }
    }

    return prompt;
  }

  setupCleanupTraps(): void {
    const cleanup = () => {
      this.deactivate().catch(() => {});
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', cleanup);
  }
}
```

**Step 4: Run tests — verify pass**

```bash
cd ~/miyagi && pnpm test -- tests/unit/impersonation.test.ts
```

**Step 5: Wire up the `use` command**

Update `src/cli/commands/use.ts` to use ImpersonationManager and ClaudeBridge together. This connects the plumbing.

**Step 6: Commit**

```bash
git add src/core/impersonation.ts src/cli/commands/use.ts tests/unit/impersonation.test.ts
git commit -m "feat: add agent impersonation with skill symlinks and cleanup traps"
```

---

## Phase 5: Battle System

### Task 10: Battle engine core — symmetric battles

**Files:**
- Create: `miyagi/src/battle/engine.ts`
- Create: `miyagi/src/battle/modes/same-task.ts`
- Test: `miyagi/tests/unit/battle-engine.test.ts`

**Step 1: Write failing tests**

Test that the engine can configure a symmetric battle, track rounds, and produce a BattleResult.

**Step 2: Implement BattleEngine with symmetric mode**

The engine spawns two independent Claude processes via ClaudeBridge, captures outputs, assembles a BattleResult.

**Step 3: Run tests — verify pass**

**Step 4: Commit**

```bash
git commit -m "feat: add BattleEngine with symmetric battle support"
```

---

### Task 11: Battle mediator — asymmetric battles

**Files:**
- Create: `miyagi/src/battle/mediator.ts`
- Create: `miyagi/src/battle/modes/sales-roleplay.ts`
- Create: `miyagi/src/battle/modes/debate.ts`
- Test: `miyagi/tests/unit/battle-mediator.test.ts`

**Step 1: Write failing tests**

Test turn-by-turn mediation: mediator passes Agent A's response to Agent B, captures each round.

**Step 2: Implement Mediator**

The mediator manages two Claude processes, feeding each agent the conversation history + the other's last response. Assembles rounds into BattleResult.

**Step 3: Implement sales-roleplay and debate modes**

Each mode provides role cards (system prompts) for Agent A and Agent B, plus termination criteria.

**Step 4: Run tests — verify pass**

**Step 5: Commit**

```bash
git commit -m "feat: add battle mediator for asymmetric battles"
```

---

### Task 12: Remaining battle modes

**Files:**
- Create: `miyagi/src/battle/modes/code-challenge.ts`
- Create: `miyagi/src/battle/modes/negotiation.ts`
- Create: `miyagi/src/battle/modes/review-duel.ts`
- Create: `miyagi/src/battle/modes/interview.ts`
- Create: `miyagi/src/battle/modes/support-ticket.ts`
- Create: `miyagi/src/battle/modes/iterative-refinement.ts`
- Create: `miyagi/src/battle/modes/speed-run.ts`
- Create: `miyagi/src/battle/modes/index.ts`
- Test: `miyagi/tests/unit/battle-modes.test.ts`

**Step 1:** Define each mode's config (type, roles, default rounds, termination criteria).

**Step 2:** Create mode registry in `index.ts` that maps mode names to configs.

**Step 3:** Test that all modes are registered and have valid configs.

**Step 4: Commit**

```bash
git commit -m "feat: add all 10 battle modes"
```

---

## Phase 6: Judge & Coach

### Task 13: Judge agent — analysis and scoring

**Files:**
- Create: `miyagi/src/training/judge.ts`
- Create: `miyagi/src/builtin-agents/miyagi-judge/identity.md`
- Test: `miyagi/tests/unit/judge.test.ts`

**Step 1:** Write the Judge's identity.md (the expert evaluator prompt from the design doc).

**Step 2:** Implement Judge class that takes a BattleResult, spawns Claude with the Judge identity, and parses the structured output into a JudgeVerdict.

**Step 3:** Test that Judge produces a valid JudgeVerdict structure.

**Step 4: Commit**

```bash
git commit -m "feat: add Judge agent with adaptive evaluation"
```

---

### Task 14: Coach (Mr. Miyagi) — training and improvements

**Files:**
- Create: `miyagi/src/training/coach.ts`
- Create: `miyagi/src/builtin-agents/mr-miyagi/identity.md`
- Test: `miyagi/tests/unit/coach.test.ts`

**Step 1:** Write Mr. Miyagi's identity.md (the master trainer prompt from the design doc).

**Step 2:** Implement Coach class that takes a JudgeVerdict + agent files, spawns Claude with Coach identity + `--dangerously-skip-permissions`, and applies changes to identity.md, context files, or creates new skills.

**Step 3:** Implement `--dry-run` mode that captures suggested changes without applying.

**Step 4:** Implement `--revert` via git to undo last coaching commit.

**Step 5:** Test coach produces valid change descriptions and respects dry-run.

**Step 6: Commit**

```bash
git commit -m "feat: add Mr. Miyagi coach with surgical improvement system"
```

---

## Phase 7: Scoring System

### Task 15: ELO calculator and dimensional scoring

**Files:**
- Create: `miyagi/src/training/scoring.ts`
- Test: `miyagi/tests/unit/scoring.test.ts`

**Step 1: Write failing tests**

```typescript
// tests/unit/scoring.test.ts
import { describe, it, expect } from 'vitest';
import { calculateElo, updateDimensionScores, determineTrend } from '../../src/training/scoring.js';

describe('ELO calculation', () => {
  it('winner gains more points when beating higher-rated opponent', () => {
    const { winnerNew, loserNew } = calculateElo(1200, 1600, 'win');
    expect(winnerNew).toBeGreaterThan(1200 + 20);
    expect(loserNew).toBeLessThan(1600);
  });

  it('winner gains fewer points when beating lower-rated opponent', () => {
    const { winnerNew } = calculateElo(1600, 1200, 'win');
    expect(winnerNew - 1600).toBeLessThan(16);
  });

  it('handles draws', () => {
    const { winnerNew, loserNew } = calculateElo(1200, 1200, 'draw');
    expect(winnerNew).toBe(1200);
    expect(loserNew).toBe(1200);
  });
});

describe('Dimension scoring', () => {
  it('updates dimension history', () => {
    const dims = {};
    const updated = updateDimensionScores(dims, { 'rapport': 7.5, 'closing': 6.0 });
    expect(updated['rapport'].current).toBe(7.5);
    expect(updated['rapport'].history).toEqual([7.5]);
  });

  it('appends to existing history', () => {
    const dims = { rapport: { current: 5.0, history: [5.0], trend: 'stable' as const } };
    const updated = updateDimensionScores(dims, { rapport: 7.5 });
    expect(updated['rapport'].history).toEqual([5.0, 7.5]);
    expect(updated['rapport'].current).toBe(7.5);
  });
});

describe('Trend detection', () => {
  it('detects upward trend', () => {
    expect(determineTrend([3, 4, 5, 6, 7])).toBe('up');
  });

  it('detects downward trend', () => {
    expect(determineTrend([7, 6, 5, 4, 3])).toBe('down');
  });

  it('detects stable trend', () => {
    expect(determineTrend([5, 5.1, 4.9, 5, 5.1])).toBe('stable');
  });
});
```

**Step 2: Implement scoring functions**

**Step 3: Run tests — verify pass**

**Step 4: Commit**

```bash
git commit -m "feat: add ELO calculator and dimensional scoring"
```

---

### Task 16: Training history manager

**Files:**
- Create: `miyagi/src/training/history.ts`
- Test: `miyagi/tests/unit/history.test.ts`

**Step 1:** Write tests for recording battles, updating stats, reading history.

**Step 2:** Implement HistoryManager that reads/writes `stats.json`, `battles.json`, `training-log.md`.

**Step 3:** Integrate with git for atomic commits of training data.

**Step 4: Commit**

```bash
git commit -m "feat: add training history manager with git integration"
```

---

## Phase 8: Import/Export Security

### Task 17: Secure archive handling

**Files:**
- Create: `miyagi/src/utils/archive.ts`
- Create: `miyagi/src/cli/middleware/security.ts`
- Test: `miyagi/tests/unit/archive-security.test.ts`

**Step 1: Write security tests**

```typescript
// tests/unit/archive-security.test.ts
import { describe, it, expect } from 'vitest';
import { validateArchiveEntry, validateImportDirectory } from '../../src/cli/middleware/security.js';

describe('Archive security', () => {
  it('rejects path traversal attempts', () => {
    expect(validateArchiveEntry('../../../etc/passwd').valid).toBe(false);
  });

  it('rejects absolute paths', () => {
    expect(validateArchiveEntry('/etc/passwd').valid).toBe(false);
  });

  it('rejects symlinks in entries', () => {
    expect(validateArchiveEntry('identity.md', { isSymlink: true }).valid).toBe(false);
  });

  it('accepts valid markdown files', () => {
    expect(validateArchiveEntry('identity.md').valid).toBe(true);
  });

  it('accepts valid json files', () => {
    expect(validateArchiveEntry('manifest.json').valid).toBe(true);
  });

  it('warns but allows executable files', () => {
    const result = validateArchiveEntry('scripts/setup.sh');
    expect(result.valid).toBe(true);
    expect(result.warning).toContain('executable');
  });

  it('rejects files exceeding size limit', () => {
    expect(validateArchiveEntry('identity.md', { size: 2_000_000 }).valid).toBe(false);
  });
});
```

**Step 2:** Implement security validators and archive extraction with all safety checks.

**Step 3:** Implement export (tar.gz + zip) and import (tar.gz + zip + directory).

**Step 4: Commit**

```bash
git commit -m "feat: add secure archive handling for import/export"
```

---

## Phase 9: Stats Display

### Task 18: Terminal stats rendering

**Files:**
- Modify: `miyagi/src/cli/commands/stats.ts`
- Test: `miyagi/tests/unit/stats-display.test.ts`

**Step 1:** Implement stats display with skill radar bars, ELO display, growth trajectory, and comparison mode.

**Step 2:** Test output formatting.

**Step 3: Commit**

```bash
git commit -m "feat: add terminal stats display with skill radar and ELO"
```

---

## Phase 10: HTML Reports

### Task 19: Report design system and templates

**Files:**
- Create: `miyagi/src/reports/generator.ts`
- Create: `miyagi/src/reports/templates/base.hbs`
- Create: `miyagi/src/reports/templates/battle.hbs`
- Create: `miyagi/src/reports/templates/profile.hbs`
- Create: `miyagi/src/reports/templates/evolution.hbs`
- Create: `miyagi/src/reports/templates/compare.hbs`
- Create: `miyagi/src/reports/assets/styles.css`
- Create: `miyagi/src/reports/assets/charts.js`
- Test: `miyagi/tests/unit/report-generator.test.ts`

**Step 1:** Create the base Handlebars layout with unified design system (dark theme, dojo-inspired, responsive, accessible).

**Step 2:** Create each report template as a partial that extends base.

**Step 3:** Implement ReportGenerator that compiles templates, inlines CSS/JS, and writes self-contained HTML.

**Step 4:** Test that generated HTML is valid and contains expected sections.

**Step 5: Commit**

```bash
git commit -m "feat: add HTML report generator with unified design system"
```

---

## Phase 11: Agent Templates

### Task 20: Built-in agent templates

**Files:**
- Create: `miyagi/src/templates/salesman/manifest.json`
- Create: `miyagi/src/templates/salesman/identity.md`
- Create: `miyagi/src/templates/developer/manifest.json`
- Create: `miyagi/src/templates/developer/identity.md`
- Create: `miyagi/src/templates/business-analyst/manifest.json`
- Create: `miyagi/src/templates/business-analyst/identity.md`
- Create: `miyagi/src/templates/writer/manifest.json`
- Create: `miyagi/src/templates/writer/identity.md`
- Create: `miyagi/src/templates/support-rep/manifest.json`
- Create: `miyagi/src/templates/support-rep/identity.md`

**Step 1:** Write rich identity.md for each template with personality, strategy, skill directives.

**Step 2:** Wire template loading into `miyagi create agent --template`.

**Step 3: Commit**

```bash
git commit -m "feat: add 5 built-in agent templates"
```

---

## Phase 12: Interactive Agent/Skill Creation

### Task 21: AI-assisted interactive agent creation

**Files:**
- Modify: `miyagi/src/cli/commands/agent.ts`
- Test: `miyagi/tests/integration/create-agent.test.ts`

**Step 1:** Implement the interactive flow using Inquirer.js:
1. Ask for agent name, domain, personality traits
2. Optionally select a template
3. Launch Claude Code session to collaboratively write identity.md
4. Initialize git repo for the agent

**Step 2:** Implement AI-assisted skill creation similarly.

**Step 3: Commit**

```bash
git commit -m "feat: add interactive AI-assisted agent and skill creation"
```

---

## Phase 13: Wire Everything Together

### Task 22: Wire battle command end-to-end

**Files:**
- Modify: `miyagi/src/cli/commands/battle.ts`

**Step 1:** Connect battle command to BattleEngine + Mediator + Judge + Coach pipeline.

**Step 2:** Add Ink-based live battle display for interactive mode.

**Step 3:** Add background mode support.

**Step 4: Commit**

```bash
git commit -m "feat: wire battle command end-to-end with live display"
```

---

### Task 23: Wire train, export, import, templates, report, sessions commands

**Files:**
- Modify all remaining command files in `src/cli/commands/`

**Step 1:** Connect each command to its corresponding core module.

**Step 2:** Add error handling and user confirmations.

**Step 3: Commit**

```bash
git commit -m "feat: wire all remaining CLI commands"
```

---

## Phase 14: Integration Testing & Polish

### Task 24: End-to-end integration tests

**Files:**
- Create: `miyagi/tests/integration/full-flow.test.ts`

**Step 1:** Test complete flow: create agent -> install skill -> use agent -> battle -> judge -> coach -> stats.

**Step 2:** Test export -> import roundtrip.

**Step 3: Commit**

```bash
git commit -m "test: add end-to-end integration tests"
```

---

### Task 25: Package for npm publishing

**Files:**
- Modify: `miyagi/package.json`
- Create: `miyagi/README.md`

**Step 1:** Finalize package.json with correct metadata, keywords, license.

**Step 2:** Verify `npm pack` produces a clean package.

**Step 3:** Test global installation: `npm install -g ./miyagi-0.1.0.tgz`

**Step 4:** Verify `miyagi --version` and `miyagi --help` work.

**Step 5: Commit**

```bash
git commit -m "chore: prepare for npm publishing"
```

---

## Phase 15: CI/CD & npm Publishing

### Task 26: GitHub Actions CI pipeline

**Files:**
- Create: `miyagi/.github/workflows/ci.yml`
- Create: `miyagi/.github/workflows/release.yml`

**Step 1: Create CI workflow**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [master, main]
  pull_request:
    branches: [master, main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint

  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm test -- --coverage
      - uses: actions/upload-artifact@v4
        if: matrix.node-version == 20
        with:
          name: coverage
          path: coverage/

  build:
    runs-on: ubuntu-latest
    needs: [lint, test]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/
```

**Step 2: Create release workflow**

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write
  id-token: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
          registry-url: 'https://registry.npmjs.org'
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
      - run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          generate_release_notes: true
```

**Step 3: Commit**

```bash
git add .github/
git commit -m "ci: add CI pipeline and release workflow"
```

---

### Task 27: npm package configuration

**Files:**
- Modify: `miyagi/package.json`
- Create: `miyagi/.npmignore`
- Create: `miyagi/LICENSE`

**Step 1: Finalize package.json for publishing**

```json
{
  "name": "miyagi",
  "version": "0.1.0",
  "description": "Agent & Skill Trainer for Claude Code — create, battle, and coach AI agents",
  "type": "module",
  "bin": {
    "miyagi": "./dist/bin/miyagi.js"
  },
  "main": "./dist/src/index.js",
  "types": "./dist/src/index.d.ts",
  "files": [
    "dist/",
    "src/builtin-agents/",
    "src/templates/",
    "src/reports/templates/",
    "src/reports/assets/",
    "LICENSE",
    "README.md"
  ],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "tsc --noEmit",
    "prepublishOnly": "pnpm build",
    "release:patch": "npm version patch && git push --follow-tags",
    "release:minor": "npm version minor && git push --follow-tags",
    "release:major": "npm version major && git push --follow-tags"
  },
  "keywords": [
    "cli",
    "claude",
    "claude-code",
    "ai-agent",
    "agent-training",
    "skills",
    "miyagi",
    "llm"
  ],
  "author": "Gabriel de Jesus Rodrigues",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/gabrieldejesusrodrigues/miyagi.git"
  },
  "bugs": {
    "url": "https://github.com/gabrieldejesusrodrigues/miyagi/issues"
  },
  "homepage": "https://github.com/gabrieldejesusrodrigues/miyagi#readme",
  "engines": {
    "node": ">=18"
  },
  "peerDependencies": {
    "@anthropic-ai/claude-code": ">=2.0.0"
  },
  "peerDependenciesMeta": {
    "@anthropic-ai/claude-code": {
      "optional": true
    }
  }
}
```

**Step 2: Create .npmignore**

```
# Source & dev files
src/
tests/
tsconfig.json
tsup.config.ts
vitest.config.ts
.github/
.gitignore
.eslintrc*
.prettierrc*
coverage/
*.tgz

# Keep these (override .gitignore)
!dist/
!src/builtin-agents/
!src/templates/
!src/reports/templates/
!src/reports/assets/
```

**Step 3: Create LICENSE (MIT)**

Standard MIT license with Gabriel de Jesus Rodrigues as copyright holder.

**Step 4: Verify package contents**

```bash
cd ~/miyagi && npm pack --dry-run
```

Verify the output includes only dist/, builtin-agents, templates, report assets, LICENSE, README.

**Step 5: Test global install from tarball**

```bash
cd ~/miyagi && npm pack
npm install -g ./miyagi-0.1.0.tgz
miyagi --version
miyagi --help
npm uninstall -g miyagi
```

**Step 6: Commit**

```bash
git add package.json .npmignore LICENSE
git commit -m "chore: configure npm package for publishing"
```

---

### Task 28: Release process documentation

**Files:**
- Add release section to README.md (created in Task 25)

**Step 1:** Document the release process:

```markdown
## Releasing

1. Update CHANGELOG.md
2. Bump version: `pnpm release:patch` (or `:minor` / `:major`)
3. Git tag is created and pushed automatically
4. GitHub Actions runs tests, builds, and publishes to npm
5. GitHub Release is created with auto-generated notes

### First-time setup

1. Create npm account at npmjs.com
2. Generate npm access token (Automation type)
3. Add `NPM_TOKEN` secret to GitHub repo settings
```

**Step 2: Commit**

```bash
git commit -m "docs: add release process documentation"
```

---

## Phase 16: Security Scanning

### Task 29: Security audit pipeline

**Files:**
- Modify: `miyagi/.github/workflows/ci.yml`
- Create: `miyagi/.github/workflows/security.yml`

**Step 1: Create dedicated security workflow**

```yaml
# .github/workflows/security.yml
name: Security

on:
  push:
    branches: [master, main]
  pull_request:
    branches: [master, main]
  schedule:
    - cron: '0 6 * * 1'  # Weekly Monday 6am UTC

permissions:
  contents: read
  security-events: write

jobs:
  dependency-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - name: Audit dependencies
        run: pnpm audit --audit-level=high
      - name: Check for known vulnerabilities
        run: npx better-npm-audit audit --level high

  codeql:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: typescript
      - uses: github/codeql-action/autobuild@v3
      - uses: github/codeql-action/analyze@v3

  secrets-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: trufflesecurity/trufflehog@main
        with:
          extra_args: --only-verified

  import-security-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - name: Run import security tests
        run: pnpm test -- tests/unit/archive-security.test.ts --reporter=verbose
      - name: Run all security-related tests
        run: pnpm test -- --grep "security|traversal|symlink|sanitiz" --reporter=verbose
```

**Step 2: Add security check to CI workflow**

Add to the existing `ci.yml` after the test job:

```yaml
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm audit --audit-level=high
```

**Step 3: Add security test script to package.json**

```json
{
  "scripts": {
    "test:security": "vitest run --grep 'security|traversal|symlink|sanitiz'"
  }
}
```

**Step 4: Commit**

```bash
git add .github/ package.json
git commit -m "ci: add security scanning pipeline with CodeQL, dependency audit, and secrets detection"
```

---

## Task Dependency Graph

```
Phase 1:  [Task 1] → [Task 2]
Phase 2:  [Task 3] → [Task 4] → [Task 5] → [Task 6] → [Task 7]
Phase 3:  [Task 8] (depends on Phase 2)
Phase 4:  [Task 9] (depends on Tasks 4, 6, 7)
Phase 5:  [Task 10] → [Task 11] → [Task 12] (depends on Task 6)
Phase 6:  [Task 13] → [Task 14] (depends on Tasks 10, 11)
Phase 7:  [Task 15] → [Task 16] (depends on Task 13)
Phase 8:  [Task 17] (independent, can parallel with Phase 5-7)
Phase 9:  [Task 18] (depends on Task 16)
Phase 10: [Task 19] (depends on Task 16)
Phase 11: [Task 20] (depends on Task 4)
Phase 12: [Task 21] (depends on Tasks 4, 5, 6, 8)
Phase 13: [Task 22] → [Task 23] (depends on all Phases)
Phase 14: [Task 24] → [Task 25] (final)
Phase 15: [Task 26] → [Task 27] → [Task 28] (Task 26 independent, can parallel early; 27-28 depend on Task 25)
Phase 16: [Task 29] (can parallel with Task 26, only needs project scaffolding)
```

Parallelizable groups:
- Tasks 17, 19, 20 can run in parallel once their dependencies are met
- Tasks 10-12 can be developed alongside Tasks 13-16 on separate branches
- Tasks 26, 29 (CI + security pipelines) can be created early alongside Phase 1-2 since they only need project scaffolding
