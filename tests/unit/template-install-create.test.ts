import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { TemplateLoader } from '../../src/core/template-loader.js';

// Helper to create a minimal valid template source directory
function makeTemplateSource(dir: string, name: string, extra?: Record<string, unknown>): void {
  const manifest = { name, version: '1.0.0', description: 'A test template', ...extra };
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  writeFileSync(join(dir, 'identity.md'), `# ${name}\n\nTemplate identity.`);
}

// Helper to create a minimal valid agent directory
function makeAgentDir(dir: string, name: string): void {
  const manifest = { name, version: '1.0.0', author: 'test', description: 'A test agent' };
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  writeFileSync(join(dir, 'identity.md'), `# ${name}\n\nAgent identity.`);
}

describe('TemplateLoader.install()', () => {
  let tempDir: string;
  let userTemplatesDir: string;
  let sourceDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'miyagi-test-'));
    userTemplatesDir = join(tempDir, 'templates');
    sourceDir = join(tempDir, 'source');
    mkdirSync(userTemplatesDir, { recursive: true });
    mkdirSync(sourceDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('installs a template from a valid source directory', () => {
    makeTemplateSource(sourceDir, 'my-template');
    const loader = new TemplateLoader(undefined, userTemplatesDir);
    const name = loader.install(sourceDir, userTemplatesDir);
    expect(name).toBe('my-template');
    expect(existsSync(join(userTemplatesDir, 'my-template', 'manifest.json'))).toBe(true);
    expect(existsSync(join(userTemplatesDir, 'my-template', 'identity.md'))).toBe(true);
  });

  it('throws if source directory does not exist', () => {
    const loader = new TemplateLoader(undefined, userTemplatesDir);
    expect(() => loader.install('/nonexistent/path', userTemplatesDir))
      .toThrow('Source directory does not exist');
  });

  it('throws if source has no manifest.json', () => {
    writeFileSync(join(sourceDir, 'identity.md'), '# no manifest');
    const loader = new TemplateLoader(undefined, userTemplatesDir);
    expect(() => loader.install(sourceDir, userTemplatesDir))
      .toThrow('manifest.json');
  });

  it('throws if manifest.json is invalid (missing name)', () => {
    writeFileSync(join(sourceDir, 'manifest.json'), JSON.stringify({ version: '1.0.0' }));
    const loader = new TemplateLoader(undefined, userTemplatesDir);
    expect(() => loader.install(sourceDir, userTemplatesDir))
      .toThrow('Invalid manifest');
  });

  it('throws if template already exists (no force)', () => {
    makeTemplateSource(sourceDir, 'existing');
    mkdirSync(join(userTemplatesDir, 'existing'), { recursive: true });
    writeFileSync(join(userTemplatesDir, 'existing', 'manifest.json'), '{}');
    const loader = new TemplateLoader(undefined, userTemplatesDir);
    expect(() => loader.install(sourceDir, userTemplatesDir))
      .toThrow('already exists');
  });

  it('overwrites existing template when force=true', () => {
    makeTemplateSource(sourceDir, 'existing');
    mkdirSync(join(userTemplatesDir, 'existing'), { recursive: true });
    writeFileSync(join(userTemplatesDir, 'existing', 'manifest.json'), '{}');
    const loader = new TemplateLoader(undefined, userTemplatesDir);
    const name = loader.install(sourceDir, userTemplatesDir, true);
    expect(name).toBe('existing');
    const installed = JSON.parse(readFileSync(join(userTemplatesDir, 'existing', 'manifest.json'), 'utf-8'));
    expect(installed.version).toBe('1.0.0');
  });

  it('installed template appears in list()', () => {
    makeTemplateSource(sourceDir, 'listed-template');
    const loader = new TemplateLoader(undefined, userTemplatesDir);
    loader.install(sourceDir, userTemplatesDir);
    const templates = loader.list();
    const names = templates.map(t => t.name);
    expect(names).toContain('listed-template');
  });
});

