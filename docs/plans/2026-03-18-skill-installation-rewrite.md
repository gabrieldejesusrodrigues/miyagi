# Skill Installation Rewrite — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the broken `npx skills add` integration with a clone-extract-copy approach that actually installs skills into miyagi agent directories, with interactive skill selection and AI-powered identity.md integration.

**Architecture:** Clone the GitHub repo to a temp dir, discover skills inside the `skills/` subfolder, let the user select which to install (interactive checkbox or `--skill` flag), copy selected skill dirs into the agent's `skills/` dir, update `.installed-skills.json`, use ClaudeBridge with sonnet to update the agent's `identity.md` with references to all newly installed skills, clean up temp dir.

**Tech Stack:** TypeScript, simple-git (already a dependency), inquirer (checkbox prompt, already a dependency), ClaudeBridge (existing), fs/path (copy dirs).

---

## Task 1: Rewrite `SkillManager.install()` — Clone & Discover

**Files:**
- Modify: `src/core/skill-manager.ts`
- Test: `tests/unit/skill-manager-mock.test.ts`

### Step 1: Write the failing tests

Add tests to `tests/unit/skill-manager-mock.test.ts`. Replace the existing `install` describe block. We mock `child_process.execSync` for `git clone`, and we mock `fs` operations for the copy step. But since the project convention is "no mocking fs" for non-mock tests, the mock test file handles the git clone mock while we test the actual fs operations in the non-mock test file.

Update the mock test to verify:
1. `install()` accepts `source` (repo), `agentName`, and optional `skillFilter` (string or undefined) and `skills` (string[] for multi-select)
2. It calls `execSync` with `git clone --depth 1 https://github.com/{source}.git <tmpDir>`
3. It discovers skills inside `<tmpDir>/skills/` by scanning for `SKILL.md` files
4. When `skillFilter` is provided, only that skill is copied
5. When `skills` array is provided, only those skills are copied
6. When neither is provided, all discovered skills are returned (for interactive selection)
7. Temp dir is cleaned up in a `finally` block (even on error)
8. `.installed-skills.json` is updated with installed skill entries

```typescript
describe('install (clone-extract-copy)', () => {
  it('should clone the repo with git clone --depth 1', async () => {
    await agentManager.create('test-agent', { author: 'test' });
    mockedExecSync.mockReturnValue(Buffer.from(''));

    // We need to also mock the fs for the temp dir to have skills
    // This test just verifies the git clone call
    try {
      await skillManager.install('anthropics/skills', 'test-agent', { skills: ['frontend-design'] });
    } catch { /* temp dir won't have skills */ }

    expect(mockedExecSync).toHaveBeenCalledWith(
      expect.stringMatching(/git clone --depth 1 https:\/\/github\.com\/anthropics\/skills\.git/),
      expect.objectContaining({ stdio: 'pipe' }),
    );
  });

  it('should throw when agent not found', async () => {
    await expect(
      skillManager.install('anthropics/skills', 'nonexistent', { skills: ['x'] })
    ).rejects.toThrow(/Agent "nonexistent" not found/);
  });

  it('should not call execSync when agent not found', async () => {
    await expect(
      skillManager.install('anthropics/skills', 'nonexistent', { skills: ['x'] })
    ).rejects.toThrow();
    expect(mockedExecSync).not.toHaveBeenCalled();
  });
});
```

### Step 2: Run tests to verify they fail

Run: `pnpm test -- tests/unit/skill-manager-mock.test.ts`
Expected: FAIL — `install()` signature mismatch or missing behavior

### Step 3: Rewrite `SkillManager.install()`

Replace the current `install()` method in `src/core/skill-manager.ts`:

