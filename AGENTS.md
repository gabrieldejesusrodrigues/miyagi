# AGENTS.md — Miyagi CLI

Multi-agent development guide for the Miyagi CLI project.

**Architecture:** See [ARCHITECTURE.md](./ARCHITECTURE.md) for layer diagrams, data flows, type system, filesystem layout, and the full battle/impersonation pipelines.

## Project Overview

Miyagi is an npm-installable CLI that wraps Claude Code to provide agent creation, skill management, battle training, and coaching. TypeScript, ESM-only, Node >= 18.

## Commands

```bash
pnpm build          # Build with tsup -> dist/bin/miyagi.js
pnpm test           # Run all tests with vitest
pnpm lint           # TypeScript strict check (tsc --noEmit)
pnpm test -- tests/unit/config.test.ts   # Run single test file
pnpm test -- tests/unit/model-spec.test.ts   # Run a specific test
```

All three must pass before committing. Run `pnpm test` after every change.

## Architecture

```
bin/miyagi.ts                    # Entry point -> src/cli/program.ts
src/
  cli/
    program.ts                   # Commander.js root, registers all commands
    commands/                    # 12 command files (agent, battle, battle-status, use, etc.)
    display/                     # Terminal output formatters
    middleware/                   # Security validators for import/export
  core/                          # Stateless managers (config, agent, skill, session, etc.)
    providers/                   # ProviderBridge interface + Claude/Gemini/Codex implementations
  battle/                        # BattleEngine, BattleMediator, modes/, background, runner
  training/                      # Judge, Coach, scoring, history
  reports/                       # Handlebars HTML generator + templates + CSS
  templates/                     # 5 built-in agent templates (salesman, developer, etc.)
  builtin-agents/                # miyagi-judge, mr-miyagi identity files
  types/                         # All TypeScript interfaces (barrel: types/index.ts)
  utils/                         # Validators, archive helpers, JSON parser
tests/
  unit/                          # 38 unit test files (292 tests)
  integration/                   # 2 integration test files (create-agent, full-flow)
```

## Module Ownership

Each directory is an independent area. Agents working on one area should not need to touch others unless fixing cross-cutting bugs.

### `src/core/` — Core Infrastructure
- `config.ts` — ConfigManager: loads/saves `~/.miyagi/config.json`, manages directory structure (`agentsDir`, `templatesDir`, `reportsDir`)
- `agent-manager.ts` — AgentManager: CRUD for agents in `~/.miyagi/agents/`
- `skill-manager.ts` — SkillManager: list/install/remove skills per agent. Installs by cloning GitHub repos to temp dir, discovering skills via `SKILL.md`, copying to agent's `skills/` dir. Supports interactive multi-select and `--skill` flag. Uses ClaudeBridge (sonnet) to update agent's `identity.md` with skill directives after installation.
- `session-manager.ts` — SessionManager: records Claude session history
- `claude-bridge.ts` — Re-exports from providers/ for backward compatibility
- `impersonation.ts` — ImpersonationManager: builds system prompt, delegates skill setup to ProviderBridge. Constructor takes AgentManager only (no claudeSkillsDir).
- `template-loader.ts` — TemplateLoader: lists/loads/applies built-in and user-installed templates. Supports `install()` (from directory source), `createFromAgent()` (extract template from agent), `delete()` (remove user template). Merges built-in + user template directories in `list()`.
- `claude-flags.ts` — Claude Code flag pass-through parser

**Tests:** `tests/unit/config.test.ts`, `agent-manager.test.ts`, `skill-manager.test.ts`, `session-manager.test.ts`, `claude-bridge.test.ts`, `impersonation.test.ts`, `core-edge-cases.test.ts`, `template-install-create.test.ts`

### `src/core/providers/` — Provider Bridges
- `types.ts` — ProviderBridge interface definition
- `claude-bridge.ts` — ClaudeBridge: `--print`, `--append-system-prompt`, `--dangerously-skip-permissions`, symlink skills to `~/.claude/commands/`
- `gemini-bridge.ts` — GeminiBridge: `-p` non-interactive, `--yolo`, TOML skills to `~/.gemini/commands/`
- `codex-bridge.ts` — CodexBridge: `exec` subcommand, `-c instructions=`, `--yolo`
- `factory.ts` — `createBridge(ModelSpec)` returns correct bridge for provider
- `index.ts` — barrel export

