import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AgentManager } from '../../src/core/agent-manager.js';
import { ConfigManager } from '../../src/core/config.js';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('AgentManager', () => {
  let tempDir: string;
  let agentManager: AgentManager;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'miyagi-test-'));
    const config = new ConfigManager(tempDir);
    config.ensureDirectories();
    agentManager = new AgentManager(config);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates an agent with correct directory structure', async () => {
    await agentManager.create('test-agent', {
      author: 'test',
      description: 'A test agent',
    });
    const agentDir = join(tempDir, 'agents', 'test-agent');
    expect(existsSync(join(agentDir, 'manifest.json'))).toBe(true);
    expect(existsSync(join(agentDir, 'identity.md'))).toBe(true);
    expect(existsSync(join(agentDir, 'context'))).toBe(true);
    expect(existsSync(join(agentDir, 'skills'))).toBe(true);
    expect(existsSync(join(agentDir, 'history'))).toBe(true);
  });

  it('creates default stats.json on agent creation', async () => {
    await agentManager.create('test-agent', { author: 'test' });
    const statsPath = join(tempDir, 'agents', 'test-agent', 'history', 'stats.json');
    const stats = JSON.parse(readFileSync(statsPath, 'utf-8'));
    expect(stats.agent).toBe('test-agent');
    expect(stats.elo).toEqual({});
    expect(stats.battles.total).toBe(0);
  });

  it('lists agents', async () => {
    await agentManager.create('agent-a', { author: 'test' });
    await agentManager.create('agent-b', { author: 'test' });
    const agents = await agentManager.list();
    expect(agents.map(a => a.name).sort()).toEqual(['agent-a', 'agent-b']);
  });

  it('gets an agent by name', async () => {
    await agentManager.create('my-agent', { author: 'test', description: 'hello' });
    const agent = await agentManager.get('my-agent');
    expect(agent).not.toBeNull();
    expect(agent!.manifest.name).toBe('my-agent');
  });

  it('returns null for non-existent agent', async () => {
    const agent = await agentManager.get('nonexistent');
    expect(agent).toBeNull();
  });

  it('deletes an agent', async () => {
    await agentManager.create('doomed-agent', { author: 'test' });
    await agentManager.delete('doomed-agent');
    const agent = await agentManager.get('doomed-agent');
    expect(agent).toBeNull();
  });

  it('clones an agent', async () => {
    await agentManager.create('original', { author: 'test' });
    await agentManager.clone('original', 'cloned');
    const cloned = await agentManager.get('cloned');
    expect(cloned).not.toBeNull();
    expect(cloned!.manifest.name).toBe('cloned');
  });

  it('throws when creating duplicate agent', async () => {
    await agentManager.create('dupe', { author: 'test' });
    await expect(agentManager.create('dupe', { author: 'test' }))
      .rejects.toThrow('Agent "dupe" already exists');
  });
});
