import { spawn, execSync, type ChildProcess } from 'child_process';
import { existsSync, writeFileSync, unlinkSync, readdirSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { ProviderBridge } from './types.js';
import type { SessionOptions, BattleAgentOptions } from '../../types/provider.js';

export class GeminiBridge implements ProviderBridge {
  readonly provider = 'gemini' as const;
  private binaryPath: string;
  private activeSkillFiles: string[] = [];

  constructor(binaryPath?: string) {
    this.binaryPath = binaryPath ?? this.findBinaryPath();
  }

  findBinaryPath(): string {
    try {
      return execSync('which gemini', { encoding: 'utf-8' }).trim();
    } catch {
      return 'gemini';
    }
  }

  buildSessionArgs(opts: SessionOptions): string[] {
    const args: string[] = [];

    if (opts.model) {
      args.push('--model', opts.model);
    }

    if (opts.dangerouslySkipPermissions) {
      args.push('--approval-mode', 'yolo');
    }

    if (opts.resumeSession && opts.resumeSession !== 'latest') {
      args.push('--resume', opts.resumeSession);
    } else if (opts.resumeSession === 'latest') {
      args.push('--resume', 'latest');
    }

    if (opts.extraArgs) {
      args.push(...opts.extraArgs);
    }

    // Gemini uses --prompt-interactive to seed the session with system instructions
    // while keeping the interactive REPL open for follow-up conversation.
    if (opts.systemPrompt) {
      args.push('--prompt-interactive', `Follow these instructions for our entire conversation:\n\n${opts.systemPrompt}`);
    }

    return args;
  }

  buildBattleArgs(opts: BattleAgentOptions): string[] {
    const args: string[] = [];

    if (opts.model) {
      args.push('--model', opts.model);
    }

    if (opts.dangerouslySkipPermissions) {
      args.push('--approval-mode', 'yolo');
    }

    // Gemini CLI does not support --effort; the parameter is intentionally not forwarded.

    // -p flag forces non-interactive mode.
    // Stdin content is prepended to the -p argument value.
    // We pass an empty -p so the full prompt comes from stdin.
    args.push('-p', '');

    return args;
  }

  buildBattleStdin(opts: BattleAgentOptions): string {
    // Gemini prepends stdin content to the -p flag value.
    // We embed the system prompt + user prompt together in stdin.
    let input = '';
    if (opts.systemPrompt) {
      input += `<SYSTEM_INSTRUCTIONS>\n${opts.systemPrompt}\n</SYSTEM_INSTRUCTIONS>\n\n`;
    }
    input += opts.prompt;
    return input;
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
          reject(new Error(`Gemini process timed out after ${timeout}ms`));
        } else if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Gemini exited with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  async setupSkills(agentName: string, skillsDir: string): Promise<void> {
    const geminiCommandsDir = join(homedir(), '.gemini', 'commands');

    if (!existsSync(skillsDir)) return;
    if (!existsSync(geminiCommandsDir)) mkdirSync(geminiCommandsDir, { recursive: true });

    for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillMdPath = join(skillsDir, entry.name, 'SKILL.md');
      if (!existsSync(skillMdPath)) continue;

      const content = readFileSync(skillMdPath, 'utf-8');
      const descMatch = content.match(/^description:\s*["']?(.+?)["']?\s*$/m);
      const description = descMatch?.[1] ?? '';
      const bodyMatch = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
      const body = bodyMatch?.[1]?.trim() ?? content;

      const tomlName = `miyagi-${agentName}-${entry.name}.toml`;
      const tomlPath = join(geminiCommandsDir, tomlName);
      const tomlContent = `description = ${JSON.stringify(description)}\nprompt = ${JSON.stringify(body)}\n`;

      writeFileSync(tomlPath, tomlContent);
      this.activeSkillFiles.push(tomlPath);
    }
  }

  async cleanupSkills(): Promise<void> {
    for (const filePath of this.activeSkillFiles) {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    }
    this.activeSkillFiles = [];
  }
}
