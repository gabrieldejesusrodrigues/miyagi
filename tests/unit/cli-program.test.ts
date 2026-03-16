import { describe, it, expect } from 'vitest';
import { createProgram } from '../../src/cli/program.js';

describe('CLI Program', () => {
  it('creates a program with correct name', () => {
    const program = createProgram();
    expect(program.name()).toBe('miyagi');
  });

  it('has all top-level commands registered', () => {
    const program = createProgram();
    const commandNames = program.commands.map(c => c.name());
    expect(commandNames).toContain('create');
    expect(commandNames).toContain('edit');
    expect(commandNames).toContain('delete');
    expect(commandNames).toContain('clone');
    expect(commandNames).toContain('list');
    expect(commandNames).toContain('use');
    expect(commandNames).toContain('battle');
    expect(commandNames).toContain('train');
    expect(commandNames).toContain('stats');
    expect(commandNames).toContain('export');
    expect(commandNames).toContain('import');
    expect(commandNames).toContain('templates');
    expect(commandNames).toContain('report');
    expect(commandNames).toContain('sessions');
    expect(commandNames).toContain('install');
    expect(commandNames).toContain('update');
  });
});
