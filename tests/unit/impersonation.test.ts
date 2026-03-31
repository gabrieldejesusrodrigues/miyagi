import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ImpersonationManager } from '../../src/core/impersonation.js';
import { AgentManager } from '../../src/core/agent-manager.js';
import { ConfigManager } from '../../src/core/config.js';
import { ClaudeBridge } from '../../src/core/providers/claude-bridge.js';
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ImpersonationManager', () => {
  let tempDir: string;
  let claudeSkillsDir: string;
  let impersonation: ImpersonationManager;
  let agentManager: AgentManager;
  let bridge: ClaudeBridge;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'miyagi-test-'));
    claudeSkillsDir = join(tempDir, 'claude-skills');
    mkdirSync(claudeSkillsDir, { recursive: true });

    const config = new ConfigManager(tempDir);
    config.ensureDirectories();
    agentManager = new AgentManager(config);
    impersonation = new ImpersonationManager(agentManager);

    // Create a ClaudeBridge that uses our temp dir for skills
    bridge = new ClaudeBridge('echo');
    // Override setupSkills/cleanupSkills to use our temp claudeSkillsDir
    const activeSymlinks: string[] = [];
    bridge.setupSkills = async (agentName: string, skillsDir: string) => {
      if (!existsSync(skillsDir)) return;
      const { readdirSync, symlinkSync, unlinkSync } = await import('fs');
      for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const skillPath = join(skillsDir, entry.name);
        const symlinkName = `miyagi-${agentName}-${entry.name}`;
        const symlinkPath = join(claudeSkillsDir, symlinkName);
        if (existsSync(symlinkPath)) unlinkSync(symlinkPath);
        symlinkSync(skillPath, symlinkPath);
        activeSymlinks.push(symlinkPath);
      }
    };
    bridge.cleanupSkills = async () => {
      const { unlinkSync } = await import('fs');
      for (const symlinkPath of activeSymlinks) {
        if (existsSync(symlinkPath)) unlinkSync(symlinkPath);
      }
      activeSymlinks.length = 0;
    };

    await agentManager.create('test-agent', { author: 'test' });
    const agent = await agentManager.get('test-agent');
    const skillDir = join(agent!.skillsDir, 'test-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: test-skill\ndescription: test\n---\n# Test');
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates prefixed symlinks for agent skills via bridge', async () => {
    await impersonation.activate('test-agent', bridge);
    const symlinkPath = join(claudeSkillsDir, 'miyagi-test-agent-test-skill');
    expect(existsSync(symlinkPath)).toBe(true);
  });

  it('cleans up symlinks on deactivate', async () => {
    await impersonation.activate('test-agent', bridge);
    await impersonation.deactivate();
    const symlinkPath = join(claudeSkillsDir, 'miyagi-test-agent-test-skill');
    expect(existsSync(symlinkPath)).toBe(false);
  });

  it('builds system prompt from identity.md', async () => {
    const prompt = await impersonation.buildSystemPrompt('test-agent');
    expect(prompt).toContain('# test-agent');
  });
});
