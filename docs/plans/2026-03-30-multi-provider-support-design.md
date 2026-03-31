# Multi-Provider Support Design

**Date:** 2026-03-30
**Status:** Approved

## Overview

Add multi-provider support to Miyagi CLI so agents can run on Claude Code (default), Gemini CLI, or Codex CLI. Each agent in a battle can use a different provider/model.

## Model Spec Format

Single `model` field with `provider/model` prefix format:

```
claude/opus           → provider: claude, model: opus
claude/sonnet         → provider: claude, model: sonnet
gemini/gemini-2.5-pro → provider: gemini, model: gemini-2.5-pro
codex/o4-mini         → provider: codex,  model: o4-mini
```

If absent or empty → `claude/sonnet` (default).

## Resolution Priority (high → low)

1. CLI flag: `--model` (use) / `--model-a`, `--model-b` (battle)
2. Agent manifest: `manifest.json → model`
3. Global config: `~/.miyagi/config.json → defaultModel`
4. Hardcoded default: `claude/sonnet`

## Architecture: Provider Adapter Pattern

```
ProviderBridge (interface)
  ├── buildSessionArgs()
  ├── buildBattleArgs()
  ├── buildBattleStdin()
  ├── spawnInteractive()
  ├── runAndCapture()
  ├── setupSkills()
  └── cleanupSkills()

ClaudeBridge implements ProviderBridge
GeminiBridge implements ProviderBridge
CodexBridge implements ProviderBridge

createBridge(modelSpec) → ProviderBridge
parseModelSpec("gemini/gemini-2.5-pro") → { provider: "gemini", model: "gemini-2.5-pro" }
resolveModel(cliOverride?, manifest?, globalConfig?) → ModelSpec
```

## New Types

```typescript
// src/types/provider.ts
type ProviderName = 'claude' | 'gemini' | 'codex';
interface ModelSpec { provider: ProviderName; model: string; }
interface ProviderBridge { ... }
interface SessionOptions { ... }
interface BattleAgentOptions { ... }
```

## Type Changes

- `AgentManifest`: add optional `model?: string`
- `MiyagiConfig`: add `judge?: { model?: string }`, `coach?: { model?: string }`
- `BattleConfig`: add `modelA?: string`, `modelB?: string`

## CLI Changes

```bash
miyagi use <agent> --model provider/model
miyagi battle <a> <b> --model provider/model
miyagi battle <a> <b> --model-a provider/model --model-b provider/model
miyagi config get|set|list|reset <key> [value]
```

## Provider Comparison

| Feature | Claude Code | Gemini CLI | Codex CLI |
|---|---|---|---|
| Binary | `claude` | `gemini` | `codex` |
| Non-interactive | `--print` | `-p` | `exec` subcommand |
| System prompt | `--append-system-prompt` | `GEMINI.md` files | `-c instructions=` |
| Model | `--model` | `--model` / `-m` | `--model` / `-m` |
| Skip permissions | `--dangerously-skip-permissions` | `--yolo` | `--yolo` |
| Custom commands | `~/.claude/commands/` (md) | `~/.gemini/commands/` (TOML) | Skills via config.toml (md) |
| Effort | `--effort` | N/A | N/A |

## File Structure

```
src/core/providers/
  types.ts            # ProviderBridge interface, ModelSpec, parseModelSpec, resolveModel
  claude-bridge.ts    # ClaudeBridge implements ProviderBridge
  gemini-bridge.ts    # GeminiBridge implements ProviderBridge
  codex-bridge.ts     # CodexBridge implements ProviderBridge
  factory.ts          # createBridge(modelSpec)
  index.ts            # barrel export
```

## ImpersonationManager Refactor

Remove `claudeSkillsDir` from constructor. Skills managed by `bridge.setupSkills()` / `bridge.cleanupSkills()`. ImpersonationManager only builds system prompt and delegates skill lifecycle to the active bridge.

## Judge & Coach

Separate configuration via `miyagi config set judge.model` and `miyagi config set coach.model`. Default: judge uses `claude/opus`, coach uses `claude/sonnet`.

## Documentation

Update README.md, AGENTS.md, ARCHITECTURE.md with multi-provider info.

## Testing

- Unit tests for parseModelSpec, resolveModel, factory, each bridge
- Real e2e testing: build locally, test CLI commands with Claude and Gemini
- Codex tested via unit tests only (not installed)
