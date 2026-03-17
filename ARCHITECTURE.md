# ARCHITECTURE.md — Miyagi CLI

## System Overview

Miyagi is a CLI tool that wraps Claude Code to manage AI agents — creating them, equipping them with skills, battling them against each other, and coaching them to improve. It is a TypeScript ESM project built with Commander.js, Handlebars, and Vitest.

```
User
  |
  v
bin/miyagi.ts  ──>  src/cli/program.ts  ──>  Command Handlers
                                                    |
                                    ┌───────────────┼───────────────┐
                                    v               v               v
                              Core Layer      Battle Layer     Training Layer
                            (config, agents,  (engine,         (judge, coach,
                             skills, sessions  mediator,        scoring,
                             claude-bridge,    10 modes)        history)
                             impersonation,
                             templates)
                                    |               |               |
                                    v               v               v
                              Filesystem        Claude CLI      Reports
                            (~/.miyagi/)        (subprocess)    (HTML/CSS)
```

## Layers

### 1. Entry & CLI Routing

```
bin/miyagi.ts
  └── src/cli/program.ts          # Creates Commander.js program
        ├── commands/agent.ts      # create, edit, delete, clone, list
        ├── commands/use.ts        # Start Claude session as agent
        ├── commands/battle.ts     # Battle two agents
        ├── commands/train.ts      # Mr. Miyagi coaching
        ├── commands/stats.ts      # Terminal stats display
        ├── commands/skill.ts      # install, update skills
        ├── commands/export-import.ts
        ├── commands/templates.ts
        ├── commands/report.ts
        ├── commands/sessions.ts
        └── commands/miyagi-help.ts
```

`program.ts` imports 10 register functions, each of which adds commands to the Commander program. Command handlers instantiate core modules (ConfigManager, AgentManager, etc.) and delegate to them. The CLI layer has no business logic — it is pure routing and user I/O.

### 2. Core Infrastructure (`src/core/`)

These modules manage persistent state and external process interaction. They form the foundation everything else builds on.

```
ConfigManager ◄──────────────── AgentManager ◄──── SkillManager
     │                              ▲    ▲              │
     │                              │    │         (reads agent
     │                              │    │          skills dir)
     │                     ImpersonationManager
     │                         (symlinks skills,
     │                          builds prompts)
     │
SessionManager                 ClaudeBridge            TemplateLoader
(standalone)                  (standalone)             (standalone)
```

**ConfigManager** — Root of the dependency tree. Manages `~/.miyagi/` directory structure and `config.json`. All other managers receive it as a constructor parameter.

**AgentManager** — CRUD for agents. Creates directory structure (`manifest.json`, `identity.md`, `context/`, `skills/`, `history/`). Supports two scopes:
- Global: `~/.miyagi/agents/{name}/`
- Project-local: `{cwd}/.miyagi/agents/{name}/` (checked first, shadows global)

**SkillManager** — Manages skills within an agent's `skills/` directory. Parses `SKILL.md` frontmatter for metadata. Tracks installed vs custom skills via `.installed-skills.json`. Shells out to `npx skills add` for installation.

**SessionManager** — Persists Claude session records to `sessions.json`. Standalone — depends only on `fs` and `crypto`.

**ClaudeBridge** — Spawns `claude` CLI processes. Builds argument arrays for:
- Interactive sessions (`stdio: 'inherit'` — for `miyagi use`)
- Non-interactive capture (`stdio: 'pipe'` — for battles and judging)
Locates the `claude` binary via `which claude`. Supports `cwd` parameter for spawning in isolated temp directories.

**ImpersonationManager** — Activates an agent by symlinking its skills into Claude's commands directory with prefixed names (`miyagi-{agent}-{skill}`). Builds system prompts by concatenating `identity.md` + all `context/*.md` files. Registers SIGINT/SIGTERM/exit handlers for cleanup.

**TemplateLoader** — Manages both built-in templates (from `src/templates/`) and user-installed templates (from `~/.miyagi/templates/`). Supports `list()` (merged from both dirs), `install()` (validate manifest + copy to user dir, with `--force`), `createFromAgent()` (extract template from existing agent), `delete()` (remove user template), `getTemplate()`, and `applyTemplate()`.

**claude-flags.ts** — Defines all Claude Code CLI flags and a parser that separates miyagi-specific args from Claude pass-through args. Used by command handlers to forward flags like `--model`, `--effort`, `--worktree` to the underlying `claude` process.

### 3. Battle System (`src/battle/`)

```
BattleEngine                    BattleMediator
  │                                │
  ├── createConfig()               ├── buildRolePrompts()
  ├── validateMode()               ├── formatHistory()
  ├── assembleResult()             ├── isNaturalEnd()
  │                                └── buildTurnPrompt()
  │
  └── modes/index.ts  ◄── 10 mode config files
        ├── same-task         (symmetric, 1 round)
        ├── code-challenge    (symmetric, 1 round)
        ├── speed-run         (symmetric, 1 round)
        ├── review-duel       (symmetric, 2 rounds)
        ├── iterative-refinement (symmetric, 3 rounds)
        ├── debate            (asymmetric, 5 rounds)
        ├── support-ticket    (asymmetric, 4 rounds)
        ├── interview         (asymmetric, 6 rounds)
        ├── negotiation       (asymmetric, 8 rounds)
        └── sales-roleplay    (asymmetric, 10 rounds)
```