**Tests:** `tests/unit/claude-bridge.test.ts`, `claude-bridge-mock.test.ts`, `gemini-bridge.test.ts`, `codex-bridge.test.ts`, `provider-factory.test.ts`, `model-spec.test.ts`

### `src/battle/` — Battle System
- `engine.ts` — BattleEngine: creates configs, assembles results, validates modes. Runs agents in isolated temp directories (`/tmp/miyagi-battle-*`) with `--dangerously-skip-permissions` so agents can write and execute code. Persistent workspaces across rounds (agents build on their work). Collects generated files (up to 30KB) from the final workspace state and appends to the last round response. 10-minute timeout per agent call. Cleanup via `finally` blocks. Symmetric battles include a planning phase (round 0) before execution rounds.
- `planner.ts` — BattlePlanner: pure functions for the planning phase. `parsePlan()` extracts deliverable/approach/steps from Markdown. `mapStepsToRounds()` distributes steps via balanced `floor(N/M) + remainder` heuristic to avoid empty rounds. `buildPlanningPrompt()` generates round 0 prompt with deliverable disambiguation. `buildExecutionPrompt()` generates per-round directed prompts.
- `mediator.ts` — BattleMediator: turn-by-turn asymmetric battles, role prompts, termination detection
- `modes/` — 10 mode config files + `index.ts` registry
- `background.ts` — Background battle launcher: `launchBackground()` spawns detached child process, `getBattleStatus()` detects status via PID liveness and file presence, `getBattleInfo()` and `listBattles()` for querying battle state from `~/.miyagi/battles/`
- `runner.ts` — Background battle runner: `runBattleBackground()` reads config from disk, executes full pipeline (engine → judge → coach → save), writes progress.jsonl, result.json, verdict.json, cleans up PID file

**Tests:** `tests/unit/battle-engine.test.ts`, `battle-mediator.test.ts`, `battle-modes.test.ts`, `battle-edge-cases.test.ts`, `battle-temp-dirs.test.ts`, `battle-planner.test.ts`, `background-launcher.test.ts`, `battle-runner.test.ts`

### `src/training/` — Judge, Coach, Scoring
- `judge.ts` — Judge: builds evaluation prompts with task verification requirements, parses JudgeVerdict from LLM JSON. Uses "contestant" terminology to avoid role confusion. Instructs judge to verify actual generated files against agent claims. Retry logic (2 attempts).
- `coach.ts` — Coach (Mr. Miyagi): builds coaching prompts with full battle transcript, agent identity, manifest (description, domains, templateOrigin). Prompt uses "student" framing to distinguish coached agent from coach. Retry logic (2 attempts). Transcript truncated to 3K per output to manage prompt size.
- `scoring.ts` — ELO calculator (K=32, floor at 0), dimensional scoring, trend detection
- `history.ts` — HistoryManager: reads/writes stats.json, battles.json, training-log.md. Also `saveBattleData()`/`getBattleData()` for persisting full BattleResult + JudgeVerdict to `reports/battle-data/<id>.json` with battleId sanitization.

**Tests:** `tests/unit/judge.test.ts`, `coach.test.ts`, `scoring.test.ts`, `history.test.ts`, `training-edge-cases.test.ts`, `auto-coach.test.ts`, `battle-report-integration.test.ts`

### `src/cli/` — CLI Layer
- `program.ts` — Commander.js program with all command registrations
- `commands/` — 11 files, one per command group:
  - `agent.ts` — create, edit, delete, clone, list
  - `battle.ts` — Battle two agents. Supports `--background` for detached execution. After judge verdict: auto-coaches both agents with Mr. Miyagi (domain-specific, with battle transcript). Saves full battle data for report generation.
  - `battle-status.ts` — `miyagi battle status [id]` shows background battle progress; `miyagi battle list` shows recent battles in a table
  - `train.ts` — Manual Mr. Miyagi coaching session
  - `templates.ts` — list, install (from directory, `--force`), create (from agent, `--from` or interactive), delete
  - `report.ts` — Generate HTML reports: `--type profile` (agent stats) or `--type battle` (from saved battle data)
  - `use.ts`, `stats.ts`, `skill.ts`, `export-import.ts`, `sessions.ts`, `miyagi-help.ts`
  - `config.ts` — `miyagi config get/set/list/reset` for managing global configuration