```typescript
import {
  existsSync, readdirSync, readFileSync, rmSync, writeFileSync,
  mkdtempSync, cpSync,
} from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { tmpdir } from 'os';
import type { AgentSkill, InstalledSkillEntry } from '../types/index.js';
import { validateInstalledSkills } from '../utils/validators.js';
import type { AgentManager } from './agent-manager.js';

interface InstallOptions {
  skills?: string[];       // specific skill names to install
  noIntegrate?: boolean;   // skip AI identity.md update
}

// ...existing class methods stay...

async install(source: string, agentName: string, options?: InstallOptions): Promise<string[]> {
  const agent = await this.agentManager.get(agentName);
  if (!agent) throw new Error(`Agent "${agentName}" not found`);

  const tmpDir = mkdtempSync(join(tmpdir(), 'miyagi-skill-'));

  try {
    // 1. Clone repo
    const repoUrl = source.startsWith('http') ? source : `https://github.com/${source}.git`;
    execSync(`git clone --depth 1 ${repoUrl} ${tmpDir}`, { stdio: 'pipe' });

    // 2. Discover skills
    const available = this.discoverSkills(tmpDir);
    if (available.length === 0) {
      throw new Error(`No skills found in repository "${source}". Skills must have a SKILL.md file.`);
    }

    // 3. Determine which skills to install
    const toInstall = options?.skills
      ? available.filter(s => options.skills!.includes(s.name))
      : available;

    if (toInstall.length === 0) {
      const requested = options?.skills?.join(', ') ?? '';
      const found = available.map(s => s.name).join(', ');
      throw new Error(
        `Skill(s) "${requested}" not found. Available skills: ${found}`
      );
    }

    // 4. Copy each skill to agent's skills dir
    const installedNames: string[] = [];
    const existing = this.readInstalledSkills(agent.rootDir);

    for (const skill of toInstall) {
      const destDir = join(agent.skillsDir, skill.name);
      cpSync(skill.path, destDir, { recursive: true });
      installedNames.push(skill.name);

      // Update .installed-skills.json entry
      const entryIndex = existing.findIndex(e => e.name === skill.name);
      const entry: InstalledSkillEntry = {
        name: skill.name,
        source,
        installedAt: new Date().toISOString(),
      };
      if (entryIndex >= 0) {
        existing[entryIndex] = entry;
      } else {
        existing.push(entry);
      }
    }

    this.writeInstalledSkills(agent.rootDir, existing);
    return installedNames;
  } finally {
    // 5. Always clean up temp dir
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

discoverSkills(repoDir: string): Array<{ name: string; description: string; path: string }> {
  const skillsDir = join(repoDir, 'skills');
  const searchDirs: string[] = [];

  // Check for skills/ subdirectory first (mono-repo convention)
  if (existsSync(skillsDir)) {
    searchDirs.push(skillsDir);
  }

  // Also check repo root for single-skill repos (SKILL.md at root)
  const rootSkillMd = join(repoDir, 'SKILL.md');
  if (existsSync(rootSkillMd)) {
    const metadata = this.parseSkillMetadata(rootSkillMd);
    return [{ name: metadata.name, description: metadata.description, path: repoDir }];
  }

  if (searchDirs.length === 0) {
    return [];
  }

  const skills: Array<{ name: string; description: string; path: string }> = [];

  for (const dir of searchDirs) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillMdPath = join(dir, entry.name, 'SKILL.md');
      if (!existsSync(skillMdPath)) continue;
      const metadata = this.parseSkillMetadata(skillMdPath);
      skills.push({
        name: entry.name,
        description: metadata.description,
        path: join(dir, entry.name),
      });
    }
  }

  return skills;
}
```

### Step 4: Run tests to verify they pass

Run: `pnpm test -- tests/unit/skill-manager-mock.test.ts`
Expected: PASS

### Step 5: Commit

```bash
git add src/core/skill-manager.ts tests/unit/skill-manager-mock.test.ts
git commit -m "feat(skills): rewrite install to clone-extract-copy approach"
```

---

## Task 2: Add non-mock integration tests for install

**Files:**
- Modify: `tests/unit/skill-manager.test.ts`

### Step 1: Write integration-style tests using real temp dirs

These tests create a fake "git repo" structure locally (no actual git clone) and test `discoverSkills()` and the copy logic directly.

```typescript
describe('discoverSkills', () => {
  it('discovers skills in skills/ subdirectory', () => {
    const fakeRepo = mkdtempSync(join(tmpdir(), 'miyagi-fake-repo-'));
    const skillDir = join(fakeRepo, 'skills', 'my-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: my-skill\ndescription: A test skill\n---\n# Test');

    const skills = skillManager.discoverSkills(fakeRepo);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('my-skill');
    expect(skills[0].description).toBe('A test skill');

    rmSync(fakeRepo, { recursive: true, force: true });
  });

  it('discovers single-skill repo with SKILL.md at root', () => {
    const fakeRepo = mkdtempSync(join(tmpdir(), 'miyagi-fake-repo-'));
    writeFileSync(join(fakeRepo, 'SKILL.md'), '---\nname: solo-skill\ndescription: Solo\n---\n# Solo');

    const skills = skillManager.discoverSkills(fakeRepo);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('solo-skill');

    rmSync(fakeRepo, { recursive: true, force: true });
  });

  it('returns empty when no SKILL.md found', () => {
    const fakeRepo = mkdtempSync(join(tmpdir(), 'miyagi-fake-repo-'));
    mkdirSync(join(fakeRepo, 'src'), { recursive: true });

    const skills = skillManager.discoverSkills(fakeRepo);
    expect(skills).toHaveLength(0);

    rmSync(fakeRepo, { recursive: true, force: true });
  });
});
```

### Step 2: Run tests

Run: `pnpm test -- tests/unit/skill-manager.test.ts`
Expected: PASS

### Step 3: Commit

```bash
git add tests/unit/skill-manager.test.ts
git commit -m "test(skills): add discoverSkills integration tests"
```

---

## Task 3: Rewrite CLI command — `install skills`

**Files:**
- Modify: `src/cli/commands/skill.ts`

### Step 1: Rewrite the `install` command registration

Change from `install skill <source> <agent>` to `install skills <source> <agent>` with `--skill` option and interactive checkbox when no `--skill` provided.

```typescript
import type { Command } from 'commander';
import { ConfigManager } from '../../core/config.js';
import { AgentManager } from '../../core/agent-manager.js';
import { SkillManager } from '../../core/skill-manager.js';

