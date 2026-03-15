# Miyagi CLI — Agent & Skill Trainer for Claude Code

**Date:** 2026-03-14
**Status:** Approved
**Approach:** B (Full TypeScript CLI with SDK Layer), evolve toward C (Plugin Architecture) later

---

## Overview

Miyagi is an npm-installable CLI that wraps Claude Code CLI to provide an agent and skill training platform. Users create AI agents with distinct identities, equip them with skills (compatible with skills.sh), train them through battles and coaching, and use them for daily tasks like coding, sales, business analysis, and more.

The system features a battle arena where agents face each other, a Judge that provides expert analysis, and a Coach (Mr. Miyagi) that applies targeted improvements to each agent.

---

## Agent Structure & Storage

### Storage Model

- **Global:** `~/.miyagi/` — agents available everywhere
- **Project-local:** `.miyagi/` — project-scoped agents, version-controlled
- **Resolution:** project-local overrides global when names collide

### Directory Structure

```
~/.miyagi/
  config.json
  templates/
    salesman/
    developer/
    business-analyst/
    writer/
    support-rep/
  agents/
    <agent-name>/
      manifest.json
      identity.md
      context/
        *.md
      skills/
        <skill-name>/SKILL.md       # Installed from skills.sh (pristine)
        miyagi-<name>/SKILL.md       # Coach-created custom skills
      .installed-skills.json
      history/
        stats.json
        battles.json
        training-log.md
      .git/
  reports/
```

### Agent Files

**manifest.json:** Name, version, author, template origin, created date, metadata.

**identity.md:** Core identity containing personality, strategy, and skill usage directives. This is the single orchestration layer — it references skills and context files, and contains directives on how/when to use them.

**context/:** Reference documents (company info, product catalogs, scripts, frameworks). Editable by the Coach.

**skills/:** Installed skills stay pristine and updatable from skills.sh. Coach-created custom skills use `miyagi-` prefix. Skills follow the skills.sh SKILL.md format (YAML frontmatter with `name` and `description`, markdown body).

**.installed-skills.json:** Registry of skills.sh sources for update tracking.

**history/:** Git-versioned files + structured JSON for queryable stats.

---

## CLI Commands

### Agent Management

```
miyagi create agent <name>                  # Interactive AI-assisted creation
miyagi create agent <name> --template <t>   # Start from template
miyagi edit agent <name>                    # AI-assisted edit session
miyagi delete agent <name>                  # Delete with confirmation
miyagi list agents                          # List all (global + project)
miyagi clone agent <name> <new-name>        # Duplicate agent
```

### Skill Management

```
miyagi create skill <name> <agent>          # AI-assisted skill creation
miyagi install skill <source> <agent>       # Install from skills.sh
miyagi remove skill <skill> <agent>         # Remove from agent
miyagi update skills <agent>                # Update skills.sh skills
miyagi list skills <agent>                  # List agent's skills
```

### Agent Usage (Impersonation)

```
miyagi use <agent>                          # Start Claude Code session as agent
miyagi use <agent> --resume                 # Resume last session
miyagi use <agent> --resume <session-id>    # Resume specific session
miyagi sessions <agent>                     # List past sessions
```

### Battle System

```
miyagi battle <agent1> <agent2>             # Interactive battle setup
miyagi battle <agent1> <agent2> --mode <m>  # Specify mode
miyagi battle <agent1> <agent2> --background # Run async
miyagi battle history                       # List past battles
miyagi battle replay <battle-id>            # View past battle
```

### Training & Stats

```
miyagi train <agent>                        # Coach improves agent
miyagi train <agent> --dry-run              # Suggest without applying
miyagi stats <agent>                        # Show ELO, radar, trajectory
miyagi stats <agent> --compare <agent2>     # Side-by-side comparison
```

### Export / Import

```
miyagi export <agent>                       # Export to .miyagi.tar.gz
miyagi export <agent> --format zip          # Zip format
miyagi export <agent> --no-history          # Without battle history
miyagi import <file-or-directory>           # Import (tar.gz, zip, or directory)
```

### Templates

```
miyagi templates list                       # List available templates
miyagi templates install <source>           # Install community template
miyagi templates create <name>              # Create from existing agent
```

### HTML Reports

```
miyagi report <battle-id>                   # Generate battle report
miyagi report <battle-id> --open            # Generate and open in browser
miyagi report <agent> --type profile        # Agent profile card
miyagi report <agent> --type evolution      # Training journey over time
miyagi report <agent1> --compare <agent2>   # Side-by-side comparison page
```

---

## Impersonation Mechanism

Hybrid approach — zero file risk, full project context preserved:

