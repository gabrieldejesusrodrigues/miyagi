import {
  existsSync, readdirSync, readFileSync, rmSync, writeFileSync,
  mkdtempSync, cpSync,
} from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { tmpdir } from 'os';
import type { AgentSkill, InstalledSkillEntry } from '../types/index.js';
import { validateInstalledSkills } from '../utils/validators.js';
import type { AgentManager } from './agent-manager.js';
import { ClaudeBridge } from './claude-bridge.js';

export interface DiscoveredSkill {
  name: string;
  description: string;
  path: string;
}

export interface InstallOptions {
  skills?: string[];
  noIntegrate?: boolean;
}

export class SkillManager {
  private readonly agentManager: AgentManager;

  constructor(agentManager: AgentManager) {
    this.agentManager = agentManager;
  }

  async list(agentName: string): Promise<AgentSkill[]> {
    const agent = await this.agentManager.get(agentName);
    if (!agent) throw new Error(`Agent "${agentName}" not found`);

    const skills: AgentSkill[] = [];
    if (!existsSync(agent.skillsDir)) return skills;

    const installedSkills = this.readInstalledSkills(agent.rootDir);
    const installedNames = new Set(installedSkills.map(s => s.name));

    for (const entry of readdirSync(agent.skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillMdPath = join(agent.skillsDir, entry.name, 'SKILL.md');
      if (!existsSync(skillMdPath)) continue;

      const metadata = this.parseSkillMetadata(skillMdPath);
      skills.push({
        name: entry.name,
        metadata,
        path: join(agent.skillsDir, entry.name),
        type: installedNames.has(entry.name) ? 'installed' : 'custom',
        source: installedSkills.find(s => s.name === entry.name)?.source,
      });
    }

    return skills;
  }

  async install(source: string, agentName: string, options?: InstallOptions): Promise<string[]> {
    const agent = await this.agentManager.get(agentName);
    if (!agent) throw new Error(`Agent "${agentName}" not found`);

    const tmpDir = mkdtempSync(join(tmpdir(), 'miyagi-skill-'));

    try {
      const repoUrl = source.startsWith('http') ? source : `https://github.com/${source}.git`;
      execSync(`git clone --depth 1 ${repoUrl} ${tmpDir}`, { stdio: 'pipe' });

      const available = this.discoverSkills(tmpDir);
      if (available.length === 0) {
        throw new Error(`No skills found in repository "${source}". Skills must have a SKILL.md file.`);
      }

      const toInstall = options?.skills
        ? available.filter(s => options.skills!.includes(s.name))
        : available;

      if (toInstall.length === 0) {
        const requested = options?.skills?.join(', ') ?? '';
        const found = available.map(s => s.name).join(', ');
        throw new Error(`Skill(s) "${requested}" not found. Available skills: ${found}`);
      }

      const installedNames: string[] = [];
      const existing = this.readInstalledSkills(agent.rootDir);

      for (const skill of toInstall) {
        const destDir = join(agent.skillsDir, skill.name);
        cpSync(skill.path, destDir, { recursive: true });
        installedNames.push(skill.name);

        const entryIndex = existing.findIndex(e => e.name === skill.name);
        const entry: InstalledSkillEntry = {
          name: skill.name,
          source,
          installedAt: new Date().toISOString(),
        };
        if (entryIndex >= 0) {
          existing[entryIndex] = entry;
        } else {
          existing.push(entry);
        }
      }

      this.writeInstalledSkills(agent.rootDir, existing);
      return installedNames;
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  async discoverFromRepo(source: string): Promise<DiscoveredSkill[]> {
    const tmpDir = mkdtempSync(join(tmpdir(), 'miyagi-skill-'));

    try {
      const repoUrl = source.startsWith('http') ? source : `https://github.com/${source}.git`;
      execSync(`git clone --depth 1 ${repoUrl} ${tmpDir}`, { stdio: 'pipe' });
      return this.discoverSkills(tmpDir);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  discoverSkills(repoDir: string): DiscoveredSkill[] {
    // Check repo root for single-skill repos (SKILL.md at root)
    const rootSkillMd = join(repoDir, 'SKILL.md');
    if (existsSync(rootSkillMd)) {
      const metadata = this.parseSkillMetadata(rootSkillMd);
      return [{ name: metadata.name, description: metadata.description, path: repoDir }];
    }

    // Check for skills/ subdirectory (mono-repo convention)
    const skillsDir = join(repoDir, 'skills');
    if (!existsSync(skillsDir)) {
      return [];
    }

    const skills: DiscoveredSkill[] = [];
    for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillMdPath = join(skillsDir, entry.name, 'SKILL.md');
      if (!existsSync(skillMdPath)) continue;
      const metadata = this.parseSkillMetadata(skillMdPath);
      skills.push({
        name: entry.name,
        description: metadata.description,
        path: join(skillsDir, entry.name),
      });
    }

    return skills;
  }

  async integrateSkillsIntoIdentity(agentName: string, skillNames: string[]): Promise<void> {
    const agent = await this.agentManager.get(agentName);
    if (!agent) throw new Error(`Agent "${agentName}" not found`);

    const identity = readFileSync(agent.identityPath, 'utf-8');

    const skillSummaries: string[] = [];
    for (const name of skillNames) {
      const skillMdPath = join(agent.skillsDir, name, 'SKILL.md');
      if (!existsSync(skillMdPath)) continue;
      const metadata = this.parseSkillMetadata(skillMdPath);
      skillSummaries.push(`- **${metadata.name}**: ${metadata.description}`);
    }

    if (skillSummaries.length === 0) return;

    const prompt = [
      'You are updating an AI agent\'s identity file to reference newly installed skills.',
      'The agent\'s current identity.md is:',
      '```markdown',
      identity,
      '```',
      '',
      'The following skills were just installed:',
      ...skillSummaries,
      '',
      'INSTRUCTIONS:',
      '- Add a brief reference for each new skill under the "## Skill Directives" section.',
      '- For each skill, write ONE concise directive line explaining when and how the agent should use it.',
      '- If a "## Skill Directives" section does not exist, create it before "## Context References" or at the end.',
      '- Do NOT remove or modify any existing content.',
      '- Do NOT add skills that are already referenced in the identity.',
      '- Output ONLY the complete updated identity.md content, no explanation, no markdown fences.',
    ].join('\n');

    const bridge = new ClaudeBridge();
    const args = bridge.buildBattleArgs({
      systemPrompt: '',
      prompt: '',
      model: 'sonnet',
      effort: 'medium',
    });

    const result = await bridge.runAndCapture(args, 120_000, prompt);
    const updatedIdentity = result.trim();

    if (updatedIdentity.length > 0) {
      writeFileSync(agent.identityPath, updatedIdentity);
    }
  }

  async remove(skillName: string, agentName: string): Promise<void> {
    const agent = await this.agentManager.get(agentName);
    if (!agent) throw new Error(`Agent "${agentName}" not found`);

    const skillDir = join(agent.skillsDir, skillName);
    if (!existsSync(skillDir)) {
      throw new Error(`Skill "${skillName}" not found in agent "${agentName}"`);
    }

    rmSync(skillDir, { recursive: true, force: true });

    const installed = this.readInstalledSkills(agent.rootDir);
    const updated = installed.filter(s => s.name !== skillName);
    this.writeInstalledSkills(agent.rootDir, updated);
  }

  async updateAll(agentName: string): Promise<void> {
    const agent = await this.agentManager.get(agentName);
    if (!agent) throw new Error(`Agent "${agentName}" not found`);

    const installed = this.readInstalledSkills(agent.rootDir);
    if (installed.length === 0) return;

    // Group skills by source repo to minimize clones
    const bySource = new Map<string, string[]>();
    for (const skill of installed) {
      const skills = bySource.get(skill.source) ?? [];
      skills.push(skill.name);
      bySource.set(skill.source, skills);
    }

    for (const [source, skillNames] of bySource) {
      try {
        await this.install(source, agentName, { skills: skillNames, noIntegrate: true });
      } catch (err) {
        console.error(`Failed to update skills from "${source}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  parseSkillMetadata(skillMdPath: string): { name: string; description: string } {
    const content = readFileSync(skillMdPath, 'utf-8');
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

    if (!frontmatterMatch) {
      return { name: 'unknown', description: '' };
    }

    const frontmatter = frontmatterMatch[1];
    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
    const descMatch = frontmatter.match(/^description:\s*["']?(.+?)["']?\s*$/m);

    return {
      name: nameMatch?.[1]?.trim() ?? 'unknown',
      description: descMatch?.[1]?.trim() ?? '',
    };
  }

  private readInstalledSkills(agentRootDir: string): InstalledSkillEntry[] {
    const filePath = join(agentRootDir, '.installed-skills.json');
    if (!existsSync(filePath)) return [];
    try {
      const data = JSON.parse(readFileSync(filePath, 'utf-8'));
      const validation = validateInstalledSkills(data);
      if (!validation.valid) {
        throw new Error(`Invalid .installed-skills.json in ${agentRootDir}: ${validation.errors.join(', ')}`);
      }
      return data as InstalledSkillEntry[];
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Failed to parse .installed-skills.json in ${agentRootDir}: ${error.message}`);
      }
      throw error;
    }
  }

  private writeInstalledSkills(agentRootDir: string, entries: InstalledSkillEntry[]): void {
    const path = join(agentRootDir, '.installed-skills.json');
    writeFileSync(path, JSON.stringify(entries, null, 2));
  }
}
