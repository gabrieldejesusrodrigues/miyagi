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

  describe('discoverSkills', () => {
    it('discovers skills in skills/ subdirectory', () => {
      const fakeRepo = mkdtempSync(join(tmpdir(), 'miyagi-fake-repo-'));
      try {
        const skillDir = join(fakeRepo, 'skills', 'my-skill');
        mkdirSync(skillDir, { recursive: true });
        writeFileSync(
          join(skillDir, 'SKILL.md'),
          '---\nname: my-skill\ndescription: A test skill\n---\n# Test',
        );

        const skills = skillManager.discoverSkills(fakeRepo);
        expect(skills).toHaveLength(1);
        expect(skills[0].name).toBe('my-skill');
        expect(skills[0].description).toBe('A test skill');
      } finally {
        rmSync(fakeRepo, { recursive: true, force: true });
      }
    });

    it('discovers multiple skills in skills/ subdirectory', () => {
      const fakeRepo = mkdtempSync(join(tmpdir(), 'miyagi-fake-repo-'));
      try {
        for (const name of ['skill-a', 'skill-b', 'skill-c']) {
          const skillDir = join(fakeRepo, 'skills', name);
          mkdirSync(skillDir, { recursive: true });
          writeFileSync(
            join(skillDir, 'SKILL.md'),
            `---\nname: ${name}\ndescription: ${name} description\n---\n# ${name}`,
          );
        }

        const skills = skillManager.discoverSkills(fakeRepo);
        expect(skills).toHaveLength(3);
        expect(skills.map(s => s.name).sort()).toEqual(['skill-a', 'skill-b', 'skill-c']);
      } finally {
        rmSync(fakeRepo, { recursive: true, force: true });
      }
    });

    it('discovers single-skill repo with SKILL.md at root', () => {
      const fakeRepo = mkdtempSync(join(tmpdir(), 'miyagi-fake-repo-'));
      try {
        writeFileSync(
          join(fakeRepo, 'SKILL.md'),
          '---\nname: solo-skill\ndescription: Solo\n---\n# Solo',
        );

        const skills = skillManager.discoverSkills(fakeRepo);
        expect(skills).toHaveLength(1);
        expect(skills[0].name).toBe('solo-skill');
      } finally {
        rmSync(fakeRepo, { recursive: true, force: true });
      }
    });

    it('returns empty when no SKILL.md found', () => {
      const fakeRepo = mkdtempSync(join(tmpdir(), 'miyagi-fake-repo-'));
      try {
        mkdirSync(join(fakeRepo, 'src'), { recursive: true });

        const skills = skillManager.discoverSkills(fakeRepo);
        expect(skills).toHaveLength(0);
      } finally {
        rmSync(fakeRepo, { recursive: true, force: true });
      }
    });

    it('skips directories without SKILL.md', () => {
      const fakeRepo = mkdtempSync(join(tmpdir(), 'miyagi-fake-repo-'));
      try {
        mkdirSync(join(fakeRepo, 'skills', 'valid-skill'), { recursive: true });
        writeFileSync(
          join(fakeRepo, 'skills', 'valid-skill', 'SKILL.md'),
          '---\nname: valid-skill\ndescription: Valid\n---\n# Valid',
        );
        mkdirSync(join(fakeRepo, 'skills', 'no-skill-md'), { recursive: true });
        writeFileSync(join(fakeRepo, 'skills', 'no-skill-md', 'README.md'), '# Not a skill');

        const skills = skillManager.discoverSkills(fakeRepo);
        expect(skills).toHaveLength(1);
        expect(skills[0].name).toBe('valid-skill');
      } finally {
        rmSync(fakeRepo, { recursive: true, force: true });
      }
    });

    it('prefers root SKILL.md over skills/ subdirectory', () => {
      const fakeRepo = mkdtempSync(join(tmpdir(), 'miyagi-fake-repo-'));
      try {
        // Root SKILL.md
        writeFileSync(
          join(fakeRepo, 'SKILL.md'),
          '---\nname: root-skill\ndescription: Root\n---\n# Root',
        );
        // Also has skills/ dir
        mkdirSync(join(fakeRepo, 'skills', 'sub-skill'), { recursive: true });
        writeFileSync(
          join(fakeRepo, 'skills', 'sub-skill', 'SKILL.md'),
          '---\nname: sub-skill\ndescription: Sub\n---\n# Sub',
        );

        const skills = skillManager.discoverSkills(fakeRepo);
        // Root SKILL.md takes precedence (single-skill repo)
        expect(skills).toHaveLength(1);
        expect(skills[0].name).toBe('root-skill');
      } finally {
        rmSync(fakeRepo, { recursive: true, force: true });
      }
    });
  });

  describe('parseSkillMetadata', () => {
    it('parses name and description from frontmatter', () => {
      const fakeRepo = mkdtempSync(join(tmpdir(), 'miyagi-fake-repo-'));
      try {
        const skillMd = join(fakeRepo, 'SKILL.md');
        writeFileSync(skillMd, '---\nname: test-skill\ndescription: A great skill for testing\n---\n# Test');

        const metadata = skillManager.parseSkillMetadata(skillMd);
        expect(metadata.name).toBe('test-skill');
        expect(metadata.description).toBe('A great skill for testing');
      } finally {
        rmSync(fakeRepo, { recursive: true, force: true });
      }
    });

    it('returns unknown when no frontmatter', () => {
      const fakeRepo = mkdtempSync(join(tmpdir(), 'miyagi-fake-repo-'));
      try {
        const skillMd = join(fakeRepo, 'SKILL.md');
        writeFileSync(skillMd, '# Just a heading');

        const metadata = skillManager.parseSkillMetadata(skillMd);
        expect(metadata.name).toBe('unknown');
        expect(metadata.description).toBe('');
      } finally {
        rmSync(fakeRepo, { recursive: true, force: true });
      }
    });
  });
});