1. **Identity injection:** `claude --append-system-prompt` passes the agent's full identity.md content. No CLAUDE.md manipulation.
2. **Skill symlinks:** Skills symlinked into `~/.claude/skills/miyagi-<agent>-<skillname>/` with unique prefix to avoid collision with user's existing skills.
3. **Cleanup:** Trap handlers on `SIGINT`, `SIGTERM`, `EXIT` guarantee symlink removal even on crash.
4. **Session tracking:** Session IDs saved per agent for `--resume` support via `claude --resume`.
5. **Permissions:** Claude runs with `--dangerously-skip-permissions` and accept edits mode for autonomous operation.

### In-Session Commands

- **Claude Code native (pass through):** `/rewind`, `/resume`, `/clear`, `/compact`, `/model`, `/help`, `/skills`, `/cost`, etc.
- **Miyagi-prefixed:** `/miyagi-skills`, `/miyagi-battle`, `/miyagi-train`, `/miyagi-stats`, `/miyagi-switch`, `/miyagi-context`, `/miyagi-identity`
- **Agent skills (unprefixed):** `/discovery`, `/objection-handling`, etc. — unique names that won't collide

---

## Battle System

### Battle Modes

| Mode | Type | Description |
|------|------|-------------|
| `same-task` | Symmetric | Both agents receive identical instructions, outputs compared |
| `code-challenge` | Symmetric | Both solve same coding problem |
| `iterative-refinement` | Symmetric | Both improve same draft over rounds |
| `speed-run` | Symmetric | Same task, quality vs speed trade-off |
| `debate` | Asymmetric | Agents argue opposing sides |
| `sales-roleplay` | Asymmetric | Salesman vs customer with role cards |
| `negotiation` | Asymmetric | Buyer vs seller with objectives |
| `review-duel` | Asymmetric | One produces, other critiques, then swap |
| `interview` | Asymmetric | Interviewer vs candidate |
| `support-ticket` | Asymmetric | Support rep vs frustrated user |

### Execution

- **Symmetric:** Two independent Claude Code processes run in parallel. Judge compares outputs.
- **Asymmetric:** Two Claude Code processes with miyagi mediating turn-by-turn message exchange. Judge observes all messages.
- **Display:** Live by default (stream in terminal), `--background` flag for async with report at end.

### Termination

- Natural conclusion (deal closed, debate wraps up)
- Round limit reached (configurable per mode)
- User presses `q` to stop early
- Judge calls it (one agent clearly dominant)

---

## Judge & Coach

### Judge (`miyagi-judge`)

Built-in elite evaluator that adapts evaluation framework per battle mode. Runs on Claude Opus.

**Produces for every battle:**
1. **Verdict** — winner and why (or draw with justification)
2. **Battle Narrative** — play-by-play of critical moments
3. **Per-Agent Analysis** — strengths, weaknesses, missed opportunities, dimensional scores with specific examples
4. **Comparative Analysis** — direct dimension-by-dimension comparison
5. **Coaching Priorities** — ranked improvement areas per agent, ordered by impact

### Coach (`mr-miyagi`)

Built-in master trainer. Runs on Claude Opus. Takes Judge's full analysis and applies concrete improvements.

**Three levers:**
1. **Edit identity.md** — personality, strategy, skill usage directives
2. **Edit/add context files** — reference documents, scripts, frameworks
3. **Create new custom skills** — for genuinely new capabilities not covered by installed skills

**Coaching principles:**
- Small, targeted changes beat complete rewrites ("wax on, wax off")
- Every change traceable to specific weakness from Judge's analysis
- Never remove existing strengths to fix weaknesses
- Document every change in training-log.md with reasoning
- Prescribe next training battle to test improvements
- Commit all changes via git for rollback capability

### Post-Battle Flow

```
Battle Ends → Judge analyzes → Mr. Miyagi coaches → Report shown to user
```

User can revert coaching changes with `miyagi train --revert`.

---

## Scoring System

### Multi-Dimensional Scoring

Each battle mode has domain-specific evaluation dimensions. The Judge selects relevant dimensions dynamically. Scores are 1-10 per dimension with specific justification.

### ELO Rating

- Starting ELO: 1200
- K-factor adjusted: beating higher-rated agents gives more points
- ELO calculated per domain (sales ELO, code ELO, etc.)
- Draws scored accordingly

### Growth Trajectory

- Score history tracked per dimension over time
- Trend indicators: up, down, stable
- Coach notes with qualitative observations per battle

### stats.json Structure

```json
{
  "agent": "agent-name",
  "elo": { "domain": 1847 },
  "dimensions": {
    "dimension-name": {
      "current": 8.1,
      "history": [5.0, 6.2, 7.1, 7.8, 8.1],
      "trend": "up"
    }
  },
  "battles": { "total": 12, "record": { "wins": 8, "losses": 3, "draws": 1 } },
  "coachNotes": [{ "date": "2026-03-14", "note": "..." }]
}
```