- `display/stats-display.ts` — Terminal stats rendering (pure string formatting)
- `middleware/security.ts` — Archive entry validation (path traversal, symlinks, size)

**Tests:** `tests/unit/cli-program.test.ts`, `help.test.ts`, `claude-flags.test.ts`, `stats-display.test.ts`, `archive-security.test.ts`, `misc-edge-cases.test.ts`

### `src/reports/` — HTML Report Generation
- `generator.ts` — ReportGenerator: compiles Handlebars templates, inlines CSS
- `templates/` — `battle.hbs`, `profile.hbs`
- `assets/styles.css` — Dark theme design system

**Tests:** `tests/unit/report-generator.test.ts`

### `src/types/` — Type Definitions
- `agent.ts`, `battle.ts`, `config.ts`, `scoring.ts`, `skill.ts`, `index.ts` (barrel)
- All modules import types from `../types/index.js`

**Tests:** `tests/unit/types.test.ts`

### `src/templates/` and `src/builtin-agents/` — Static Content
- Templates: `salesman/`, `developer/`, `business-analyst/`, `writer/`, `support-rep/` (each has `manifest.json` + `identity.md`)
- Builtin agents:
  - `miyagi-judge/identity.md` — Impartial battle arbiter with task verification, file-aware evaluation, domain-adaptive scoring
  - `mr-miyagi/identity.md` — Master coach with critical/realistic tone, specialist-not-generalist philosophy, domain-specific coaching techniques (coding, sales, support, writing, BA)
- These are markdown/JSON content files — no TypeScript

## Conventions

- **ESM only** — All imports use `.js` extension: `import { Foo } from './foo.js'`
- **Strict TypeScript** — `strict: true` in tsconfig. No `any` types without justification.
- **No default exports** — All exports are named.
- **TDD** — Write failing tests first, then implement. Tests live in `tests/unit/` or `tests/integration/`.
- **Vitest** — Test runner. Use `describe`, `it`, `expect`, `beforeEach`, `afterEach`.
- **Temp dirs for tests** — Always use `mkdtempSync(join(tmpdir(), 'miyagi-test-'))` and clean up with `rmSync` in `afterEach`.
- **No mocking fs** — Tests use real temp directories, not mocked filesystems.
- **Commit messages** — Conventional commits: `feat:`, `fix:`, `test:`, `chore:`, `ci:`, `docs:`

## Key Patterns

### Creating a new core module
1. Define types in `src/types/` if needed
2. Write test file in `tests/unit/`
3. Implement in `src/core/` (or appropriate directory)
4. Run `pnpm test` and `pnpm lint`

### Adding a CLI command
1. Create command file in `src/cli/commands/`
2. Register in `src/cli/program.ts` (import + call register function)
3. Wire to core modules (ConfigManager, AgentManager, etc.)
4. Add command name check in `tests/unit/cli-program.test.ts`

### Adding a new provider
1. Create bridge in `src/core/providers/` implementing `ProviderBridge`
2. Add to factory in `src/core/providers/factory.ts`
3. Add provider name to `ProviderName` union in `src/types/provider.ts`
4. Add to `VALID_PROVIDERS` set in `src/types/provider.ts`
5. Write tests in `tests/unit/`
6. Update `src/core/providers/index.ts` barrel export

### Adding a battle mode
1. Create config file in `src/battle/modes/`
2. Add to registry in `src/battle/modes/index.ts`
3. Add to `BattleMode` union type in `src/types/battle.ts`
4. Add to `VALID_MODES` and `DEFAULT_ROUNDS` in `src/battle/engine.ts`
5. Verify via `tests/unit/battle-modes.test.ts`

## Dependencies

**Runtime:** commander, inquirer, chalk, ora, simple-git, handlebars, tar, archiver
**Dev:** typescript, vitest, tsup, @types/*

## CI/CD

- `.github/workflows/ci.yml` — Lint, test (Node 18/20/22), build, security audit
- `.github/workflows/release.yml` — npm publish on `v*` tags
- `.github/workflows/security.yml` — CodeQL, TruffleHog, dependency audit (weekly)
