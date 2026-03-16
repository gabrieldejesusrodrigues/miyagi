import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigManager } from '../../src/core/config.js';
import { AgentManager } from '../../src/core/agent-manager.js';
import { SkillManager } from '../../src/core/skill-manager.js';
import { SessionManager } from '../../src/core/session-manager.js';
import { TemplateLoader } from '../../src/core/template-loader.js';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ConfigManager edge cases', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'miyagi-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('throws on corrupted config.json', () => {
    const config = new ConfigManager(tempDir);
    config.ensureDirectories();
    writeFileSync(join(tempDir, 'config.json'), '{invalid json');
    expect(() => config.load()).toThrow();
  });
});

describe('AgentManager edge cases', () => {
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

  it('throws when deleting non-existent agent', async () => {
    await expect(agentManager.delete('nonexistent'))
      .rejects.toThrow('Agent "nonexistent" not found');
  });

  it('throws when cloning non-existent source', async () => {
    await expect(agentManager.clone('nonexistent', 'target'))
      .rejects.toThrow('Agent "nonexistent" not found');
  });

  it('throws when cloning to existing target', async () => {
    await agentManager.create('source', { author: 'test' });
    await agentManager.create('target', { author: 'test' });
    await expect(agentManager.clone('source', 'target'))
      .rejects.toThrow('Agent "target" already exists');
  });
});

describe('SkillManager edge cases', () => {
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

  it('throws when listing skills for non-existent agent', async () => {
    await expect(skillManager.list('nonexistent'))
      .rejects.toThrow('Agent "nonexistent" not found');
  });

  it('throws when removing non-existent skill', async () => {
    await expect(skillManager.remove('nonexistent-skill', 'test-agent'))
      .rejects.toThrow('Skill "nonexistent-skill" not found');
  });

  it('parses SKILL.md without frontmatter gracefully', async () => {
    const agent = await agentManager.get('test-agent');
    const skillDir = join(agent!.skillsDir, 'no-frontmatter');
    mkdirSync(skillDir);
    writeFileSync(join(skillDir, 'SKILL.md'), '# Just a heading\nNo frontmatter here');

    const skills = await skillManager.list('test-agent');
    expect(skills.length).toBe(1);
    expect(skills[0].metadata.name).toBe('unknown');
  });

  it('skips directories without SKILL.md', async () => {
    const agent = await agentManager.get('test-agent');
    mkdirSync(join(agent!.skillsDir, 'empty-dir'));

    const skills = await skillManager.list('test-agent');
    expect(skills).toEqual([]);
  });
});

describe('SessionManager edge cases', () => {
  let tempDir: string;
  let sessionManager: SessionManager;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'miyagi-test-'));
    sessionManager = new SessionManager(tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('endSession sets endedAt timestamp', () => {
    const entry = sessionManager.record('agent-a', 'session-1');
    sessionManager.endSession(entry.id);
    const sessions = sessionManager.listForAgent('agent-a');
    expect(sessions[0].endedAt).toBeTruthy();
  });

  it('endSession with non-existent id does nothing', () => {
    sessionManager.record('agent-a', 'session-1');
    sessionManager.endSession('nonexistent-id');
    const sessions = sessionManager.listForAgent('agent-a');
    expect(sessions[0].endedAt).toBeUndefined();
  });
});

describe('TemplateLoader', () => {
  let loader: TemplateLoader;

  beforeEach(() => {
    loader = new TemplateLoader();
  });

  it('getTemplate returns template data for existing template', () => {
    const result = loader.getTemplate('salesman');
    expect(result).not.toBeNull();
    expect(result!.manifest.name).toBe('salesman');
    expect(result!.identityContent).toContain('Salesman');
  });

  it('getTemplate returns null for non-existent template', () => {
    const result = loader.getTemplate('nonexistent');
    expect(result).toBeNull();
  });

  it('list returns all 5 built-in templates', () => {
    const templates = loader.list();
    expect(templates.length).toBe(5);
    const names = templates.map(t => t.name);
    expect(names).toContain('salesman');
    expect(names).toContain('developer');
    expect(names).toContain('business-analyst');
    expect(names).toContain('writer');
    expect(names).toContain('support-rep');
  });

  it('list returns empty for non-existent directory', () => {
    const loader = new TemplateLoader('/tmp/nonexistent-dir');
    const templates = loader.list();
    expect(templates).toEqual([]);
  });

  it('applyTemplate throws for non-existent template', () => {
    expect(() => loader.applyTemplate('nonexistent', '/tmp')).toThrow('Template "nonexistent" not found');
  });

  it('applyTemplate copies identity.md to agent dir', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'miyagi-test-'));
    mkdirSync(join(tempDir, 'context'), { recursive: true });
    loader.applyTemplate('developer', tempDir);
    const identity = readFileSync(join(tempDir, 'identity.md'), 'utf-8');
    expect(identity).toContain('Developer');
    rmSync(tempDir, { recursive: true, force: true });
  });
});
