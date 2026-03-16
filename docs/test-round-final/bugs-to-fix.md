# Miyagi CLI - Bugs To Fix

**Date:** 2026-03-16
**Version:** 0.1.0 (post bug-fix round)

## Status: All Bugs Fixed

All issues identified during testing have been fixed and verified.

---

## Previously Fixed Bugs

| Bug | Severity | Fix Summary |
|-----|----------|-------------|
| BUG-1/2 | Critical | Agent name validation prevents path traversal |
| BUG-3/4/5 | High | Static assets bundled, templates applied on create |
| BUG-6 | High | Battle prompts via stdin with SYSTEM_PROMPT tags |
| BUG-7/11 | High | try/catch error handling in all CLI commands |
| BUG-8 | Medium | train --revert handles non-git dirs gracefully |
| BUG-9 | Medium | Custom help text with Claude flags |
| BUG-10 | Medium | Sessions validates agent existence |
| ISSUE-1 | Low | Judge retry logic (2 attempts) for intermittent empty responses |
| ISSUE-4 | Low | `miyagi help` now shows custom detailed help with all Claude flags |
