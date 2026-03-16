import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { MiyagiConfig } from '../types/index.js';

export class ConfigManager {
  private readonly rootDir: string;
  private readonly configPath: string;

  constructor(rootDir?: string) {
    this.rootDir = rootDir ?? join(homedir(), '.miyagi');
    this.configPath = join(this.rootDir, 'config.json');
  }

  get root(): string {
    return this.rootDir;
  }

  get agentsDir(): string {
    return join(this.rootDir, 'agents');
  }

  get templatesDir(): string {
    return join(this.rootDir, 'templates');
  }

  get reportsDir(): string {
    return join(this.rootDir, 'reports');
  }

  ensureDirectories(): void {
    const dirs = [
      this.rootDir,
      this.agentsDir,
      this.templatesDir,
      this.reportsDir,
    ];
    for (const dir of dirs) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
  }

  load(): MiyagiConfig {
    if (!existsSync(this.configPath)) {
      return {};
    }
    const raw = readFileSync(this.configPath, 'utf-8');
    return JSON.parse(raw) as MiyagiConfig;
  }

  save(config: MiyagiConfig): void {
    this.ensureDirectories();
    writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
  }
}
