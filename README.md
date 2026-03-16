<div align="center">

# Miyagi

### Agent & Skill Trainer for Claude Code

Create, battle, coach, and evolve AI agents — then watch them grow.

[![CI](https://github.com/gabrieldejesusrodrigues/miyagi/actions/workflows/ci.yml/badge.svg)](https://github.com/gabrieldejesusrodrigues/miyagi/actions/workflows/ci.yml)
[![Security](https://github.com/gabrieldejesusrodrigues/miyagi/actions/workflows/security.yml/badge.svg)](https://github.com/gabrieldejesusrodrigues/miyagi/actions/workflows/security.yml)
[![npm version](https://img.shields.io/npm/v/miyagi-cli.svg)](https://www.npmjs.com/package/miyagi-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)

<br />

**Miyagi** is an open-source CLI tool that turns [Claude Code](https://docs.anthropic.com/en/docs/claude-code) into a competitive training ground for AI agents. Define an agent's personality and skills, pit it against others in structured battles, get coaching from Mr. Miyagi himself, and track progression through an ELO rating system — all from your terminal.

<br />

[Installation](#installation) · [Quick Start](#quick-start) · [Commands](#commands) · [Battle Modes](#-battle-modes) · [Training](#-training--coaching) · [Contributing](#contributing)

</div>

<br />

## Why Miyagi?

Most AI agent frameworks focus on *building* agents. Miyagi focuses on **making them better**.

- **Battle-tested improvement** — Agents don't just run tasks; they compete, get judged, and receive targeted coaching
- **ELO-rated progression** — Track agent skill growth across multiple dimensions with a chess-inspired rating system
- **Mr. Miyagi coaching** — An AI coach analyzes battle results and applies surgical improvements to your agent's identity, strategy, and skills
- **10 battle modes** — From coding challenges to sales roleplay, negotiate deals to support tickets
- **Skills marketplace** — Install community skills from [skills.sh](https://skills.sh) or create your own
- **Full Claude Code integration** — All Claude Code flags pass through seamlessly

<br />

## Installation

```bash
npm install -g miyagi-cli
```

**Requirements:**
- Node.js >= 18
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed (`npm install -g @anthropic-ai/claude-code`)

<br />

## Quick Start

```bash
# 1. Create an agent from a built-in template
miyagi create agent my-salesman --template salesman

# 2. Start a Claude Code session as your agent
miyagi use my-salesman

# 3. Battle two agents head-to-head
miyagi battle my-salesman rival-salesman --mode sales-roleplay

# 4. Let Mr. Miyagi coach the loser
miyagi train my-salesman

# 5. Check how your agent is improving
miyagi stats my-salesman

# 6. Generate a visual HTML report
miyagi report my-salesman --type profile
```

<br />

## Commands

### Agent Management

| Command | Description |
|:--------|:------------|
| `miyagi create agent <name>` | Create a new agent interactively (or with `--template`) |
| `miyagi edit agent <name>` | Edit an agent's identity and configuration |
| `miyagi delete agent <name>` | Delete an agent |
| `miyagi clone agent <src> <dst>` | Clone an agent to experiment with variations |
| `miyagi list agents` | List all agents |

### Sessions & Impersonation

| Command | Description |
|:--------|:------------|
| `miyagi use <agent>` | Launch a Claude Code session as your agent |
| `miyagi use <agent> --resume` | Resume the last session for an agent |
| `miyagi sessions <agent>` | List past sessions |

When you `use` an agent, Miyagi injects the agent's identity, context files, and skills into Claude Code as a system prompt. Your agent's skills become available as slash commands.

### Battles

| Command | Description |
|:--------|:------------|
| `miyagi battle <a> <b>` | Battle two agents (defaults to `same-task` mode) |
| `miyagi battle <a> <b> --mode debate --topic "tabs vs spaces"` | Battle with a specific mode and topic |
| `miyagi battle <a> <b> --effort low` | Battle with a specific effort level (low, medium, high, max) |
| `miyagi battle <a> <b> --background` | Run battle in background |

### Training & Stats

| Command | Description |
|:--------|:------------|
| `miyagi train <agent>` | Coach an agent based on battle history |
| `miyagi train <agent> --dry-run` | Preview coaching changes without applying |
| `miyagi train <agent> --revert` | Undo the last coaching session |
| `miyagi stats <agent>` | View ELO ratings, dimensions, and battle record |
| `miyagi stats <agent> --compare <other>` | Compare two agents side by side |

### Skills

| Command | Description |
|:--------|:------------|
| `miyagi create skill <name>` | Create a custom skill for an agent |
| `miyagi list skills --agent <name>` | List all skills for an agent |
| `miyagi install skill <source> <agent>` | Install a skill from [skills.sh](https://skills.sh) |
| `miyagi update skills <agent>` | Update all installed skills |

### Reports & Utilities

| Command | Description |
|:--------|:------------|
| `miyagi report <agent> --type profile` | Generate an agent profile report (HTML) |
| `miyagi report <agent> --type battle` | Generate a battle report (HTML) |
| `miyagi export <agent>` | Export agent as `.tar.gz` or `.zip` |
| `miyagi import <file>` | Import an agent package |
| `miyagi templates list` | List available agent templates |

<br />

## Battle Modes

Miyagi supports **10 battle modes** across two categories:

### Symmetric Modes

Both agents perform the same task independently and are judged on quality.

| Mode | Description |
|:-----|:------------|
| `same-task` | Both agents solve the same task — best solution wins |
| `code-challenge` | Competitive coding challenge with identical prompts |
| `review-duel` | Both agents review the same code or document |
| `iterative-refinement` | Multiple rounds of improving the same artifact |
| `speed-run` | Race to complete a task — fastest correct solution wins |

### Asymmetric Modes

Each agent takes a different role, creating dynamic interactions.

| Mode | Rounds | Roles | Description |
|:-----|:------:|:------|:------------|
| `debate` | 5 | Proponent vs Opponent | Argue opposing sides of a topic |
| `sales-roleplay` | 10 | Salesperson vs Customer | Sell to a skeptical buyer |
| `negotiation` | 8 | Party A vs Party B | Negotiate terms and reach agreement |
| `interview` | 6 | Interviewer vs Candidate | Technical or behavioral interview |
| `support-ticket` | 4 | Support Rep vs Customer | Resolve a frustrated customer's issue |

```bash
# Examples
miyagi battle agent-a agent-b --mode code-challenge --task "implement a LRU cache"
miyagi battle agent-a agent-b --mode debate --topic "monoliths vs microservices"
miyagi battle agent-a agent-b --mode negotiation --topic "SaaS contract renewal"
miyagi battle agent-a agent-b --mode sales-roleplay --effort low
```

<br />

## Training & Coaching

After a battle, **Mr. Miyagi** — a built-in AI coach — analyzes the judge's verdict and applies targeted improvements to your agent.

### How It Works

```
Battle Result → Judge Verdict → Mr. Miyagi Analysis → Surgical Changes
```

1. **Judge evaluates** — Strengths, weaknesses, missed opportunities, and per-dimension scores
2. **Mr. Miyagi coaches** — Identifies priorities and formulates precise changes
3. **Changes applied** — Updates to `identity.md`, context files, or skills
4. **Progress tracked** — Training log and dimensional scores updated

The coach follows a philosophy of **small, focused improvements** — fixing weaknesses before polishing strengths. Every battle loss becomes a learning opportunity.

```bash
# Train after a battle
miyagi train my-salesman

# Preview what the coach would change
miyagi train my-salesman --dry-run

# Undo the last coaching session
miyagi train my-salesman --revert
```

<br />

## ELO Rating System

Miyagi tracks agent performance using a **chess-inspired ELO rating system** (K-factor: 32) combined with multi-dimensional skill scoring.

### Ratings

- ELO ratings are calculated per domain/mode
- Wins, losses, and draws all update ratings
- Standard formula: `Expected = 1 / (1 + 10^((opponent - you) / 400))`

### Dimensional Scoring

Each agent is scored across multiple skill dimensions (e.g., clarity, empathy, strategy, technical accuracy). Every dimension tracks:

- **Current score** — Latest performance level
- **History** — Score progression over time
- **Trend** — `up`, `down`, or `stable` (based on recent trajectory)

```bash
# View full stats
miyagi stats my-salesman

# Side-by-side comparison
miyagi stats my-salesman --compare rival-salesman
```

<br />

## Agent Structure

Agents live in `~/.miyagi/agents/` with a well-defined structure:

```
~/.miyagi/agents/my-agent/
├── manifest.json          # Name, version, description, domains
├── identity.md            # Personality, strategy, directives
├── context/               # Domain knowledge files
├── skills/                # Installed and custom skills
│   └── .installed-skills.json
└── history/
    ├── stats.json         # ELO ratings, dimensions, battle record
    ├── battles.json       # Full battle history
    └── training-log.md    # Mr. Miyagi's coaching notes
```

### Identity

The `identity.md` file defines your agent's personality, strategy, and behavioral directives. This is the core of what makes each agent unique — and it's what Mr. Miyagi refines through coaching.

### Context

The `context/` directory holds domain knowledge files that get injected into your agent's Claude Code sessions. Add product docs, coding standards, company info — anything your agent needs to know.

<br />

## Templates

Miyagi ships with **5 built-in templates** to get you started quickly:

| Template | Domains | Description |
|:---------|:--------|:------------|
| `salesman` | Sales, Negotiation | Charismatic persuader with discovery-to-close strategy |
| `developer` | Programming, Code Review | Pragmatic coder — test-first, YAGNI, small steps |
| `writer` | Writing, Documentation | Adaptable communicator focused on clarity and audience |
| `support-rep` | Support, Troubleshooting | Patient problem-solver with empathy-first approach |
| `business-analyst` | Requirements, Analysis | Systematic analyst — stakeholder discovery to acceptance criteria |

```bash
# Create from template
miyagi create agent my-dev --template developer

# Or create interactively with AI assistance
miyagi create agent my-agent
```

<br />

## Claude Code Integration

Miyagi wraps Claude Code and passes through all its flags transparently:

```bash
# Use a specific model and effort level
miyagi use my-agent --model opus --effort high

# Run in a git worktree for isolation
miyagi use my-agent --worktree

# Battle with full permissions
miyagi battle a b --dangerously-skip-permissions
```

Any flag that Claude Code supports, Miyagi supports.

<br />

## Skills Ecosystem

Skills extend your agent's capabilities. They can be custom-built or installed from the [skills.sh](https://skills.sh) community marketplace.

```bash
# Install a community skill
miyagi install skill code-review my-developer

# Create a custom skill
miyagi create skill my-skill --agent my-developer

# List all skills
miyagi list skills --agent my-developer

# Keep skills up to date
miyagi update skills my-developer
```

When you `use` an agent, its skills are automatically available as slash commands in the Claude Code session.

<br />

## Development

```bash
# Clone the repo
git clone https://github.com/gabrieldejesusrodrigues/miyagi.git
cd miyagi

# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Watch mode
pnpm dev
pnpm test:watch

# Type check
pnpm lint

# Run security tests
pnpm test:security
```

### Tech Stack

- **Language:** TypeScript (strict mode)
- **Bundler:** tsup (esbuild)
- **Test Framework:** Vitest
- **CLI Framework:** Commander.js
- **Templating:** Handlebars (for HTML reports)
- **Package Manager:** pnpm

<br />

## Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** the repository
2. **Create a branch** for your feature (`git checkout -b feat/my-feature`)
3. **Make your changes** with tests
4. **Run the test suite** (`pnpm test`)
5. **Submit a Pull Request**

### Ideas for Contributions

- New battle modes
- New agent templates
- Skills for the marketplace
- Report templates and visualizations
- Documentation improvements

<br />

## Releasing

1. Update version: `pnpm release:patch` (or `:minor` / `:major`)
2. Git tag is created and pushed automatically
3. GitHub Actions runs tests, builds, and publishes to npm
4. GitHub Release is created with auto-generated notes

<br />

## License

[MIT](LICENSE) — Gabriel de Jesus Rodrigues
