import type { ChildProcess } from 'child_process';
import type { ProviderName, SessionOptions, BattleAgentOptions } from '../../types/provider.js';

export interface ProviderBridge {
  readonly provider: ProviderName;

  buildSessionArgs(opts: SessionOptions): string[];
  buildBattleArgs(opts: BattleAgentOptions): string[];
  buildBattleStdin(opts: BattleAgentOptions): string;

  spawnInteractive(args: string[]): ChildProcess;
  runAndCapture(args: string[], timeout?: number, stdinData?: string, cwd?: string): Promise<string>;

  setupSkills(agentName: string, skillsDir: string): Promise<void>;
  cleanupSkills(): Promise<void>;
}
