import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ImpersonationManager } from '../../src/core/impersonation.js';
import { AgentManager } from '../../src/core/agent-manager.js';
import { ConfigManager } from '../../src/core/config.js';
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ImpersonationManager', () => {
  let tempDir: string;
  let claudeSkillsDir: string;
  let impersonation: ImpersonationManager;
  let agentManager: AgentManager;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'miyagi-test-'));
    claudeSkillsDir = join(tempDir, 'claude-skills');
    mkdirSync(claudeSkillsDir, { recursive: true });

    const config = new ConfigManager(tempDir);
    config.ensureDirectories();
    agentManager = new AgentManager(config);
    impersonation = new ImpersonationManager(agentManager, claudeSkillsDir);

    await agentManager.create('test-agent', { author: 'test' });
    const agent = await agentManager.get('test-agent');
    const skillDir = join(agent!.skillsDir, 'test-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: test-skill\ndescription: test\n---\n# Test');
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates prefixed symlinks for agent skills', async () => {
    await impersonation.activate('test-agent');
    const symlinkPath = join(claudeSkillsDir, 'miyagi-test-agent-test-skill');
    expect(existsSync(symlinkPath)).toBe(true);
  });

  it('cleans up symlinks on deactivate', async () => {
    await impersonation.activate('test-agent');
    await impersonation.deactivate();
    const symlinkPath = join(claudeSkillsDir, 'miyagi-test-agent-test-skill');
    expect(existsSync(symlinkPath)).toBe(false);
  });

  it('builds system prompt from identity.md', async () => {
    const prompt = await impersonation.buildSystemPrompt('test-agent');
    expect(prompt).toContain('# test-agent');
  });
});
