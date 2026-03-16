import { describe, it, expect } from 'vitest';
import { BATTLE_MODES, getModeConfig, listModes } from '../../src/battle/modes/index.js';

describe('Battle modes registry', () => {
  it('has all 10 modes registered', () => {
    expect(Object.keys(BATTLE_MODES).length).toBe(10);
  });

  it('each mode has required fields', () => {
    for (const [name, config] of Object.entries(BATTLE_MODES)) {
      expect(config.name).toBe(name);
      expect(config.type).toMatch(/^(symmetric|asymmetric)$/);
      expect(config.description).toBeTruthy();
      expect(config.defaultRounds).toBeGreaterThan(0);
    }
  });

  it('asymmetric modes have roles defined', () => {
    const asymmetric = Object.values(BATTLE_MODES).filter(m => m.type === 'asymmetric');
    expect(asymmetric.length).toBeGreaterThan(0);
    for (const mode of asymmetric) {
      expect(mode.roles).toBeDefined();
      expect(mode.roles!.agentA).toBeTruthy();
      expect(mode.roles!.agentB).toBeTruthy();
    }
  });

  it('getModeConfig returns correct config', () => {
    const config = getModeConfig('debate');
    expect(config.name).toBe('debate');
    expect(config.type).toBe('asymmetric');
  });

  it('getModeConfig throws for unknown mode', () => {
    expect(() => getModeConfig('nonexistent' as any)).toThrow();
  });

  it('listModes returns all modes', () => {
    const modes = listModes();
    expect(modes.length).toBe(10);
  });
});
