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
Locates the `claude` binary via `which claude`.

**ImpersonationManager** — Activates an agent by symlinking its skills into Claude's commands directory with prefixed names (`miyagi-{agent}-{skill}`). Builds system prompts by concatenating `identity.md` + all `context/*.md` files. Registers SIGINT/SIGTERM/exit handlers for cleanup.

**TemplateLoader** — Reads built-in templates from `src/templates/`. Lists available templates, loads manifest + identity content, and copies template files into new agent directories.

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

**BattleEngine** — Creates `BattleConfig` objects with unique IDs, validates modes against the registry, and assembles final `BattleResult` objects from collected rounds.

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

**Judge** — Takes a `BattleResult`, builds a structured evaluation prompt, sends it to Claude (via ClaudeBridge), and parses the response into a `JudgeVerdict` containing: winner, analysis per agent, dimension scores, and coaching priorities.

**Coach (Mr. Miyagi)** — Takes a `JudgeVerdict` and the agent's current files, builds a coaching prompt, and produces a `CoachingResult` with specific file changes (add/modify/remove) to improve the agent.

**scoring.ts** — Pure functions:
- `calculateElo(winnerRating, loserRating, outcome)` — Standard ELO with K=32
- `updateDimensionScores(existing, newScores)` — Appends scores to history, recalculates trends
- `determineTrend(history)` — Analyzes last 5 values for up/down/stable (0.2 threshold)

**HistoryManager** — Persistence layer for training data. Reads/writes `stats.json` (AgentStats), appends to `battles.json`, updates battle records (W/L/D), dimensional scores, and training log.

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
- **Battle report** — Shows result, narrative, round transcripts, coaching priorities
- **Profile report** — Shows battle record, ELO ratings, skill dimension bars

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
4. Execute: For each round:
         │   ├── BattleMediator.buildRolePrompts()
         │   ├── BattleMediator.buildTurnPrompt() with history
         │   ├── ClaudeBridge.runAndCapture() for each agent
         │   ├── BattleMediator.isNaturalEnd() check
         │   └── Collect BattleRound
         │
5. Assemble: BattleEngine.assembleResult() → BattleResult
         │
6. Judge: Judge.buildEvaluationPrompt(result)
         │   └── ClaudeBridge.runAndCapture() → raw JSON
         │   └── Judge.parseVerdict() → JudgeVerdict
         │
7. Record: HistoryManager.recordBattle() for both agents
         │   └── HistoryManager.updateStats() with scoring
         │
8. Coach: Coach.buildCoachingPrompt(verdict)
         │   └── ClaudeBridge.runAndCapture() → CoachingResult
         │   └── Apply changes to identity.md/context
         │
9. Report: ReportGenerator.generateBattleReport() → HTML file
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
  templates/                        # User-installed templates
  reports/                          # Generated HTML reports

{project}/.miyagi/agents/           # Project-scoped agents (shadows global)
```

## Build & Bundle

```
tsup.config.ts
  entry: bin/miyagi.ts
  format: ESM
  target: node18
  output: dist/bin/miyagi.js (single bundle, ~48KB)
  banner: #!/usr/bin/env node
```

The entire CLI bundles into a single file. Runtime assets (templates, builtin-agents, report templates/CSS) are accessed via `__dirname`-relative paths from source, not from dist — they are included in the npm package via the `files` field in `package.json`.
