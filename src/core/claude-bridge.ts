import { spawn, execSync, type ChildProcess } from 'child_process';

interface SessionOptions {
  systemPrompt: string;
  dangerouslySkipPermissions?: boolean;
  resume?: boolean;
  sessionId?: string;
  model?: string;
}

interface BattleAgentOptions {
  systemPrompt: string;
  prompt: string;
  dangerouslySkipPermissions?: boolean;
  model?: string;
}

export class ClaudeBridge {
  private claudePath: string;

  constructor(claudePath?: string) {
    this.claudePath = claudePath ?? this.findClaudePath();
  }

  findClaudePath(): string {
    try {
      return execSync('which claude', { encoding: 'utf-8' }).trim();
    } catch {
      return 'claude';
    }
  }

  buildSessionArgs(options: SessionOptions): string[] {
    const args: string[] = [];

    if (options.dangerouslySkipPermissions) {
      args.push('--dangerously-skip-permissions');
    }

    args.push('--append-system-prompt', options.systemPrompt);

    if (options.resume && options.sessionId) {
      args.push('--resume', options.sessionId);
    } else if (options.resume) {
      args.push('--resume');
    }

    if (options.model) {
      args.push('--model', options.model);
    }

    return args;
  }

  buildBattleArgs(options: BattleAgentOptions): string[] {
    const args: string[] = ['--print'];

    if (options.dangerouslySkipPermissions) {
      args.push('--dangerously-skip-permissions');
    }

    args.push('--append-system-prompt', options.systemPrompt);

    if (options.model) {
      args.push('--model', options.model);
    }

    args.push('--prompt', options.prompt);

    return args;
  }

  spawnInteractive(args: string[]): ChildProcess {
    return spawn(this.claudePath, args, {
      stdio: 'inherit',
      env: { ...process.env },
    });
  }

  spawnNonInteractive(args: string[]): ChildProcess {
    return spawn(this.claudePath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });
  }

  async runAndCapture(args: string[], timeout: number = 300_000): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = this.spawnNonInteractive(args);
      let stdout = '';
      let stderr = '';
      let killed = false;

      const timer = setTimeout(() => {
        killed = true;
        child.kill('SIGTERM');
      }, timeout);

      child.stdout?.on('data', (data) => { stdout += data.toString(); });
      child.stderr?.on('data', (data) => { stderr += data.toString(); });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (killed) {
          reject(new Error(`Claude process timed out after ${timeout}ms`));
        } else if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Claude exited with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }
}