**BattleEngine** — Creates `BattleConfig` objects with unique IDs, validates modes against the registry, and assembles final `BattleResult` objects from collected rounds. Runs agents in persistent isolated temp directories (`/tmp/miyagi-battle-*`) with `--dangerously-skip-permissions` so agents can write and execute code. Workspaces persist across rounds so agents can build iteratively. Collects actual generated files (up to 30KB, blacklisting `node_modules`, lock files, etc.) from the final workspace and appends to the last round response for judge/coach evaluation. 10-minute timeout per agent call. Cleanup via `finally` blocks.

**BattleMediator** — Handles turn-by-turn asymmetric battles. Builds role-specific prompts from `BattleModeConfig`, maintains conversation history, and detects natural termination signals (`[END_CONVERSATION]`, `[DEAL_CLOSED]`, etc.).

**Battle Modes** — Each mode is a `BattleModeConfig` object defining: name, type (symmetric/asymmetric), description, default rounds, and optional role names. The `modes/index.ts` registry provides lookup and listing.

**Symmetric vs Asymmetric:**
- Symmetric: Both agents receive the same task independently. Judge compares outputs.
- Asymmetric: Agents play different roles (e.g., salesperson/customer). Mediator passes responses between them turn by turn.

### 4. Training System (`src/training/`)

```
                    BattleResult
                        │
                        v
                      Judge  ──reads──>  builtin-agents/miyagi-judge/identity.md
                        │
                        v
                   JudgeVerdict
                     │       │
                     v       v
                  Coach    HistoryManager  ──uses──>  scoring.ts
                    │           │
reads identity      │           ├── stats.json     (AgentStats)
from mr-miyagi/     │           ├── battles.json   (battle log)
                    │           └── training-log.md (markdown)
                    v
             CoachingResult
           (suggested changes
            to identity.md,
            context files)
```

**Judge** — Takes a `BattleResult`, builds a structured evaluation prompt using "contestant" terminology (to avoid role confusion), sends it to Claude (via ClaudeBridge), and parses the response into a `JudgeVerdict`. The judge verifies task completion against the original requirements and evaluates actual generated files (not just agent descriptions). Retry logic (2 attempts) handles JSON parse failures.

**Coach (Mr. Miyagi)** — Takes a `JudgeVerdict`, the agent's current identity, manifest (description, domains, templateOrigin), and the full battle transcript. Builds a coaching prompt using "student" framing and produces a `CoachingResult` with specific file changes. The Mr. Miyagi identity enforces critical/realistic tone (no empty praise), specialist focus (deepen expertise, don't generalize), and domain-specific techniques (design patterns for devs, SPIN/MEDDIC for sales, etc.). Retry logic (2 attempts). Transcript truncated to 3K per output.

**Auto-coaching** — After every battle, coaching runs automatically for both agents via `battle.ts`. No need for manual `miyagi train` calls (though manual training is still available for standalone coaching sessions).

**scoring.ts** — Pure functions:
- `calculateElo(winnerRating, loserRating, outcome)` — Standard ELO with K=32
- `updateDimensionScores(existing, newScores)` — Appends scores to history, recalculates trends
- `determineTrend(history)` — Analyzes last 5 values for up/down/stable (0.2 threshold)

**HistoryManager** — Persistence layer for training data. Reads/writes `stats.json` (AgentStats), appends to `battles.json`, updates battle records (W/L/D), dimensional scores, and training log. Also persists full battle data (BattleResult + JudgeVerdict) to `reports/battle-data/<id>.json` via `saveBattleData()`/`getBattleData()` for report generation. Battle ID sanitization prevents path traversal.

### 5. Reports (`src/reports/`)

```
ReportGenerator
  ├── reads templates/battle.hbs
  ├── reads templates/profile.hbs
  ├── reads assets/styles.css
  ├── registers Handlebars helpers (winnerClass, multiply)
  └── writes self-contained HTML files
```

Generates standalone HTML reports with inlined CSS. Dark theme (`#0d1117` background) with responsive grid layout. Two report types:
- **Battle report** (`miyagi report <battle-id> --type battle`) — Shows result, narrative, round transcripts, coaching priorities. Reads from `reports/battle-data/<id>.json`.
- **Profile report** (`miyagi report <agent> --type profile`) — Shows battle record, ELO ratings, skill dimension bars

### 6. Security (`src/cli/middleware/security.ts`, `src/utils/archive.ts`)

