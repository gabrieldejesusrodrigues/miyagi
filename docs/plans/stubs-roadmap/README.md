# Miyagi — Stubs & Unfinished Features Roadmap

> **Created:** 2026-03-16
> **Source:** `docs/implementation-gaps.md`, source code audit, `docs/manual-test-results.md`

This folder contains the implementation plan for all stub commands, unfinished features, and known bugs that need to be resolved to bring Miyagi from v0.1.0 to a fully functional v1.0.

## Phases Overview

| Phase | Focus | Files | Priority |
|-------|-------|-------|----------|
| [Phase 1](./phase-1-critical-bugs.md) | Critical bug fixes (GAP-3, GAP-4, GAP-6, GAP-8, GAP-9) | 6 files | **P0 — Do first** |
| [Phase 2](./phase-2-battle-system.md) | Battle execution end-to-end (GAP-17) | 4 files | **P1 — Core feature** |
| [Phase 3](./phase-3-training-system.md) | Train command + coaching pipeline (GAP-17) | 3 files | **P1 — Core feature** |
| [Phase 4](./phase-4-edit-and-sessions.md) | Edit agent command + session recording (GAP-2, GAP-18) | 2 files | **P2 — UX gaps** |
| [Phase 5](./phase-5-robustness.md) | Validators, parsing, error handling (GAP-3, GAP-5, GAP-10, GAP-12–16) | 8 files | **P2 — Reliability** |
| [Phase 6](./phase-6-test-infrastructure.md) | Mock infrastructure + integration tests | 4+ files | **P3 — Quality** |

## Dependency Graph

```
Phase 1 (critical bugs)
  └──> Phase 2 (battle system)
         └──> Phase 3 (training — depends on battle output)
  └──> Phase 4 (edit + sessions — independent)
  └──> Phase 5 (robustness — independent)
         └──> Phase 6 (tests — needs robustness fixes first)
```

## How to Use

Each phase file contains:
- **What:** The stubs/gaps addressed
- **Why:** Impact on users
- **Tasks:** Step-by-step implementation with file paths and code pointers
- **Acceptance criteria:** How to verify each task is done
- **Estimated scope:** File count and rough complexity

Work phases in order. Phases 4 and 5 can run in parallel with Phase 2–3.