---

## Export / Import

### Export Format

```
agent-name.miyagi/
  manifest.json
  identity.md
  context/
  skills/
    miyagi-*/                     # Coach-created skills (bundled)
    .installed-skills.json        # skills.sh references (re-installed on import)
  history/                        # Optional (--no-history to exclude)
```

Supported output formats: `.miyagi.tar.gz`, `.zip`
Supported import formats: `.tar.gz`, `.zip`, raw directory

### Import Security

1. **Path traversal prevention** — reject `../` and absolute paths
2. **Size limits** — 1MB per file, 10MB total
3. **Symlink rejection** — archives with symlinks rejected entirely
4. **Executable file warning** — `.sh`, `.js`, `.py` etc. flagged but allowed as reference material (miyagi never executes them)
5. **Manifest validation** — strict schema, unexpected fields stripped
6. **Content in markdown** — code blocks are legitimate (technical skills contain scripts)
7. **User confirmation** — summary shown before applying
8. **Quarantine on failure** — entire import rejected with explanation

---

## HTML Reports

### Report Types

| Type | Command | Content |
|------|---------|---------|
| Battle | `miyagi report <battle-id>` | Transcript, Judge analysis, Coach changes, scores, diffs |
| Profile | `miyagi report <agent> --type profile` | Identity summary, skills radar, ELO history, recent battles |
| Evolution | `miyagi report <agent> --type evolution` | Training timeline, score progression, Coach notes, identity git history |
| Compare | `miyagi report <agent1> --compare <agent2>` | Side-by-side dimensions, head-to-head record |

### Design Principles

- **Unified design system** — consistent layout, header, nav, typography, color palette across all types
- **Miyagi brand** — dark theme with accent colors, dojo-inspired aesthetics
- **Self-contained** — single HTML file, inline CSS + JS, no external dependencies
- **Responsive** — works on desktop and mobile
- **Accessible** — proper contrast, semantic HTML, screen reader friendly
- **Interactive** — collapsible sections, hover tooltips, smooth transitions
- **Print-friendly** — clean print stylesheet for PDF export
- **Shared template system** — Handlebars partials ensure visual consistency

Reports saved to `~/.miyagi/reports/` or custom path via `--output`.

---

## Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Language | TypeScript | Type safety, npm ecosystem |
| CLI Framework | Commander.js | Battle-tested, simple |
| Interactive Prompts | Inquirer.js | Rich selection, multi-choice |
| Terminal UI | Ink (React for CLI) | Live battle view, progress bars |
| Archive Handling | tar + archiver | tar.gz and zip with security |
| Git Integration | simple-git | Agent versioning |
| Template Engine | Handlebars | HTML reports with shared partials |
| Charts | Chart.js (bundled) | Radar, line charts in reports |
| Testing | Vitest | Fast, TS-native |
| Build | tsup | Simple CLI bundler |
| Package Manager | pnpm | Fast, disk efficient |

---

## Project Structure

```
miyagi/
  package.json
  tsconfig.json
  tsup.config.ts
  bin/
    miyagi.ts
  src/
    cli/
      commands/
        agent.ts
        skill.ts
        use.ts
        battle.ts
        train.ts
        stats.ts
        export-import.ts
        templates.ts
        report.ts
        sessions.ts
      middleware/
        security.ts
    core/
      agent-manager.ts
      skill-manager.ts
      claude-bridge.ts
      session-manager.ts
    battle/
      engine.ts
      mediator.ts
      modes/
        same-task.ts
        code-challenge.ts
        debate.ts
        sales-roleplay.ts
        negotiation.ts
        review-duel.ts
        interview.ts
        support-ticket.ts
        iterative-refinement.ts
        speed-run.ts
    training/
      judge.ts
      coach.ts
      scoring.ts
      history.ts
    reports/
      generator.ts
      templates/
        base.hbs
        battle.hbs
        profile.hbs
        evolution.hbs
        compare.hbs
      assets/
        styles.css
        charts.js
    templates/
      salesman/
      developer/
      business-analyst/
      writer/
      support-rep/
    builtin-agents/
      miyagi-judge/
        identity.md
      mr-miyagi/
        identity.md
    utils/
      archive.ts
      git.ts
      validators.ts
  tests/
    unit/
    integration/
```

---

## Installation

```bash
npm install -g miyagi
miyagi create agent my-first-agent
```

**Prerequisites:** Claude Code CLI installed and authenticated.

---

## Future Evolution (Post-v1)

- Plugin architecture (Approach C) for community battle modes, scorers, templates
- Community marketplace: `miyagi search agents`, `miyagi install agent <name>`
- Community template registry
- Team battles (multiple agents collaborating)
- Tournament mode (bracket-style elimination)
- Leaderboards
