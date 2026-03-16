import {
  existsSync, readdirSync, readFileSync, rmSync, writeFileSync,
} from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import type { AgentSkill, InstalledSkillEntry } from '../types/index.js';
import { validateInstalledSkills } from '../utils/validators.js';
import type { AgentManager } from './agent-manager.js';

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

  async install(source: string, agentName: string): Promise<void> {
    const agent = await this.agentManager.get(agentName);
    if (!agent) throw new Error(`Agent "${agentName}" not found`);

    execSync(`npx skills add ${source} --copy`, {
      cwd: agent.skillsDir,
      stdio: 'inherit',
    });
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
    for (const skill of installed) {
      execSync(`npx skills add ${skill.source} --copy --yes`, {
        cwd: agent.skillsDir,
        stdio: 'inherit',
      });
    }
  }

  private parseSkillMetadata(skillMdPath: string): { name: string; description: string } {
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
