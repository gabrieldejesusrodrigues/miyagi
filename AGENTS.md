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
```

All three must pass before committing. Run `pnpm test` after every change.

## Architecture

```
bin/miyagi.ts                    # Entry point -> src/cli/program.ts
src/
  cli/
    program.ts                   # Commander.js root, registers all commands
    commands/                    # 11 command files (agent, battle, use, etc.)
    display/                     # Terminal output formatters
    middleware/                   # Security validators for import/export
  core/                          # Stateless managers (config, agent, skill, session, etc.)
  battle/                        # BattleEngine, BattleMediator, modes/
  training/                      # Judge, Coach, scoring, history
  reports/                       # Handlebars HTML generator + templates + CSS
  templates/                     # 5 built-in agent templates (salesman, developer, etc.)
  builtin-agents/                # miyagi-judge, mr-miyagi identity files
  types/                         # All TypeScript interfaces (barrel: types/index.ts)
  utils/                         # Validators, archive helpers
tests/
  unit/                          # 22 unit test files
  integration/                   # 2 integration test files (create-agent, full-flow)
```

## Module Ownership

Each directory is an independent area. Agents working on one area should not need to touch others unless fixing cross-cutting bugs.

### `src/core/` — Core Infrastructure
- `config.ts` — ConfigManager: loads/saves `~/.miyagi/config.json`, manages directory structure
- `agent-manager.ts` — AgentManager: CRUD for agents in `~/.miyagi/agents/`
- `skill-manager.ts` — SkillManager: list/install/remove skills per agent
- `session-manager.ts` — SessionManager: records Claude session history
- `claude-bridge.ts` — ClaudeBridge: spawns `claude` CLI processes, builds arg arrays
- `impersonation.ts` — ImpersonationManager: symlinks skills, builds system prompt, cleanup traps
- `template-loader.ts` — TemplateLoader: lists/loads/applies built-in templates
- `claude-flags.ts` — Claude Code flag pass-through parser

**Tests:** `tests/unit/config.test.ts`, `agent-manager.test.ts`, `skill-manager.test.ts`, `session-manager.test.ts`, `claude-bridge.test.ts`, `impersonation.test.ts`, `core-edge-cases.test.ts`

### `src/battle/` — Battle System
- `engine.ts` — BattleEngine: creates configs, assembles results, validates modes
- `mediator.ts` — BattleMediator: turn-by-turn asymmetric battles, role prompts, termination detection
- `modes/` — 10 mode config files + `index.ts` registry

**Tests:** `tests/unit/battle-engine.test.ts`, `battle-mediator.test.ts`, `battle-modes.test.ts`, `battle-edge-cases.test.ts`

### `src/training/` — Judge, Coach, Scoring
- `judge.ts` — Judge: builds evaluation prompts, parses JudgeVerdict from LLM JSON
- `coach.ts` — Coach (Mr. Miyagi): builds coaching prompts, parses coaching changes
- `scoring.ts` — ELO calculator, dimensional scoring, trend detection
- `history.ts` — HistoryManager: reads/writes stats.json, battles.json, training-log.md

**Tests:** `tests/unit/judge.test.ts`, `coach.test.ts`, `scoring.test.ts`, `history.test.ts`, `training-edge-cases.test.ts`

### `src/cli/` — CLI Layer
- `program.ts` — Commander.js program with all command registrations
- `commands/` — 11 files, one per command group (agent, use, battle, train, stats, skill, export-import, templates, report, sessions, miyagi-help)
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
- Builtin agents: `miyagi-judge/identity.md`, `mr-miyagi/identity.md`
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

### Adding a battle mode
1. Create config file in `src/battle/modes/`
2. Add to registry in `src/battle/modes/index.ts`
3. Add to `BattleMode` union type in `src/types/battle.ts`
4. Add to `VALID_MODES` and `DEFAULT_ROUNDS` in `src/battle/engine.ts`
5. Verify via `tests/unit/battle-modes.test.ts`

## Known Gaps

See `docs/implementation-gaps.md` for 18 tracked issues with severity ratings and fix instructions. Critical items:
- `skill.ts` install/update commands are stubs (GAP-1)
- `use.ts` never records sessions (GAP-2)
- No JSON.parse error handling (GAP-3)
- Null assertions in `history.ts` (GAP-4)

## Dependencies

**Runtime:** commander, inquirer, chalk, ora, simple-git, handlebars, tar, archiver
**Dev:** typescript, vitest, tsup, @types/*

## CI/CD

- `.github/workflows/ci.yml` — Lint, test (Node 18/20/22), build, security audit
- `.github/workflows/release.yml` — npm publish on `v*` tags
- `.github/workflows/security.yml` — CodeQL, TruffleHog, dependency audit (weekly)
