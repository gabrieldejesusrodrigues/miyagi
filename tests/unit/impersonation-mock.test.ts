import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, lstatSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ConfigManager } from '../../src/core/config.js';
import { AgentManager } from '../../src/core/agent-manager.js';
import { ImpersonationManager } from '../../src/core/impersonation.js';

describe('ImpersonationManager', () => {
  let tmpDir: string;
  let claudeSkillsDir: string;
  let config: ConfigManager;
  let agentManager: AgentManager;
  let impersonation: ImpersonationManager;

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'miyagi-imp-test-'));
    claudeSkillsDir = join(tmpDir, 'claude-commands');
    mkdirSync(claudeSkillsDir, { recursive: true });
    config = new ConfigManager(tmpDir);
    config.ensureDirectories();
    agentManager = new AgentManager(config);
    impersonation = new ImpersonationManager(agentManager, claudeSkillsDir);
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

      await impersonation.activate('test-agent');

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

      await impersonation.activate('test-agent');
      await impersonation.deactivate();

      const symlinkPath = join(claudeSkillsDir, 'miyagi-test-agent-test-skill');
      expect(existsSync(symlinkPath)).toBe(false);
    });

    it('should throw for nonexistent agent', async () => {
      await expect(impersonation.activate('nonexistent')).rejects.toThrow('not found');
    });

    it('should handle agent with no skills', async () => {
      await agentManager.create('no-skills', { author: 'test' });
      await impersonation.activate('no-skills');
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
