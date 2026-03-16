import { describe, it, expect } from 'vitest';
import {
  validateManifest,
  validateStatsJson,
  validateInstalledSkills,
} from '../../src/utils/validators.js';

describe('Manifest validation', () => {
  it('accepts a valid manifest', () => {
    const manifest = {
      name: 'sales-agent',
      version: '1.0.0',
      author: 'gabriel',
      templateOrigin: 'salesman',
      createdAt: '2026-03-14T00:00:00Z',
    };
    expect(validateManifest(manifest)).toEqual({ valid: true, errors: [] });
  });

  it('rejects manifest without name', () => {
    const manifest = { version: '1.0.0' };
    const result = validateManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('name is required');
  });
});

describe('Stats JSON validation', () => {
  it('accepts valid stats', () => {
    const stats = {
      agent: 'test-agent',
      elo: { sales: 1200 },
      dimensions: {},
      battles: { total: 0, record: { wins: 0, losses: 0, draws: 0 } },
      coachNotes: [],
    };
    expect(validateStatsJson(stats)).toEqual({ valid: true, errors: [] });
  });
});

describe('Installed skills validation', () => {
  it('accepts valid installed skills array', () => {
    const skills = [
      { name: 'test-skill', source: 'github:user/repo', installedAt: '2026-03-14T00:00:00Z' },
    ];
    expect(validateInstalledSkills(skills)).toEqual({ valid: true, errors: [] });
  });

  it('rejects non-array', () => {
    const result = validateInstalledSkills('not-an-array');
    expect(result.valid).toBe(false);
  });
});
