# Miyagi CLI - Manual Test Results

**Date:** 2026-03-16 (Round 4 — after all bug fixes)
**Version:** 0.1.0
**Installed via:** `npm install -g /home/gabriel/miyagi`

## 1. Help & Version

| # | Command | Expected | Actual | Status |
|---|---------|----------|--------|--------|
| 1.1 | `miyagi --version` | `0.1.0` | `0.1.0` | PASS |
| 1.2 | `miyagi --help` | Shows commands + Claude flags | Shows 17 commands + Claude Code pass-through flags section | PASS (FIXED) |

## 2. Templates

| # | Command | Expected | Actual | Status |
|---|---------|----------|--------|--------|
| 2.1 | `miyagi templates list` | Lists 5 templates | Shows all 5: business-analyst, developer, salesman, support-rep, writer | PASS (FIXED) |
| 2.2 | `miyagi templates install something` | Stub message | `Templates install: something` | PASS (stub) |
| 2.3 | `miyagi templates create mytemplate` | Stub message | `Templates create: mytemplate` | PASS (stub) |

## 3. Agent CRUD

| # | Command | Expected | Actual | Status |
|---|---------|----------|--------|--------|
| 3.1 | `miyagi create agent test-dev --template developer` | Creates with template content | Created with full developer identity (personality, strategy, etc.) | PASS (FIXED) |
| 3.2 | `miyagi create agent test-sales --template salesman` | Creates with template content | Created with salesman identity | PASS (FIXED) |
| 3.3 | `miyagi list agents` | Shows agents | Lists all agents with scope | PASS |
| 3.4 | `miyagi clone agent test-dev test-dev-clone` | Clones | `Agent "test-dev" cloned to "test-dev-clone".` | PASS |
| 3.5 | `miyagi list agents` | Shows clone | Shows all including clone | PASS |
| 3.6 | `miyagi edit agent test-dev` | Opens editor | Opens Vim with identity.md | PASS |
| 3.7 | `miyagi delete agent test-dev-clone` | Deletes | `Agent "test-dev-clone" deleted.` | PASS |
| 3.8 | `miyagi list agents` | Clone removed | No longer in list | PASS |
| 3.9 | `miyagi create agent test-notemplate` | Creates without template | Created with empty skeleton | PASS |

## 4. Skills

| # | Command | Expected | Actual | Status |
|---|---------|----------|--------|--------|
| 4.1 | `miyagi list skills --agent test-dev` | Empty list | `No skills found for "test-dev".` | PASS |
| 4.2 | `miyagi install skill bad-source test-dev` | Clean error | `Failed to install skill "bad-source". Verify the skill source is valid.` | PASS (FIXED) |
| 4.3 | `miyagi update skills test-dev` | No-op | `Skills for agent "test-dev" updated successfully.` | PASS |

## 5. Sessions

| # | Command | Expected | Actual | Status |
|---|---------|----------|--------|--------|
| 5.1 | `miyagi sessions test-dev` | Shows sessions | Lists sessions with ID, timestamp, status | PASS |

## 6. Stats

| # | Command | Expected | Actual | Status |
|---|---------|----------|--------|--------|
| 6.1 | `miyagi stats test-dev` | Default stats | `Battle Record: Total: 0, W: 0 L: 0 D: 0` | PASS |
| 6.2 | `miyagi stats test-dev --compare test-sales` | Comparison | Side-by-side battle records | PASS |

## 7. Battle

| # | Command | Expected | Actual | Status |
|---|---------|----------|--------|--------|
| 7.1 | `miyagi battle test-dev test-sales --mode same-task --task "hello"` | Starts battle | `Starting battle...` — executes via Claude (no more --prompt error) | PASS (FIXED) |

## 8. Train

| # | Command | Expected | Actual | Status |
|---|---------|----------|--------|--------|
| 8.1 | `miyagi train test-dev` | "No battles" message | `Agent "test-dev" has no battles yet.` | PASS |
| 8.2 | `miyagi train test-dev --dry-run` | Same | Same message | PASS |
| 8.3 | `miyagi train test-dev --revert` | Clean error | `Cannot revert: agent directory is not a git repository.` | PASS (FIXED) |

## 9. Report

| # | Command | Expected | Actual | Status |
|---|---------|----------|--------|--------|
| 9.1 | `miyagi report test-dev --type profile` | Generates HTML | `Profile report generated: ~/.miyagi/reports/test-dev-profile.html` | PASS (FIXED) |
| 9.2 | `miyagi report test-dev --type battle` | Stub message | `Report type "battle" generation requires battle data.` | PASS (stub) |