export function registerSkillCommands(program: Command): void {
  program
    .command('install')
    .argument('<type>', 'What to install: skills')
    .argument('<source>', 'Repository source (e.g. anthropics/skills)')
    .argument('<agent>', 'Target agent')
    .option('--skill <name>', 'Install a specific skill by name')
    .option('--no-integrate', 'Skip AI-powered identity.md update')
    .description('Install skills from a repository into an agent')
    .action(async (type, source, agent, opts) => {
      try {
        if (type !== 'skills') {
          console.error(`Unknown type "${type}". Supported types: skills`);
          process.exit(1);
        }

        const config = new ConfigManager();
        config.ensureDirectories();
        const agentManager = new AgentManager(config, process.cwd());
        const skillManager = new SkillManager(agentManager);

        let skillNames: string[];

        if (opts.skill) {
          // Direct install: miyagi install skills repo --skill name agent
          skillNames = await skillManager.install(source, agent, {
            skills: [opts.skill],
            noIntegrate: !opts.integrate,
          });
        } else {
          // Interactive: discover and let user choose
          const discovered = await skillManager.discoverFromRepo(source);
          if (discovered.length === 0) {
            console.error(`No skills found in repository "${source}".`);
            process.exit(1);
          }

          const { default: inquirer } = await import('inquirer');
          const { selected } = await inquirer.prompt<{ selected: string[] }>([
            {
              type: 'checkbox',
              name: 'selected',
              message: 'Select skills to install:',
              choices: discovered.map(s => ({
                name: `${s.name} — ${s.description}`,
                value: s.name,
                checked: false,
              })),
              validate: (answer: string[]) =>
                answer.length > 0 || 'Select at least one skill.',
            },
          ]);

          skillNames = await skillManager.install(source, agent, {
            skills: selected,
            noIntegrate: !opts.integrate,
          });
        }

        console.log(`Installed ${skillNames.length} skill(s) into agent "${agent}": ${skillNames.join(', ')}`);

        // AI-powered identity integration
        if (opts.integrate !== false) {
          console.log('Updating agent identity with skill references...');
          await skillManager.integrateSkillsIntoIdentity(agent, skillNames);
          console.log('Identity updated.');
        }
      } catch (err) {
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  // ... keep existing update command ...
}
```

### Step 2: Run lint

Run: `pnpm lint`
Expected: PASS

### Step 3: Commit

```bash
git add src/cli/commands/skill.ts
git commit -m "feat(cli): rewrite install command with interactive skill selection"
```

---

## Task 4: Add `discoverFromRepo()` method to SkillManager

**Files:**
- Modify: `src/core/skill-manager.ts`
- Test: `tests/unit/skill-manager-mock.test.ts`

This method clones the repo, discovers skills, cleans up, and returns the list (without installing). Used by the CLI for interactive selection before calling `install()`.

### Step 1: Write failing test

```typescript
describe('discoverFromRepo', () => {
  it('should clone repo and return discovered skills', async () => {
    mockedExecSync.mockReturnValue(Buffer.from(''));

    // discoverFromRepo clones, discovers, cleans up — returns skill metadata
    // Since the clone is mocked, the temp dir will be empty => returns []
    const result = await skillManager.discoverFromRepo('anthropics/skills');
    expect(result).toEqual([]);
    expect(mockedExecSync).toHaveBeenCalledWith(
      expect.stringMatching(/git clone --depth 1/),
      expect.any(Object),
    );
  });
});
```

### Step 2: Implement `discoverFromRepo()`

```typescript
async discoverFromRepo(source: string): Promise<Array<{ name: string; description: string; path: string }>> {
  const tmpDir = mkdtempSync(join(tmpdir(), 'miyagi-skill-'));

  try {
    const repoUrl = source.startsWith('http') ? source : `https://github.com/${source}.git`;
    execSync(`git clone --depth 1 ${repoUrl} ${tmpDir}`, { stdio: 'pipe' });
    return this.discoverSkills(tmpDir);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}
```

### Step 3: Run tests

Run: `pnpm test -- tests/unit/skill-manager-mock.test.ts`
Expected: PASS

### Step 4: Commit

```bash
git add src/core/skill-manager.ts tests/unit/skill-manager-mock.test.ts
git commit -m "feat(skills): add discoverFromRepo for interactive selection"
```

---

## Task 5: AI-powered identity.md integration

**Files:**
- Modify: `src/core/skill-manager.ts`
- Test: `tests/unit/skill-manager-mock.test.ts`

### Step 1: Write failing test

```typescript
describe('integrateSkillsIntoIdentity', () => {
  it('should read identity and skill files and call ClaudeBridge', async () => {
    await agentManager.create('test-agent', { author: 'test' });
    const agent = await agentManager.get('test-agent');

    // Create a skill with SKILL.md
    const skillDir = join(agent!.skillsDir, 'frontend-design');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      '---\nname: frontend-design\ndescription: Create frontend interfaces\n---\n# Frontend Design',
    );

    // integrateSkillsIntoIdentity should use ClaudeBridge — we'll test that it reads the files
    // and produces a valid prompt (actual Claude call is integration-tested separately)
    await expect(
      skillManager.integrateSkillsIntoIdentity('test-agent', ['frontend-design'])
    ).rejects.toThrow(); // Will fail because ClaudeBridge is not mocked — expected
  });
});
```

### Step 2: Implement `integrateSkillsIntoIdentity()`

Add to `SkillManager`:

```typescript
import { ClaudeBridge } from './claude-bridge.js';

async integrateSkillsIntoIdentity(agentName: string, skillNames: string[]): Promise<void> {
  const agent = await this.agentManager.get(agentName);
  if (!agent) throw new Error(`Agent "${agentName}" not found`);

  const identity = readFileSync(agent.identityPath, 'utf-8');

  // Collect skill metadata for each installed skill
  const skillSummaries: string[] = [];
  for (const name of skillNames) {
    const skillMdPath = join(agent.skillsDir, name, 'SKILL.md');
    if (!existsSync(skillMdPath)) continue;
    const metadata = this.parseSkillMetadata(skillMdPath);
    skillSummaries.push(`- **${metadata.name}**: ${metadata.description}`);
  }

  if (skillSummaries.length === 0) return;

  const prompt = [
    'You are updating an AI agent\'s identity file to reference newly installed skills.',
    'The agent\'s current identity.md is:',
    '```markdown',
    identity,
    '```',
    '',
    'The following skills were just installed:',
    ...skillSummaries,
    '',
    'INSTRUCTIONS:',
    '- Add a brief reference for each new skill under the "## Skill Directives" section.',
    '- For each skill, write ONE concise directive line explaining when and how the agent should use it.',
    '- If a "## Skill Directives" section does not exist, create it.',
    '- Do NOT remove or modify any existing content.',
    '- Do NOT add skills that are already referenced in the identity.',
    '- Output ONLY the complete updated identity.md content, no explanation, no markdown fences.',
  ].join('\n');

  const bridge = new ClaudeBridge();
  const args = bridge.buildBattleArgs({
    systemPrompt: '',
    prompt: '',
    model: 'sonnet',
  });

  const result = await bridge.runAndCapture(args, 60_000, prompt);
  const updatedIdentity = result.trim();

  if (updatedIdentity.length > 0) {
    writeFileSync(agent.identityPath, updatedIdentity);
  }
}
```

### Step 3: Run tests

Run: `pnpm test -- tests/unit/skill-manager-mock.test.ts`
Expected: PASS (the test expects a throw since ClaudeBridge isn't mocked)

### Step 4: Commit

```bash
git add src/core/skill-manager.ts tests/unit/skill-manager-mock.test.ts
git commit -m "feat(skills): add AI-powered identity.md integration via ClaudeBridge"
```

---

## Task 6: Update `updateAll()` to use new approach

**Files:**
- Modify: `src/core/skill-manager.ts`
- Modify: `tests/unit/skill-manager-mock.test.ts`

### Step 1: Update `updateAll()` implementation

Replace the `npx skills add` calls with the clone-extract-copy approach. Group skills by source repo to minimize clones.

```typescript
async updateAll(agentName: string): Promise<void> {
  const agent = await this.agentManager.get(agentName);
  if (!agent) throw new Error(`Agent "${agentName}" not found`);

  const installed = this.readInstalledSkills(agent.rootDir);
  if (installed.length === 0) return;

  // Group skills by source repo to minimize clones
  const bySource = new Map<string, string[]>();
  for (const skill of installed) {
    const skills = bySource.get(skill.source) ?? [];
    skills.push(skill.name);
    bySource.set(skill.source, skills);
  }

  for (const [source, skillNames] of bySource) {
    try {
      await this.install(source, agentName, { skills: skillNames, noIntegrate: true });
    } catch (err) {
      console.error(`Failed to update skills from "${source}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
```

### Step 2: Update mock tests for `updateAll()`

Adjust the existing `updateAll` tests to expect `git clone` calls instead of `npx skills add` calls. The tests should verify:
- One clone per unique source
- Skills are grouped by source

### Step 3: Run tests

Run: `pnpm test -- tests/unit/skill-manager-mock.test.ts`
Expected: PASS

### Step 4: Commit

```bash
git add src/core/skill-manager.ts tests/unit/skill-manager-mock.test.ts
git commit -m "refactor(skills): updateAll uses clone-extract-copy, groups by source"
```

---

## Task 7: Run full test suite and fix breakages

### Step 1: Run all tests

Run: `pnpm test`

### Step 2: Run lint

Run: `pnpm lint`

### Step 3: Fix any test failures

Files that reference the old `install()` signature or `npx skills add`:
- `tests/unit/skill-manager-mock.test.ts` — already updated
- `tests/unit/skill-manager.test.ts` — may need signature updates
- `tests/integration/cli-commands.test.ts` — check for install skill references
- `tests/integration/full-flow.test.ts` — check for install skill references
- `tests/unit/gap-core-fixes.test.ts` — check for install references
- `tests/unit/core-edge-cases.test.ts` — check for install references

### Step 4: Commit

```bash
git add -A
git commit -m "fix(tests): update all tests for new skill installation approach"
```

---

## Task 8: Update documentation

**Files:**
- Modify: `ARCHITECTURE.md`
- Modify: `AGENTS.md`
- Modify: `README.md`

### Step 1: Update ARCHITECTURE.md

In the **SkillManager** description, replace:
> Shells out to `npx skills add` for installation.

With:
> Clones GitHub repos to temp dir, discovers skills via `SKILL.md`, copies selected skills to agent's `skills/` dir. Supports interactive multi-select and `--skill` flag for targeted installs. Uses ClaudeBridge (sonnet) to update agent's `identity.md` with skill directives after installation.

### Step 2: Update AGENTS.md

Update the `src/core/` section for skill-manager.ts description.

### Step 3: Update README.md

Update the Skills section commands:
```
miyagi install skills <source> <agent>                    # Interactive: select skills to install
miyagi install skills <source> --skill <name> <agent>     # Install a specific skill
miyagi update skills <agent>                              # Update all installed skills
```

### Step 4: Commit

```bash
git add ARCHITECTURE.md AGENTS.md README.md
git commit -m "docs: update skill installation docs for clone-extract-copy approach"
```

---

## Task 9: Manual E2E verification

### Step 1: Build and install

```bash
pnpm build && npm install -g .
```

### Step 2: Test specific skill install

```bash
miyagi install skills anthropics/skills --skill frontend-design test-agent
```

Expected: Clones repo, copies `frontend-design` to `~/.miyagi/agents/test-agent/skills/frontend-design/`, updates `.installed-skills.json`, updates `identity.md` via Claude sonnet.

### Step 3: Verify files

```bash
ls ~/.miyagi/agents/test-agent/skills/frontend-design/
cat ~/.miyagi/agents/test-agent/.installed-skills.json
cat ~/.miyagi/agents/test-agent/identity.md | grep -A2 "Skill Directives"
```

### Step 4: Test interactive install

```bash
miyagi install skills anthropics/skills test-agent
```

Expected: Shows checkbox menu with all 18 skills from the anthropics/skills repo, lets user select multiple, installs selected, updates identity.md once with all selected skills.

### Step 5: Test update

```bash
miyagi update skills test-agent
```

Expected: Re-clones and re-copies all installed skills (grouped by source).

---

## Summary of all changed files

| File | Action |
|------|--------|
| `src/core/skill-manager.ts` | Rewrite `install()`, `updateAll()`, add `discoverSkills()`, `discoverFromRepo()`, `integrateSkillsIntoIdentity()` |
| `src/cli/commands/skill.ts` | Change `install skill` → `install skills`, add `--skill` option, add `--no-integrate`, add interactive checkbox |
| `tests/unit/skill-manager-mock.test.ts` | Rewrite install tests, add discoverFromRepo tests, add integration test |
| `tests/unit/skill-manager.test.ts` | Add `discoverSkills()` tests with real temp dirs |
| `ARCHITECTURE.md` | Update SkillManager description |
| `AGENTS.md` | Update skill-manager.ts description |
| `README.md` | Update skill install commands |
