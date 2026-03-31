import { spawn, execSync, type ChildProcess } from 'child_process';
import type { ProviderBridge } from './types.js';
import type { SessionOptions, BattleAgentOptions } from '../../types/provider.js';

export class CodexBridge implements ProviderBridge {
  readonly provider = 'codex' as const;
  private binaryPath: string;

  constructor(binaryPath?: string) {
    this.binaryPath = binaryPath ?? this.findBinaryPath();
  }

  findBinaryPath(): string {
    try {
      return execSync('which codex', { encoding: 'utf-8' }).trim();
    } catch {
      return 'codex';
    }
  }

  buildSessionArgs(opts: SessionOptions): string[] {
    // Codex interactive TUI mode
    const args: string[] = [];

    if (opts.model) {
      args.push('--model', opts.model);
    }

    if (opts.dangerouslySkipPermissions) {
      args.push('--yolo');
    }

    // System prompt via -c instructions="..."
    if (opts.systemPrompt) {
      args.push('-c', `instructions=${JSON.stringify(opts.systemPrompt)}`);
    }

    if (opts.extraArgs) {
      args.push(...opts.extraArgs);
    }

    return args;
  }

  buildBattleArgs(opts: BattleAgentOptions): string[] {
    // Codex uses 'exec' subcommand for non-interactive mode
    const args: string[] = ['exec'];

    if (opts.model) {
      args.push('--model', opts.model);
    }

    if (opts.dangerouslySkipPermissions) {
      args.push('--yolo');
    }

    // System prompt via -c instructions="..."
    if (opts.systemPrompt) {
      args.push('-c', `instructions=${JSON.stringify(opts.systemPrompt)}`);
    }

    // Read prompt from stdin via '-'
    args.push('-');

    return args;
  }

  buildBattleStdin(opts: BattleAgentOptions): string {
    // Codex exec reads the prompt from stdin when '-' is specified
    return opts.prompt;
  }

  spawnInteractive(args: string[]): ChildProcess {
    return spawn(this.binaryPath, args, {
      stdio: 'inherit',
      env: { ...process.env },
    });
  }

  spawnNonInteractive(args: string[], cwd?: string): ChildProcess {
    return spawn(this.binaryPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
      ...(cwd ? { cwd } : {}),
    });
  }

  async runAndCapture(args: string[], timeout: number = 300_000, stdinData?: string, cwd?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = this.spawnNonInteractive(args, cwd);
      let stdout = '';
      let stderr = '';
      let killed = false;

      if (stdinData) {
        child.stdin?.write(stdinData);
        child.stdin?.end();
      }

      const timer = setTimeout(() => {
        killed = true;
        child.kill('SIGTERM');
      }, timeout);

      child.stdout?.on('data', (data) => { stdout += data.toString(); });
      child.stderr?.on('data', (data) => { stderr += data.toString(); });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (killed) {
          reject(new Error(`Codex process timed out after ${timeout}ms`));
        } else if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Codex exited with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  async setupSkills(_agentName: string, _skillsDir: string): Promise<void> {
    // Codex skills are configured via config.toml [[skills.config]] entries.
    // For now, we skip skill setup for Codex since it requires modifying
    // ~/.codex/config.toml which has a TOML format that's more complex to manage.
    // Skills content is instead injected via the system prompt.
  }

  async cleanupSkills(): Promise<void> {
    // No-op — skills injected via system prompt, no files to clean up
  }
}
