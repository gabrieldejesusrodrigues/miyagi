import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
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

  describe('install', () => {
    it('should call execSync with correct command and cwd', async () => {
      await agentManager.create('test-agent', { author: 'test' });
      mockedExecSync.mockReturnValue(Buffer.from(''));

      await skillManager.install('some-skill', 'test-agent');

      expect(mockedExecSync).toHaveBeenCalledWith(
        'npx skills add some-skill --copy',
        expect.objectContaining({ cwd: expect.stringContaining('skills') }),
      );
    });

    it('should pass stdio: inherit to execSync', async () => {
      await agentManager.create('test-agent', { author: 'test' });
      mockedExecSync.mockReturnValue(Buffer.from(''));

      await skillManager.install('some-skill', 'test-agent');

      expect(mockedExecSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ stdio: 'inherit' }),
      );
    });

    it('should use the agent skillsDir as cwd', async () => {
      await agentManager.create('test-agent', { author: 'test' });
      const agent = await agentManager.get('test-agent');
      mockedExecSync.mockReturnValue(Buffer.from(''));

      await skillManager.install('some-skill', 'test-agent');

      expect(mockedExecSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ cwd: agent!.skillsDir }),
      );
    });

    it('should throw when agent not found', async () => {
      await expect(skillManager.install('skill', 'nonexistent')).rejects.toThrow(
        /Agent "nonexistent" not found/,
      );
    });

    it('should not call execSync when agent not found', async () => {
      await expect(skillManager.install('skill', 'nonexistent')).rejects.toThrow();
      expect(mockedExecSync).not.toHaveBeenCalled();
    });

    it('should propagate execSync errors', async () => {
      await agentManager.create('test-agent', { author: 'test' });
      mockedExecSync.mockImplementation(() => {
        throw new Error('npx install failed');
      });

      await expect(skillManager.install('bad-skill', 'test-agent')).rejects.toThrow(
        'npx install failed',
      );
    });
  });

  describe('updateAll', () => {
    it('should call execSync for each installed skill', async () => {
      await agentManager.create('test-agent', { author: 'test' });
      const agent = await agentManager.get('test-agent');
      writeFileSync(
        join(agent!.rootDir, '.installed-skills.json'),
        JSON.stringify([
          { name: 'skill1', source: 'source1', installedAt: new Date().toISOString() },
          { name: 'skill2', source: 'source2', installedAt: new Date().toISOString() },
        ]),
      );
      mockedExecSync.mockReturnValue(Buffer.from(''));

      await skillManager.updateAll('test-agent');

      expect(mockedExecSync).toHaveBeenCalledTimes(2);
    });

    it('should call execSync with correct command for each skill', async () => {
      await agentManager.create('test-agent', { author: 'test' });
      const agent = await agentManager.get('test-agent');
      writeFileSync(
        join(agent!.rootDir, '.installed-skills.json'),
        JSON.stringify([
          { name: 'skill1', source: 'source1', installedAt: new Date().toISOString() },
        ]),
      );
      mockedExecSync.mockReturnValue(Buffer.from(''));

      await skillManager.updateAll('test-agent');

      expect(mockedExecSync).toHaveBeenCalledWith(
        'npx skills add source1 --copy --yes',
        expect.objectContaining({ cwd: agent!.skillsDir }),
      );
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

    it('should use --yes flag in update command', async () => {
      await agentManager.create('test-agent', { author: 'test' });
      const agent = await agentManager.get('test-agent');
      writeFileSync(
        join(agent!.rootDir, '.installed-skills.json'),
        JSON.stringify([
          { name: 'skill1', source: 'mysource', installedAt: new Date().toISOString() },
        ]),
      );
      mockedExecSync.mockReturnValue(Buffer.from(''));

      await skillManager.updateAll('test-agent');

      const [cmd] = mockedExecSync.mock.calls[0] as [string, ...unknown[]];
      expect(cmd).toContain('--yes');
    });

    it('should propagate execSync error on update failure', async () => {
      await agentManager.create('test-agent', { author: 'test' });
      const agent = await agentManager.get('test-agent');
      writeFileSync(
        join(agent!.rootDir, '.installed-skills.json'),
        JSON.stringify([
          { name: 'skill1', source: 'source1', installedAt: new Date().toISOString() },
        ]),
      );
      mockedExecSync.mockImplementation(() => {
        throw new Error('update failed');
      });

      await expect(skillManager.updateAll('test-agent')).rejects.toThrow('update failed');
    });
  });
});
