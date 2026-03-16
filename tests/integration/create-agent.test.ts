import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AgentManager } from '../../src/core/agent-manager.js';
import { ConfigManager } from '../../src/core/config.js';
import { TemplateLoader } from '../../src/core/template-loader.js';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Interactive agent creation', () => {
  let tempDir: string;
  let agentManager: AgentManager;
  let templateLoader: TemplateLoader;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'miyagi-test-'));
    const config = new ConfigManager(tempDir);
    config.ensureDirectories();
    agentManager = new AgentManager(config);
    templateLoader = new TemplateLoader();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('lists available templates', () => {
    const templates = templateLoader.list();
    expect(templates.length).toBeGreaterThan(0);
    expect(templates.map(t => t.name)).toContain('salesman');
    expect(templates.map(t => t.name)).toContain('developer');
  });

  it('creates agent from template', async () => {
    const agent = await agentManager.create('my-sales-agent', {
      author: 'test',
      templateOrigin: 'salesman',
    });

    // Apply template
    templateLoader.applyTemplate('salesman', agent.rootDir);

    const identity = readFileSync(agent.identityPath, 'utf-8');
    expect(identity).toContain('Salesman');
  });

  it('creates agent without template', async () => {
    const agent = await agentManager.create('blank-agent', {
      author: 'test',
      description: 'A blank agent',
    });

    expect(existsSync(agent.identityPath)).toBe(true);
    const identity = readFileSync(agent.identityPath, 'utf-8');
    expect(identity).toContain('blank-agent');
  });
});
