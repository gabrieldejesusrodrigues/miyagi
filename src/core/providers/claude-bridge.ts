import { spawn, execSync, type ChildProcess } from 'child_process';
import { existsSync, symlinkSync, unlinkSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { ProviderBridge } from './types.js';
import type { SessionOptions, BattleAgentOptions } from '../../types/provider.js';

export class ClaudeBridge implements ProviderBridge {
  readonly provider = 'claude' as const;
  private binaryPath: string;
  private activeSymlinks: string[] = [];

  constructor(binaryPath?: string) {
    this.binaryPath = binaryPath ?? this.findBinaryPath();
  }

  findBinaryPath(): string {
    try {
      return execSync('which claude', { encoding: 'utf-8' }).trim();
    } catch {
      return 'claude';
    }
  }

  buildSessionArgs(opts: SessionOptions): string[] {
    const args: string[] = [];

    if (opts.dangerouslySkipPermissions) {
      args.push('--dangerously-skip-permissions');
    }

    args.push('--append-system-prompt', opts.systemPrompt);

    if (opts.resumeSession === 'latest') {
      args.push('--resume');
    } else if (opts.resumeSession) {
      args.push('--resume', opts.resumeSession);
    }

    if (opts.model) {
      args.push('--model', opts.model);
    }

    if (opts.effort) {
      args.push('--effort', opts.effort);
    }

    if (opts.extraArgs) {
      args.push(...opts.extraArgs);
    }

    return args;
  }

  buildBattleArgs(opts: BattleAgentOptions): string[] {
    const args: string[] = ['--print'];

    if (opts.dangerouslySkipPermissions) {
      args.push('--dangerously-skip-permissions');
    }

    if (opts.model) {
      args.push('--model', opts.model);
    }

    if (opts.effort) {
      args.push('--effort', opts.effort);
    }

    return args;
  }

  buildBattleStdin(opts: BattleAgentOptions): string {
    return `<SYSTEM_PROMPT>\n${opts.systemPrompt}\n</SYSTEM_PROMPT>\n\n${opts.prompt}`;
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

  async setupSkills(agentName: string, skillsDir: string): Promise<void> {
    const claudeCommandsDir = join(homedir(), '.claude', 'commands');

    if (!existsSync(skillsDir)) return;

    for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillPath = join(skillsDir, entry.name);
      const symlinkName = `miyagi-${agentName}-${entry.name}`;
      const symlinkPath = join(claudeCommandsDir, symlinkName);

      if (existsSync(symlinkPath)) unlinkSync(symlinkPath);
      symlinkSync(skillPath, symlinkPath);
      this.activeSymlinks.push(symlinkPath);
    }
  }

  async cleanupSkills(): Promise<void> {
    for (const symlinkPath of this.activeSymlinks) {
      if (existsSync(symlinkPath)) {
        unlinkSync(symlinkPath);
      }
    }
    this.activeSymlinks = [];
  }
}
