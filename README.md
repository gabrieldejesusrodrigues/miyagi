# Miyagi

Agent & Skill Trainer for Claude Code — create, battle, and coach AI agents.

## Install

```bash
npm install -g miyagi
```

## Quick Start

```bash
# Create an agent from a template
miyagi create agent my-salesman --template salesman

# Start a Claude Code session as your agent
miyagi use my-salesman

# Battle two agents
miyagi battle my-salesman rival-salesman --mode sales-roleplay

# Train with Mr. Miyagi coaching
miyagi train my-salesman

# View agent stats
miyagi stats my-salesman

# Generate an HTML report
miyagi report my-salesman --type profile
```

## Commands

| Command | Description |
|---------|-------------|
| `create agent <name>` | Create a new agent (optionally from template) |
| `create skill <name>` | Create a custom skill for an agent |
| `edit agent <name>` | Edit an agent interactively |
| `delete agent <name>` | Delete an agent |
| `clone agent <src> <dst>` | Clone an agent |
| `list agents` | List all agents |
| `list skills --agent <name>` | List skills for an agent |
| `use <agent>` | Start a Claude Code session as an agent |
| `battle <a> <b>` | Battle two agents |
| `train <agent>` | Coach an agent with Mr. Miyagi |
| `stats <agent>` | Show agent stats and ELO |
| `export <agent>` | Export agent as tar.gz/zip |
| `import <file>` | Import an agent package |
| `templates list` | List available templates |
| `report <agent>` | Generate HTML report |
| `sessions <agent>` | List past sessions |
| `install skill <src> <agent>` | Install a skill from skills.sh |
| `update skills <agent>` | Update installed skills |

## Battle Modes

- **same-task** — Both agents solve the same task independently
- **code-challenge** — Competitive coding challenge
- **debate** — Agents argue opposing sides
- **sales-roleplay** — Salesperson vs skeptical customer
- **negotiation** — Opposing negotiation positions
- **interview** — Interviewer and candidate
- **review-duel** — Independent code/document review
- **support-ticket** — Support rep vs frustrated customer
- **iterative-refinement** — Iterative improvement rounds
- **speed-run** — Race to complete a task

## Claude Code Integration

Miyagi wraps Claude Code and supports all its flags as pass-through:

```bash
miyagi use my-agent --model opus --effort high --worktree
miyagi battle a b --dangerously-skip-permissions
```

## Agent Structure

```
~/.miyagi/agents/my-agent/
  manifest.json      # Agent metadata
  identity.md        # Personality, strategy, directives
  context/           # Domain knowledge files
  skills/            # Installed and custom skills
  history/
    stats.json       # ELO, dimensions, battle record
    battles.json     # Battle history
    training-log.md  # Coaching notes
```

## Templates

Built-in templates: `salesman`, `developer`, `business-analyst`, `writer`, `support-rep`

## Releasing

1. Update CHANGELOG.md
2. Bump version: `pnpm release:patch` (or `:minor` / `:major`)
3. Git tag is created and pushed automatically
4. GitHub Actions runs tests, builds, and publishes to npm
5. GitHub Release is created with auto-generated notes

### First-time setup

1. Create npm account at npmjs.com
2. Generate npm access token (Automation type)
3. Add `NPM_TOKEN` secret to GitHub repo settings

## License

MIT
