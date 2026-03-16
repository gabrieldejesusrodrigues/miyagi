import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SkillManager } from '../../src/core/skill-manager.js';
import { AgentManager } from '../../src/core/agent-manager.js';
import { ConfigManager } from '../../src/core/config.js';
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('SkillManager', () => {
  let tempDir: string;
  let skillManager: SkillManager;
  let agentManager: AgentManager;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'miyagi-test-'));
    const config = new ConfigManager(tempDir);
    config.ensureDirectories();
    agentManager = new AgentManager(config);
    skillManager = new SkillManager(agentManager);
    await agentManager.create('test-agent', { author: 'test' });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('lists skills for an agent', async () => {
    const skills = await skillManager.list('test-agent');
    expect(skills).toEqual([]);
  });

  it('lists custom skills after manual creation', async () => {
    const agent = await agentManager.get('test-agent');
    const skillDir = join(agent!.skillsDir, 'miyagi-test-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: miyagi-test-skill\ndescription: test\n---\n# Test');

    const skills = await skillManager.list('test-agent');
    expect(skills.length).toBe(1);
    expect(skills[0].name).toBe('miyagi-test-skill');
    expect(skills[0].type).toBe('custom');
  });

  it('removes a skill from an agent', async () => {
    const agent = await agentManager.get('test-agent');
    const skillDir = join(agent!.skillsDir, 'miyagi-test-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: miyagi-test-skill\ndescription: test\n---\n# Test');

    await skillManager.remove('miyagi-test-skill', 'test-agent');
    expect(existsSync(skillDir)).toBe(false);
  });
});
