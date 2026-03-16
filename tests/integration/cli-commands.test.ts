import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ConfigManager } from '../../src/core/config.js';
import { AgentManager } from '../../src/core/agent-manager.js';
import { SkillManager } from '../../src/core/skill-manager.js';
import { SessionManager } from '../../src/core/session-manager.js';
import { HistoryManager } from '../../src/training/history.js';
import { TemplateLoader } from '../../src/core/template-loader.js';

describe('CLI Command Integration', () => {
  let tmpDir: string;
  let config: ConfigManager;
  let agentManager: AgentManager;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'miyagi-cli-test-'));
    config = new ConfigManager(tmpDir);
    config.ensureDirectories();
    agentManager = new AgentManager(config);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('agent create/list/delete flow', () => {
    it('should create an agent and list it', async () => {
      await agentManager.create('test-dev', { author: 'tester', templateOrigin: 'developer' });
      const agents = await agentManager.list();
      expect(agents).toHaveLength(1);
      expect(agents[0].name).toBe('test-dev');
    });

    it('should delete an agent', async () => {
      await agentManager.create('to-delete', { author: 'tester' });
      await agentManager.delete('to-delete');
      const agents = await agentManager.list();
      expect(agents).toHaveLength(0);
    });

    it('should error on duplicate create', async () => {
      await agentManager.create('dup', { author: 'tester' });
      await expect(agentManager.create('dup', { author: 'tester' })).rejects.toThrow('already exists');
    });

    it('should error on delete nonexistent', async () => {
      await expect(agentManager.delete('nope')).rejects.toThrow('not found');
    });

    it('should clone an agent', async () => {
      await agentManager.create('original', { author: 'tester' });
      await agentManager.clone('original', 'copy');
      const agents = await agentManager.list();
      expect(agents).toHaveLength(2);
      expect(agents.map(a => a.name).sort()).toEqual(['copy', 'original']);
    });
  });

  describe('stats flow', () => {
    it('should return default stats for new agent', async () => {
      await agentManager.create('new-agent', { author: 'tester' });
      const history = new HistoryManager(agentManager);
      const stats = await history.getStats('new-agent');
      expect(stats.battles.total).toBe(0);
      expect(stats.agent).toBe('new-agent');
    });

    it('should error for nonexistent agent', async () => {
      const history = new HistoryManager(agentManager);
      await expect(history.getStats('nope')).rejects.toThrow('not found');
    });
  });

  describe('sessions flow', () => {
    it('should record and list sessions', () => {
      const sessionManager = new SessionManager(tmpDir);
      const entry = sessionManager.record('agent-1', 'session-abc');
      expect(entry.agent).toBe('agent-1');

      const sessions = sessionManager.listForAgent('agent-1');
      expect(sessions).toHaveLength(1);
      expect(sessions[0].claudeSessionId).toBe('session-abc');
    });

    it('should end a session', () => {
      const sessionManager = new SessionManager(tmpDir);
      const entry = sessionManager.record('agent-1', 'session-abc');
      sessionManager.endSession(entry.id);

      const sessions = sessionManager.listForAgent('agent-1');
      expect(sessions[0].endedAt).toBeDefined();
    });

    it('should return empty for unknown agent', () => {
      const sessionManager = new SessionManager(tmpDir);
      expect(sessionManager.listForAgent('unknown')).toHaveLength(0);
    });
  });

  describe('templates flow', () => {
    it('should list built-in templates', () => {
      const loader = new TemplateLoader();
      const templates = loader.list();
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.map(t => t.name)).toContain('developer');
    });
  });

  describe('skills flow', () => {
    it('should list empty skills for new agent', async () => {
      await agentManager.create('skilled', { author: 'test' });
      const skillManager = new SkillManager(agentManager);
      const skills = await skillManager.list('skilled');
      expect(skills).toHaveLength(0);
    });

    it('should error listing skills for nonexistent agent', async () => {
      const skillManager = new SkillManager(agentManager);
      await expect(skillManager.list('nope')).rejects.toThrow('not found');
    });
  });
});