Archive import/export with security validation:
- Rejects path traversal (`../`), absolute paths, symlinks
- Enforces 1MB file size limit
- Warns on executable files (`.sh`, `.py`, `.rb`)
- Validates import directories for required `manifest.json`

Export supports both `tar.gz` and `zip` formats.

## Type System (`src/types/`)

All types are defined in `src/types/` and re-exported through `index.ts`:

```
agent.ts    ── AgentManifest, Agent, InstalledSkillEntry
skill.ts    ── SkillMetadata, AgentSkill
battle.ts   ── BattleType, BattleMode (10 literals), BattleModeConfig,
               BattleConfig, BattleRound, BattleResult
scoring.ts  ── DimensionScore, AgentStats, JudgeVerdict, AgentAnalysis
config.ts   ── MiyagiConfig, SessionEntry
```

All modules import types from `../types/index.js`. Types are interfaces/type aliases only — no runtime code.

## Data Flow: Full Battle Pipeline

```
1. CLI: miyagi battle agentA agentB --mode sales-roleplay
         │
2. Validate: AgentManager.get() both agents exist
         │
3. Configure: BattleEngine.createConfig() → BattleConfig
         │
4. Execute: Create persistent temp dirs per agent (/tmp/miyagi-battle-*)
         │   For each round:
         │   ├── BattleMediator.buildRolePrompts() (asymmetric only)
         │   ├── BattleMediator.buildTurnPrompt() with history
         │   ├── ClaudeBridge.runAndCapture(cwd=tempDir, --dangerously-skip-permissions)
         │   ├── BattleMediator.isNaturalEnd() check
         │   └── Collect BattleRound
         │   After last round:
         │   ├── collectGeneratedFiles(tempDir) → append actual code to last round
         │   └── Cleanup temp dirs (finally block)
         │
5. Assemble: BattleEngine.assembleResult() → BattleResult
         │
6. Judge: Judge.buildEvaluationPrompt(result) with task verification
         │   └── ClaudeBridge.runAndCapture() → raw JSON (retry 2x)
         │   └── Judge.parseVerdict() → JudgeVerdict
         │
7. Record: HistoryManager.recordBattle() for both agents
         │   └── HistoryManager.updateStats() with scoring
         │   └── HistoryManager.saveBattleData() for report generation
         │
8. Auto-Coach: For each agent:
         │   ├── Build transcript (student output + opponent output, truncated)
         │   ├── Coach.buildCoachingPrompt(verdict, identity, manifest, transcript)
         │   ├── ClaudeBridge.runAndCapture() → CoachingResult (retry 2x)
         │   ├── Coach.applyChanges() → modify identity.md/context/skills
         │   └── HistoryManager.appendTrainingLog() + addCoachNote()
         │
9. Report: miyagi report <battle-id> --type battle → HTML file
```

## Data Flow: Agent Impersonation

```
1. CLI: miyagi use my-agent --model opus
         │
2. Resolve: AgentManager.get('my-agent')
         │
3. Activate: ImpersonationManager.activate()
         │   └── Symlink each skill: agent/skills/X → claude/commands/miyagi-my-agent-X
         │   └── Register cleanup traps (SIGINT, SIGTERM, exit)
         │
4. Prompt: ImpersonationManager.buildSystemPrompt()
         │   └── Read identity.md + all context/*.md files
         │
5. Launch: ClaudeBridge.spawnInteractive(sessionArgs)
         │   └── --append-system-prompt <identity+context>
         │   └── Pass-through: --model opus
         │
6. Cleanup: On process exit → ImpersonationManager.deactivate()
         │   └── Remove all miyagi-* symlinks
```

## Filesystem Layout

```
~/.miyagi/                          # Global miyagi root (ConfigManager.root)
  config.json                       # MiyagiConfig
  sessions.json                     # SessionEntry[]
  agents/
    {agent-name}/
      manifest.json                 # AgentManifest
      identity.md                   # Agent personality, strategy, directives
      .installed-skills.json        # InstalledSkillEntry[]
      context/                      # Domain knowledge (.md files)
      skills/                       # Skill directories (each has SKILL.md)
      history/
        stats.json                  # AgentStats (ELO, dimensions, record)
        battles.json                # Battle log entries
        training-log.md             # Coaching session notes
  templates/                        # User-installed templates (install/create/delete)
  reports/                          # Generated HTML reports
    battle-data/                    # Full battle results + verdicts (JSON per battle ID)
      {battle-id}.json              # { result: BattleResult, verdict: JudgeVerdict }

{project}/.miyagi/agents/           # Project-scoped agents (shadows global)
```

## Build & Bundle

```
tsup.config.ts
  entry: bin/miyagi.ts
  format: ESM
  target: node18
  output: dist/bin/miyagi.js (single bundle, ~95KB)
  banner: #!/usr/bin/env node
```

The entire CLI bundles into a single file. Runtime assets (templates, builtin-agents, report templates/CSS) are accessed via `__dirname`-relative paths from source, not from dist — they are included in the npm package via the `files` field in `package.json`.
