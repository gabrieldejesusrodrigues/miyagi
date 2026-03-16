export const CLAUDE_FLAGS: string[] = [
  '--model', '--append-system-prompt', '--system-prompt',
  '--dangerously-skip-permissions', '--allow-dangerously-skip-permissions',
  '--permission-mode', '--print', '--continue', '--resume',
  '--worktree', '--effort', '--mcp-config', '--strict-mcp-config',
  '--allowedTools', '--allowed-tools', '--disallowedTools', '--disallowed-tools',
  '--add-dir', '--debug', '--debug-file', '--verbose',
  '--output-format', '--input-format', '--json-schema',
  '--max-budget-usd', '--name', '--session-id', '--fork-session',
  '--agent', '--agents', '--betas', '--brief', '--chrome', '--no-chrome',
  '--disable-slash-commands', '--fallback-model', '--file',
  '--from-pr', '--ide', '--include-partial-messages',
  '--no-session-persistence', '--plugin-dir',
  '--replay-user-messages', '--setting-sources', '--settings',
  '--tmux', '--tools',
];

export const CLAUDE_SHORT_FLAGS: Record<string, string> = {
  '-p': '--print',
  '-c': '--continue',
  '-r': '--resume',
  '-w': '--worktree',
  '-d': '--debug',
  '-n': '--name',
};

export const CLAUDE_FLAGS_WITH_VALUE = new Set([
  '--model', '--append-system-prompt', '--system-prompt',
  '--permission-mode', '--effort', '--mcp-config',
  '--allowedTools', '--allowed-tools', '--disallowedTools', '--disallowed-tools',
  '--add-dir', '--debug', '--debug-file', '--output-format', '--input-format',
  '--json-schema', '--max-budget-usd', '--name', '--session-id',
  '--agent', '--agents', '--betas', '--fallback-model', '--file',
  '--from-pr', '--plugin-dir', '--setting-sources', '--settings', '--tools',
]);

const CLAUDE_FLAG_SET = new Set([...CLAUDE_FLAGS, ...Object.keys(CLAUDE_SHORT_FLAGS)]);

export function parseArgs(args: string[]): { miyagiArgs: string[]; claudeArgs: string[] } {
  const miyagiArgs: string[] = [];
  const claudeArgs: string[] = [];
  let i = 0;

  while (i < args.length) {
    const arg = args[i];
    const longFlag = CLAUDE_SHORT_FLAGS[arg] ?? arg;

    if (CLAUDE_FLAG_SET.has(arg)) {
      claudeArgs.push(arg);
      if (CLAUDE_FLAGS_WITH_VALUE.has(longFlag) && i + 1 < args.length) {
        i++;
        claudeArgs.push(args[i]);
      }
    } else {
      miyagiArgs.push(arg);
    }
    i++;
  }

  return { miyagiArgs, claudeArgs };
}
