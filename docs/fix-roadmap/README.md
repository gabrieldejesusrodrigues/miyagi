# Bug Fix Roadmap

**Date:** 2026-03-16
**Source:** `docs/bugs-found.md` (Round 3)
**Status:** ALL FIXED AND TESTED

## Critical — Security

- [x] **BUG-1/2: Path Traversal in Agent Names**
  - File: `src/core/agent-manager.ts`
  - Added `validateAgentName()` — rejects `/`, `\`, `..`, and non-alphanumeric-dash-underscore names
  - Called in `create()`, `clone()`, and `delete()`
  - Commit: `fix(security): add agent name validation to prevent path traversal`

## High — Core Functionality

- [x] **BUG-3/4/5: Static Assets Not Bundled in dist/**
  - Files: `scripts/copy-assets.cjs`, `package.json`, `src/cli/commands/agent.ts`
  - Added postbuild copy script for templates, reports, and builtin-agents
  - Wired up `TemplateLoader.applyTemplate()` in create command
  - Commit: `fix: bundle static assets in dist and apply templates on agent create`

- [x] **BUG-6: Battle `--prompt` Flag**
  - File: `src/core/claude-bridge.ts`
  - Replaced `args.push('--prompt', options.prompt)` with `args.push(options.prompt)`
  - Commit: `fix: pass battle prompt as positional arg instead of --prompt flag`

- [x] **BUG-7: Global Error Handling**
  - Files: `src/cli/commands/agent.ts`, `src/cli/commands/export-import.ts`, `src/cli/commands/skill.ts`, `src/cli/commands/battle.ts`, `src/core/skill-manager.ts`
  - Wrapped all async action handlers in try/catch
  - Moved `engine.validateMode()` inside existing try/catch in battle.ts
  - Commit: `fix: add try/catch error handling to CLI commands`

## Medium

- [x] **BUG-8: `train --revert` Git Crash**
  - File: `src/cli/commands/train.ts`
  - Wrapped simpleGit block in try/catch with clear "not a git repository" message
  - Commit: `fix: handle train --revert on non-git dirs, add custom help text, validate agent in sessions`

- [x] **BUG-9: Custom Help Not Shown**
  - File: `src/cli/program.ts`
  - Added `program.addHelpText('after', ...)` with Claude Code pass-through flags
  - Same commit as BUG-8

- [x] **BUG-10: Sessions Agent Validation**
  - File: `src/cli/commands/sessions.ts`
  - Added `AgentManager.get()` check before listing sessions
  - Same commit as BUG-8

- [x] **BUG-11: Skill Install Error Handling**
  - File: `src/core/skill-manager.ts`
  - Wrapped `execSync` in `install()` and `updateAll()` with try/catch
  - Same commit as BUG-7

## Commits (in order)

1. `540ee61` — fix(security): add agent name validation to prevent path traversal
2. `2355d4e` — fix: bundle static assets in dist and apply templates on agent create
3. `4d35396` — fix: pass battle prompt as positional arg instead of --prompt flag
4. `1750398` — fix: add try/catch error handling to CLI commands
5. `43bc953` — fix: handle train --revert on non-git dirs, add custom help text, validate agent in sessions
