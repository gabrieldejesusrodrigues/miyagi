# Phase 5: Robustness & Reliability Fixes

> **Priority:** P2 — Reliability
> **Scope:** 8 source files, ~100 lines changed
> **Gaps addressed:** GAP-5, GAP-10, GAP-11, GAP-12, GAP-13, GAP-14, GAP-15, GAP-16
> **Independent of:** Phases 2–4 (can run in parallel)

These are non-crashing bugs and maintainability issues that affect reliability under edge cases.

---

## Task 5.1: Wire validators into loading paths (GAP-10)

**Files:**
- `src/utils/validators.ts` — already has `validateManifest`, `validateStatsJson`, `validateInstalledSkills`
- `src/core/agent-manager.ts` — `readManifest()` should validate
- `src/training/history.ts` — `getStats()` should validate

**Problem:** Validators exist and are tested but are never called. All JSON loading is unvalidated.

**Implementation:**
1. In `agent-manager.ts:readManifest()`: call `validateManifest()` after parsing, throw on invalid
2. In `history.ts:getStats()`: call `validateStatsJson()` after parsing, return defaults on invalid
3. `skill-manager.ts` already uses `validateInstalledSkills()` — no change needed

**Acceptance criteria:**
- [ ] Malformed `manifest.json` (missing required fields) produces a descriptive error
- [ ] Malformed `stats.json` returns defaults instead of passing bad data through

---

## Task 5.2: Fix greedy JSON parsing (GAP-5)

**Files:**
- `src/training/judge.ts:49`
- `src/training/coach.ts:70`

**Problem:** Already fixed — both files now use `extractBalancedJson()` from `src/utils/json-parser.ts` instead of greedy regex. **This task is already complete.**

**Status:** DONE

---

## Task 5.3: Fix template-loader directory copy crash (GAP-12)

**Files:**
- `src/core/template-loader.ts:74-79`

**Problem:** `readdirSync` without `{ withFileTypes: true }` plus `copyFileSync` throws `EISDIR` if template context directory contains subdirectories.

**Implementation:**
1. Change to `readdirSync(dir, { withFileTypes: true })`
2. Filter to `.isFile()` before copying
3. Optionally: add recursive directory copying for nested template contexts

**Acceptance criteria:**
- [ ] Templates with subdirectories in `context/` don't crash on creation
- [ ] Regular template creation still works

---

## Task 5.4: Fix stats-display bar crash on edge values (GAP-13)

**Files:**
- `src/cli/display/stats-display.ts:11`

**Problem:** Negative or out-of-range values in `bar()` cause `RangeError` from negative `.repeat()`.

**Implementation:**
1. Clamp the value: `const filled = Math.max(0, Math.min(width, Math.round((value / max) * width)));`

**Acceptance criteria:**
- [ ] `bar(-1, 10, 20)` doesn't crash
- [ ] `bar(15, 10, 20)` doesn't crash
- [ ] Normal values still render correctly

---

## Task 5.5: Floor negative ELO ratings (GAP-14)

**Files:**
- `src/training/scoring.ts:20`

**Problem:** Extreme rating differences can produce negative ELO values.

**Implementation:**
1. Add `Math.max(0, ...)` floor to both winner and loser ELO calculations

**Acceptance criteria:**
- [ ] ELO never goes below 0 regardless of input values
- [ ] Normal ELO calculations still produce correct results

---

## Task 5.6: Add template existence check in report generator (GAP-16)

**Files:**
- `src/reports/generator.ts:37,66`

**Problem:** Missing `battle.hbs` or `profile.hbs` throws a raw `ENOENT` with no context.

**Implementation:**
1. Check `existsSync()` before `readFileSync()`
2. Throw descriptive error: `"Report template '${name}.hbs' not found at ${path}. Miyagi may not be installed correctly."`

**Acceptance criteria:**
- [ ] Missing template file produces a helpful error message
- [ ] Valid template paths still work normally

---

## Task 5.7: Fix templates.ts command duplication (GAP-11)

**Files:**
- `src/cli/commands/templates.ts`

**Problem:** The `templates list` action reimplements template listing instead of using `TemplateLoader.list()`.

**Implementation:**
1. Import `TemplateLoader` and use it for all template operations
2. Remove inline reimplementation

**Acceptance criteria:**
- [ ] `miyagi templates list` uses `TemplateLoader.list()`
- [ ] Output is the same as before