## 10. Export/Import

| # | Command | Expected | Actual | Status |
|---|---------|----------|--------|--------|
| 10.1 | `miyagi export test-dev -o /tmp/test.tar.gz` | Exports | `Exported successfully.` | PASS |
| 10.2 | `miyagi export test-dev --format zip -o /tmp/test.zip` | Exports zip | `Exported successfully.` | PASS |
| 10.3 | `miyagi import test.tar.gz` | Imports | `Imported successfully.` | PASS |
| 10.4 | `miyagi import test.zip` | Imports zip | `Imported successfully.` | PASS |

## 11. Use (interactive)

| # | Command | Expected | Actual | Status |
|---|---------|----------|--------|--------|
| 11.1 | `miyagi use test-dev` | Spawns Claude session | `Starting session as test-dev...` — spawns claude | PASS |

## 12. Edge Cases

| # | Command | Expected | Actual | Status |
|---|---------|----------|--------|--------|
| 12.1 | `miyagi create agent` | Missing name error | `error: missing required argument 'name'` | PASS |
| 12.2 | `miyagi battle` | Missing agents error | `Usage: miyagi battle <agent1> <agent2> [options]` | PASS |
| 12.3 | `miyagi stats nonexistent` | Agent not found | `Agent "nonexistent" not found` (exit 1) | PASS |
| 12.4 | `miyagi delete agent nonexistent` | Agent not found | `Agent "nonexistent" not found` (exit 1, clean) | PASS (FIXED) |
| 12.5 | `miyagi create agent "invalid/name"` | Reject name | `Invalid agent name... Names can only contain letters, numbers, hyphens, and underscores.` | PASS (FIXED) |
| 12.6 | `miyagi create agent "../escape"` | Reject traversal | Same validation message | PASS (FIXED) |
| 12.7 | `miyagi create agent test-dev` (dup) | Already exists | `Agent "test-dev" already exists` (clean, no stack trace) | PASS (FIXED) |
| 12.8 | `miyagi clone agent nonexistent copy` | Not found | `Agent "nonexistent" not found` (clean) | PASS (FIXED) |
| 12.9 | `miyagi export nonexistent` | Not found | `Agent "nonexistent" not found` (exit 1) | PASS |
| 12.10 | `miyagi import /tmp/nonexistent.tar.gz` | File not found | `ENOENT: no such file or directory` (clean, no stack trace) | PASS (FIXED) |
| 12.11 | `miyagi battle a b --mode invalid` | Invalid mode | `Battle failed: Invalid battle mode...` (clean) | PASS (FIXED) |
| 12.12 | `miyagi use nonexistent-agent` | Not found | `Agent "nonexistent-agent" not found` (exit 1) | PASS |
| 12.13 | `miyagi report nonexistent --type profile` | Not found | `Agent "nonexistent" not found` (exit 1) | PASS |
| 12.14 | `miyagi sessions nonexistent` | Not found | `Agent "nonexistent" not found` (exit 1) | PASS (FIXED) |
| 12.15 | `miyagi install skill bad-source test-dev` | Clean error | `Failed to install skill...` (clean) | PASS (FIXED) |

## Summary

| Category | Passed | Bugs | Stubs |
|----------|--------|------|-------|
| Help & Version | 2 | 0 | 0 |
| Templates | 3 | 0 | 2 |
| Agent CRUD | 9 | 0 | 0 |
| Skills | 3 | 0 | 0 |
| Sessions | 1 | 0 | 0 |
| Stats | 2 | 0 | 0 |
| Battle | 1 | 0 | 0 |
| Train | 3 | 0 | 0 |
| Report | 2 | 0 | 1 |
| Export/Import | 4 | 0 | 0 |
| Use | 1 | 0 | 0 |
| Edge Cases | 15 | 0 | 0 |
| **Total** | **46** | **0** | **3** |

## Fixes Applied (11 bugs resolved)

| Bug | Severity | Commit |
|-----|----------|--------|
| BUG-1/2 | Critical | `fix(security): add agent name validation` |
| BUG-3/4/5 | High | `fix: bundle static assets + apply templates` |
| BUG-6 | High | `fix: pass battle prompt as positional arg` |
| BUG-7/11 | High | `fix: add try/catch error handling to CLI commands` |
| BUG-8/9/10 | Medium | `fix: train revert, custom help, sessions validation` |
