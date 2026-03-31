import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, lstatSync, readdirSync, symlinkSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ConfigManager } from '../../src/core/config.js';
import { AgentManager } from '../../src/core/agent-manager.js';
import { ImpersonationManager } from '../../src/core/impersonation.js';
import type { ProviderBridge } from '../../src/core/providers/types.js';

function createTestBridge(claudeSkillsDir: string): ProviderBridge {
  const activeSymlinks: string[] = [];
  return {
    provider: 'claude',
    buildSessionArgs: () => [],
    buildBattleArgs: () => [],
    buildBattleStdin: () => '',
    spawnInteractive: () => { throw new Error('not implemented'); },
    runAndCapture: async () => '',
    setupSkills: async (agentName: string, skillsDir: string) => {
      if (!existsSync(skillsDir)) return;
      for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const skillPath = join(skillsDir, entry.name);
        const symlinkName = `miyagi-${agentName}-${entry.name}`;
        const symlinkPath = join(claudeSkillsDir, symlinkName);
        if (existsSync(symlinkPath)) unlinkSync(symlinkPath);
        symlinkSync(skillPath, symlinkPath);
        activeSymlinks.push(symlinkPath);
      }
    },
    cleanupSkills: async () => {
      for (const symlinkPath of activeSymlinks) {
        if (existsSync(symlinkPath)) unlinkSync(symlinkPath);
      }
      activeSymlinks.length = 0;
    },
  } as ProviderBridge;
}

describe('ImpersonationManager', () => {
  let tmpDir: string;
  let claudeSkillsDir: string;
  let config: ConfigManager;
  let agentManager: AgentManager;
  let impersonation: ImpersonationManager;
  let bridge: ProviderBridge;

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'miyagi-imp-test-'));
    claudeSkillsDir = join(tmpDir, 'claude-commands');
    mkdirSync(claudeSkillsDir, { recursive: true });
    config = new ConfigManager(tmpDir);
    config.ensureDirectories();
    agentManager = new AgentManager(config);
    impersonation = new ImpersonationManager(agentManager);
    bridge = createTestBridge(claudeSkillsDir);
  });

  afterEach(async () => {
    await impersonation.deactivate();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('activate/deactivate', () => {
    it('should create symlinks for agent skills', async () => {
      await agentManager.create('test-agent', { author: 'test' });
      const agent = await agentManager.get('test-agent');
      const skillDir = join(agent!.skillsDir, 'test-skill');
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(
        join(skillDir, 'SKILL.md'),
        '---\nname: test\ndescription: test skill\n---\nContent',
      );

      await impersonation.activate('test-agent', bridge);

      const symlinkPath = join(claudeSkillsDir, 'miyagi-test-agent-test-skill');
      expect(existsSync(symlinkPath)).toBe(true);
      expect(lstatSync(symlinkPath).isSymbolicLink()).toBe(true);
    });

    it('should remove symlinks on deactivate', async () => {
      await agentManager.create('test-agent', { author: 'test' });
      const agent = await agentManager.get('test-agent');
      const skillDir = join(agent!.skillsDir, 'test-skill');
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(
        join(skillDir, 'SKILL.md'),
        '---\nname: test\ndescription: test\n---\nContent',
      );

      await impersonation.activate('test-agent', bridge);
      await impersonation.deactivate();

      const symlinkPath = join(claudeSkillsDir, 'miyagi-test-agent-test-skill');
      expect(existsSync(symlinkPath)).toBe(false);
    });

    it('should throw for nonexistent agent', async () => {
      await expect(impersonation.activate('nonexistent', bridge)).rejects.toThrow('not found');
    });

    it('should handle agent with no skills', async () => {
      await agentManager.create('no-skills', { author: 'test' });
      await impersonation.activate('no-skills', bridge);
      // Should not throw
      await impersonation.deactivate();
    });
  });

  describe('buildSystemPrompt', () => {
    it('should include identity content', async () => {
      await agentManager.create('prompt-agent', { author: 'test' });
      const prompt = await impersonation.buildSystemPrompt('prompt-agent');
      expect(prompt).toContain('# prompt-agent');
      expect(prompt).toContain('## Personality');
    });

    it('should include context files', async () => {
      await agentManager.create('ctx-agent', { author: 'test' });
      const agent = await agentManager.get('ctx-agent');
      writeFileSync(join(agent!.contextDir, 'reference.md'), '# Reference\nSome context.');

      const prompt = await impersonation.buildSystemPrompt('ctx-agent');
      expect(prompt).toContain('# Reference');
      expect(prompt).toContain('Some context.');
    });

    it('should throw for nonexistent agent', async () => {
      await expect(impersonation.buildSystemPrompt('nope')).rejects.toThrow('not found');
    });
  });
});
