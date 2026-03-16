import { CLAUDE_FLAGS } from '../../core/claude-flags.js';

const MIYAGI_COMMANDS = [
  { cmd: '/miyagi:help', desc: 'Show this help' },
  { cmd: '/miyagi:skills', desc: "List this agent's skills" },
  { cmd: '/miyagi:battle', desc: 'Challenge another agent' },
  { cmd: '/miyagi:train', desc: 'Trigger coaching analysis' },
  { cmd: '/miyagi:stats', desc: 'Show agent stats inline' },
  { cmd: '/miyagi:switch', desc: 'Switch to a different agent' },
  { cmd: '/miyagi:context', desc: 'Show loaded context files' },
  { cmd: '/miyagi:identity', desc: 'Show current agent identity summary' },
] as const;

const CLAUDE_FLAG_DESCRIPTIONS: Array<{ flag: string; desc: string }> = [
  { flag: '--model <model>', desc: 'Model for the session (sonnet, opus, etc.)' },
  { flag: '--effort <level>', desc: 'Effort level (low, medium, high, max)' },
  { flag: '-p, --print', desc: 'Print response and exit' },
  { flag: '-c, --continue', desc: 'Continue most recent conversation' },
  { flag: '-r, --resume [id]', desc: 'Resume a conversation by session ID' },
  { flag: '-w, --worktree [name]', desc: 'Create a git worktree for the session' },
  { flag: '--dangerously-skip-permissions', desc: 'Bypass all permission checks' },
  { flag: '--permission-mode <mode>', desc: 'Permission mode (acceptEdits, default, etc.)' },
  { flag: '--append-system-prompt <p>', desc: 'Append to system prompt' },
  { flag: '--mcp-config <configs...>', desc: 'Load MCP servers from JSON files' },
  { flag: '--allowedTools <tools...>', desc: 'Tools to allow' },
  { flag: '--disallowedTools <tools...>', desc: 'Tools to deny' },
  { flag: '--add-dir <dirs...>', desc: 'Additional directories for tool access' },
  { flag: '-d, --debug [filter]', desc: 'Enable debug mode' },
  { flag: '-n, --name <name>', desc: 'Set session display name' },
  { flag: '--output-format <fmt>', desc: 'Output format (text, json, stream-json)' },
  { flag: '--max-budget-usd <amt>', desc: 'Maximum dollar spend on API calls' },
  { flag: '--verbose', desc: 'Override verbose mode setting' },
];

export function formatTerminalHelp(): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('  Usage: miyagi [command] [options] [prompt]');
  lines.push('');
  lines.push('  Agent & Skill Trainer for Claude Code');
  lines.push('');
  lines.push('  Miyagi Commands:');
  lines.push('    create <type> <name> [options]    Create a new agent or skill');
  lines.push('    edit <type> <name>                Edit an agent interactively');
  lines.push('    delete <type> <name>              Delete an agent');
  lines.push('    clone <type> <source> <target>    Clone an agent');
  lines.push('    list <type> [options]             List agents or skills');
  lines.push('    use <agent> [options]             Start a Claude Code session as an agent');
  lines.push('    battle [agent1] [agent2]          Start a battle between two agents');
  lines.push('    train <agent> [options]           Train an agent with Mr. Miyagi coaching');
  lines.push('    stats <agent> [options]           Show agent stats, ELO, and skill radar');
  lines.push('    export <agent> [options]          Export an agent package');
  lines.push('    import <source>                   Import an agent package');
  lines.push('    templates <action> [source]       Manage agent templates');
  lines.push('    report <target> [options]         Generate an HTML report');
  lines.push('    sessions <agent>                  List past sessions for an agent');
  lines.push('    install <type> <source> <agent>   Install a skill into an agent');
  lines.push('    update <type> <agent>             Update skills for an agent');
  lines.push('');
  lines.push('  Claude Code Options (all supported as pass-through):');
  for (const { flag, desc } of CLAUDE_FLAG_DESCRIPTIONS) {
    lines.push(`    ${flag.padEnd(38)} ${desc}`);
  }
  lines.push('    ... and all other claude CLI flags');
  lines.push('');

  return lines.join('\n');
}

export function formatInSessionHelp(agentName: string, agentSkills: string[]): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('  Miyagi In-Session Commands');
  lines.push('  ===');
  lines.push('');
  lines.push('  Commands:');

  const maxLen = Math.max(...MIYAGI_COMMANDS.map(c => c.cmd.length));
  for (const { cmd, desc } of MIYAGI_COMMANDS) {
    lines.push(`    ${cmd.padEnd(maxLen + 2)} ${desc}`);
  }

  lines.push('');
  lines.push(`  Active Agent: ${agentName}`);

  if (agentSkills.length > 0) {
    lines.push(`  Agent Skills: ${agentSkills.map(s => '/' + s).join(', ')}`);
  } else {
    lines.push('  Agent Skills: (none installed)');
  }

  lines.push('');
  lines.push('  Claude Code commands (/help, /rewind, /clear, etc.) work as normal.');
  lines.push('');

  return lines.join('\n');
}
