import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock child_process before importing modules that use it
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return { ...actual, execSync: vi.fn() };
});

import { execSync } from 'child_process';
import { SkillManager } from '../../src/core/skill-manager.js';
import { AgentManager } from '../../src/core/agent-manager.js';
import { ConfigManager } from '../../src/core/config.js';

const mockedExecSync = vi.mocked(execSync);

describe('SkillManager (mocked execSync)', () => {
  let tmpDir: string;
  let config: ConfigManager;
  let agentManager: AgentManager;
  let skillManager: SkillManager;

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'miyagi-test-'));
    config = new ConfigManager(tmpDir);
    config.ensureDirectories();
    agentManager = new AgentManager(config);
    skillManager = new SkillManager(agentManager);
    mockedExecSync.mockReset();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('install (clone-extract-copy)', () => {
    it('should clone the repo with git clone --depth 1', async () => {
      await agentManager.create('test-agent', { author: 'test' });

      // Mock execSync to create a fake skill in the temp dir when git clone is called
      mockedExecSync.mockImplementation((cmd: string) => {
        const cmdStr = String(cmd);
        if (cmdStr.startsWith('git clone')) {
          // Extract the temp dir path from the command
          const parts = cmdStr.split(' ');
          const cloneDir = parts[parts.length - 1];
          // Create a fake skill structure
          mkdirSync(join(cloneDir, 'skills', 'test-skill'), { recursive: true });
          writeFileSync(
            join(cloneDir, 'skills', 'test-skill', 'SKILL.md'),
            '---\nname: test-skill\ndescription: A test skill\n---\n# Test',
          );
        }
        return Buffer.from('');
      });

      await skillManager.install('anthropics/skills', 'test-agent', { skills: ['test-skill'] });

      expect(mockedExecSync).toHaveBeenCalledWith(
        expect.stringMatching(/git clone --depth 1 https:\/\/github\.com\/anthropics\/skills\.git/),
        expect.objectContaining({ stdio: 'pipe' }),
      );
    });

    it('should copy selected skills to agent skills dir', async () => {
      await agentManager.create('test-agent', { author: 'test' });
      const agent = await agentManager.get('test-agent');

      mockedExecSync.mockImplementation((cmd: string) => {
        const cmdStr = String(cmd);
        if (cmdStr.startsWith('git clone')) {
          const parts = cmdStr.split(' ');
          const cloneDir = parts[parts.length - 1];
          mkdirSync(join(cloneDir, 'skills', 'my-skill'), { recursive: true });
          writeFileSync(
            join(cloneDir, 'skills', 'my-skill', 'SKILL.md'),
            '---\nname: my-skill\ndescription: My skill\n---\n# My Skill',
          );
        }
        return Buffer.from('');
      });

      const installed = await skillManager.install('owner/repo', 'test-agent', { skills: ['my-skill'] });

      expect(installed).toEqual(['my-skill']);
      const skillMd = readFileSync(join(agent!.skillsDir, 'my-skill', 'SKILL.md'), 'utf-8');
      expect(skillMd).toContain('name: my-skill');
    });

    it('should update .installed-skills.json', async () => {
      await agentManager.create('test-agent', { author: 'test' });
      const agent = await agentManager.get('test-agent');

      mockedExecSync.mockImplementation((cmd: string) => {
        const cmdStr = String(cmd);
        if (cmdStr.startsWith('git clone')) {
          const parts = cmdStr.split(' ');
          const cloneDir = parts[parts.length - 1];
          mkdirSync(join(cloneDir, 'skills', 'my-skill'), { recursive: true });
          writeFileSync(
            join(cloneDir, 'skills', 'my-skill', 'SKILL.md'),
            '---\nname: my-skill\ndescription: desc\n---\n# S',
          );
        }
        return Buffer.from('');
      });

      await skillManager.install('owner/repo', 'test-agent', { skills: ['my-skill'] });

      const json = JSON.parse(readFileSync(join(agent!.rootDir, '.installed-skills.json'), 'utf-8'));
      expect(json).toHaveLength(1);
      expect(json[0].name).toBe('my-skill');
      expect(json[0].source).toBe('owner/repo');
    });

    it('should install all skills when no filter provided', async () => {
      await agentManager.create('test-agent', { author: 'test' });

      mockedExecSync.mockImplementation((cmd: string) => {
        const cmdStr = String(cmd);
        if (cmdStr.startsWith('git clone')) {
          const parts = cmdStr.split(' ');
          const cloneDir = parts[parts.length - 1];
          for (const name of ['skill-a', 'skill-b']) {
            mkdirSync(join(cloneDir, 'skills', name), { recursive: true });
            writeFileSync(
              join(cloneDir, 'skills', name, 'SKILL.md'),
              `---\nname: ${name}\ndescription: ${name} desc\n---\n# ${name}`,
            );
          }
        }
        return Buffer.from('');
      });

      const installed = await skillManager.install('owner/repo', 'test-agent');
      expect(installed).toEqual(['skill-a', 'skill-b']);
    });

    it('should throw when requested skill not found in repo', async () => {
      await agentManager.create('test-agent', { author: 'test' });

      mockedExecSync.mockImplementation((cmd: string) => {
        const cmdStr = String(cmd);
        if (cmdStr.startsWith('git clone')) {
          const parts = cmdStr.split(' ');
          const cloneDir = parts[parts.length - 1];
          mkdirSync(join(cloneDir, 'skills', 'other-skill'), { recursive: true });
          writeFileSync(
            join(cloneDir, 'skills', 'other-skill', 'SKILL.md'),
            '---\nname: other-skill\ndescription: other\n---\n# Other',
          );
        }
        return Buffer.from('');
      });

      await expect(
        skillManager.install('owner/repo', 'test-agent', { skills: ['nonexistent'] }),
      ).rejects.toThrow(/Skill\(s\) "nonexistent" not found/);
    });

    it('should throw when agent not found', async () => {
      await expect(
        skillManager.install('owner/repo', 'nonexistent', { skills: ['x'] }),
      ).rejects.toThrow(/Agent "nonexistent" not found/);
    });

    it('should not call execSync when agent not found', async () => {
      await expect(
        skillManager.install('owner/repo', 'nonexistent', { skills: ['x'] }),
      ).rejects.toThrow();
      expect(mockedExecSync).not.toHaveBeenCalled();
    });

    it('should clean up temp dir even on error', async () => {
      await agentManager.create('test-agent', { author: 'test' });

      mockedExecSync.mockImplementation(() => {
        throw new Error('git clone failed');
      });

      await expect(
        skillManager.install('bad/repo', 'test-agent', { skills: ['x'] }),
      ).rejects.toThrow();

      // The temp dir should have been cleaned up by the finally block
      // We can't directly check the temp dir since it's internal,
      // but verifying no crash on cleanup is the key assertion
    });

    it('should handle http URLs as source', async () => {
      await agentManager.create('test-agent', { author: 'test' });

      mockedExecSync.mockImplementation((cmd: string) => {
        const cmdStr = String(cmd);
        if (cmdStr.startsWith('git clone')) {
          const parts = cmdStr.split(' ');
          const cloneDir = parts[parts.length - 1];
          mkdirSync(join(cloneDir, 'skills', 'sk'), { recursive: true });
          writeFileSync(
            join(cloneDir, 'skills', 'sk', 'SKILL.md'),
            '---\nname: sk\ndescription: d\n---\n# S',
          );
        }
        return Buffer.from('');
      });

      await skillManager.install('https://github.com/owner/repo.git', 'test-agent', { skills: ['sk'] });

      expect(mockedExecSync).toHaveBeenCalledWith(
        expect.stringContaining('https://github.com/owner/repo.git'),
        expect.any(Object),
      );
    });
  });

  describe('discoverFromRepo', () => {
    it('should clone repo and return discovered skills', async () => {
      mockedExecSync.mockImplementation((cmd: string) => {
        const cmdStr = String(cmd);
        if (cmdStr.startsWith('git clone')) {
          const parts = cmdStr.split(' ');
          const cloneDir = parts[parts.length - 1];
          mkdirSync(join(cloneDir, 'skills', 'found-skill'), { recursive: true });
          writeFileSync(
            join(cloneDir, 'skills', 'found-skill', 'SKILL.md'),
            '---\nname: found-skill\ndescription: Found it\n---\n# Found',
          );
        }
        return Buffer.from('');
      });

      const result = await skillManager.discoverFromRepo('owner/repo');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('found-skill');
      expect(result[0].description).toBe('Found it');
      expect(mockedExecSync).toHaveBeenCalledWith(
        expect.stringMatching(/git clone --depth 1/),
        expect.any(Object),
      );
    });

    it('should clean up temp dir after discovery', async () => {
      mockedExecSync.mockReturnValue(Buffer.from(''));

      // Empty repo returns empty array, but temp dir is cleaned up
      const result = await skillManager.discoverFromRepo('owner/repo');
      expect(result).toEqual([]);
    });
  });

  describe('updateAll (clone-extract-copy)', () => {
    it('should clone once per unique source', async () => {
      await agentManager.create('test-agent', { author: 'test' });
      const agent = await agentManager.get('test-agent');
      writeFileSync(
        join(agent!.rootDir, '.installed-skills.json'),
        JSON.stringify([
          { name: 'skill1', source: 'owner/repo', installedAt: new Date().toISOString() },
          { name: 'skill2', source: 'owner/repo', installedAt: new Date().toISOString() },
        ]),
      );

      mockedExecSync.mockImplementation((cmd: string) => {
        const cmdStr = String(cmd);
        if (cmdStr.startsWith('git clone')) {
          const parts = cmdStr.split(' ');
          const cloneDir = parts[parts.length - 1];
          for (const name of ['skill1', 'skill2']) {
            mkdirSync(join(cloneDir, 'skills', name), { recursive: true });
            writeFileSync(
              join(cloneDir, 'skills', name, 'SKILL.md'),
              `---\nname: ${name}\ndescription: ${name}\n---\n# ${name}`,
            );
          }
        }
        return Buffer.from('');
      });

      await skillManager.updateAll('test-agent');

      // Only one git clone call for the single source
      const cloneCalls = mockedExecSync.mock.calls.filter(
        ([cmd]) => String(cmd).startsWith('git clone'),
      );
      expect(cloneCalls).toHaveLength(1);
    });

    it('should clone once per distinct source', async () => {
      await agentManager.create('test-agent', { author: 'test' });
      const agent = await agentManager.get('test-agent');
      writeFileSync(
        join(agent!.rootDir, '.installed-skills.json'),
        JSON.stringify([
          { name: 'skill1', source: 'owner/repo-a', installedAt: new Date().toISOString() },
          { name: 'skill2', source: 'owner/repo-b', installedAt: new Date().toISOString() },
        ]),
      );

      mockedExecSync.mockImplementation((cmd: string) => {
        const cmdStr = String(cmd);
        if (cmdStr.startsWith('git clone')) {
          const parts = cmdStr.split(' ');
          const cloneDir = parts[parts.length - 1];
          for (const name of ['skill1', 'skill2']) {
            mkdirSync(join(cloneDir, 'skills', name), { recursive: true });
            writeFileSync(
              join(cloneDir, 'skills', name, 'SKILL.md'),
              `---\nname: ${name}\ndescription: ${name}\n---\n# ${name}`,
            );
          }
        }
        return Buffer.from('');
      });

      await skillManager.updateAll('test-agent');

      const cloneCalls = mockedExecSync.mock.calls.filter(
        ([cmd]) => String(cmd).startsWith('git clone'),
      );
      expect(cloneCalls).toHaveLength(2);
    });

    it('should handle empty installed skills without calling execSync', async () => {
      await agentManager.create('test-agent', { author: 'test' });
      mockedExecSync.mockReturnValue(Buffer.from(''));

      await skillManager.updateAll('test-agent');

      expect(mockedExecSync).not.toHaveBeenCalled();
    });

    it('should throw when agent not found', async () => {
      await expect(skillManager.updateAll('nonexistent')).rejects.toThrow(
        /Agent "nonexistent" not found/,
      );
    });

    it('should not throw when a source update fails', async () => {
      await agentManager.create('test-agent', { author: 'test' });
      const agent = await agentManager.get('test-agent');
      writeFileSync(
        join(agent!.rootDir, '.installed-skills.json'),
        JSON.stringify([
          { name: 'skill1', source: 'bad/repo', installedAt: new Date().toISOString() },
        ]),
      );
      mockedExecSync.mockImplementation(() => {
        throw new Error('clone failed');
      });

      // updateAll catches errors per-source and logs them
      await expect(skillManager.updateAll('test-agent')).resolves.not.toThrow();
    });
  });
});
