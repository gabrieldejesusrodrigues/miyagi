import { spawn, execSync, type ChildProcess } from 'child_process';
import { existsSync, mkdirSync, cpSync, rmSync, readdirSync } from 'fs';
import { join } from 'path';
import type { ProviderBridge } from './types.js';
import type { SessionOptions, BattleAgentOptions } from '../../types/provider.js';

export class CodexBridge implements ProviderBridge {
  readonly provider = 'codex' as const;
  private binaryPath: string;
  private activeSkillDirs: string[] = [];

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
    const args: string[] = [];

    if (opts.model) {
      args.push('--model', opts.model);
    }

    if (opts.dangerouslySkipPermissions) {
      args.push('--yolo');
    }

    if (opts.cwd) {
      args.push('--cd', opts.cwd);
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

  async setupSkills(agentName: string, skillsDir: string): Promise<void> {
    // Codex discovers skills from .agents/skills/ in the working directory.
    // We copy agent skills to a prefixed directory under .agents/skills/.
    if (!existsSync(skillsDir)) return;

    const cwd = process.cwd();
    const agentsSkillsDir = join(cwd, '.agents', 'skills');

    for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillSrc = join(skillsDir, entry.name);
      const skillDest = join(agentsSkillsDir, `miyagi-${agentName}-${entry.name}`);

      if (!existsSync(agentsSkillsDir)) mkdirSync(agentsSkillsDir, { recursive: true });
      if (existsSync(skillDest)) rmSync(skillDest, { recursive: true, force: true });
      cpSync(skillSrc, skillDest, { recursive: true });
      this.activeSkillDirs.push(skillDest);
    }
  }

  async cleanupSkills(): Promise<void> {
    for (const dir of this.activeSkillDirs) {
      if (existsSync(dir)) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
    this.activeSkillDirs = [];
  }
}