describe('TemplateLoader.createFromAgent()', () => {
  let tempDir: string;
  let userTemplatesDir: string;
  let agentDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'miyagi-test-'));
    userTemplatesDir = join(tempDir, 'templates');
    agentDir = join(tempDir, 'agent');
    mkdirSync(userTemplatesDir, { recursive: true });
    mkdirSync(agentDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates a template from an agent directory', () => {
    makeAgentDir(agentDir, 'my-agent');
    const loader = new TemplateLoader(undefined, userTemplatesDir);
    loader.createFromAgent('new-template', agentDir, userTemplatesDir);
    expect(existsSync(join(userTemplatesDir, 'new-template'))).toBe(true);
    expect(existsSync(join(userTemplatesDir, 'new-template', 'manifest.json'))).toBe(true);
  });

  it('copies identity.md from agent', () => {
    makeAgentDir(agentDir, 'my-agent');
    const loader = new TemplateLoader(undefined, userTemplatesDir);
    loader.createFromAgent('new-template', agentDir, userTemplatesDir);
    expect(existsSync(join(userTemplatesDir, 'new-template', 'identity.md'))).toBe(true);
    const content = readFileSync(join(userTemplatesDir, 'new-template', 'identity.md'), 'utf-8');
    expect(content).toContain('my-agent');
  });

  it('copies context files from agent if context dir exists', () => {
    makeAgentDir(agentDir, 'my-agent');
    mkdirSync(join(agentDir, 'context'), { recursive: true });
    writeFileSync(join(agentDir, 'context', 'notes.md'), '# Context notes');
    const loader = new TemplateLoader(undefined, userTemplatesDir);
    loader.createFromAgent('new-template', agentDir, userTemplatesDir);
    expect(existsSync(join(userTemplatesDir, 'new-template', 'context', 'notes.md'))).toBe(true);
  });

  it('updates manifest name to template name', () => {
    makeAgentDir(agentDir, 'my-agent');
    const loader = new TemplateLoader(undefined, userTemplatesDir);
    loader.createFromAgent('new-template', agentDir, userTemplatesDir);
    const manifest = JSON.parse(
      readFileSync(join(userTemplatesDir, 'new-template', 'manifest.json'), 'utf-8'),
    );
    expect(manifest.name).toBe('new-template');
  });

  it('throws if template name already exists', () => {
    makeAgentDir(agentDir, 'my-agent');
    mkdirSync(join(userTemplatesDir, 'new-template'), { recursive: true });
    const loader = new TemplateLoader(undefined, userTemplatesDir);
    expect(() => loader.createFromAgent('new-template', agentDir, userTemplatesDir))
      .toThrow('already exists');
  });
});

describe('TemplateLoader.delete()', () => {
  let tempDir: string;
  let userTemplatesDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'miyagi-test-'));
    userTemplatesDir = join(tempDir, 'templates');
    mkdirSync(userTemplatesDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('deletes an installed user template', () => {
    const templateDir = join(userTemplatesDir, 'to-delete');
    mkdirSync(templateDir, { recursive: true });
    writeFileSync(join(templateDir, 'manifest.json'), JSON.stringify({ name: 'to-delete', version: '1.0.0' }));
    writeFileSync(join(templateDir, 'identity.md'), '# To Delete');

    const loader = new TemplateLoader(undefined, userTemplatesDir);
    loader.delete('to-delete', userTemplatesDir);
    expect(existsSync(templateDir)).toBe(false);
  });

  it('throws if template does not exist', () => {
    const loader = new TemplateLoader(undefined, userTemplatesDir);
    expect(() => loader.delete('nonexistent', userTemplatesDir))
      .toThrow('not found');
  });

  it('deleted template no longer appears in list()', () => {
    const templateDir = join(userTemplatesDir, 'listed');
    mkdirSync(templateDir, { recursive: true });
    writeFileSync(join(templateDir, 'manifest.json'), JSON.stringify({ name: 'listed', version: '1.0.0' }));

    const loader = new TemplateLoader(undefined, userTemplatesDir);
    expect(loader.list().map(t => t.name)).toContain('listed');
    loader.delete('listed', userTemplatesDir);
    expect(loader.list().map(t => t.name)).not.toContain('listed');
  });
});
