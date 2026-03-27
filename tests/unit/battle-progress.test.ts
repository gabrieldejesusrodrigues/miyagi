import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { BattleEngine } from '../../src/battle/engine.js';
import type { BattleProgressEvent } from '../../src/types/index.js';

describe('BattleEngine progress callbacks', () => {
  let engine: BattleEngine;
  let tempDir: string;
  let identityPath: string;

  beforeEach(() => {
    engine = new BattleEngine();
    tempDir = mkdtempSync(join(tmpdir(), 'miyagi-test-'));
    identityPath = join(tempDir, 'identity.md');
    writeFileSync(identityPath, 'You are a test agent.');
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  const mockAgentManager = () => ({
    get: vi.fn().mockResolvedValue({
      identityPath: '',
      manifest: { name: 'test', version: '1.0.0', description: 'test', domains: [] },
    }),
  }) as any;

  const mockBridge = () => ({
    runAndCapture: vi.fn().mockResolvedValue('mock response'),
    buildBattleArgs: vi.fn().mockReturnValue([]),
    buildBattleStdin: vi.fn().mockReturnValue(''),
  }) as any;

  it('runSymmetric accepts and calls onProgress with correct events', async () => {
    const agentManager = mockAgentManager();
    agentManager.get.mockResolvedValue({
      identityPath,
      manifest: { name: 'test', version: '1.0.0', description: 'test', domains: [] },
    });
    const bridge = mockBridge();

    const config = engine.createConfig({
      agentA: 'agent-a',
      agentB: 'agent-b',
      mode: 'same-task',
      task: 'Test task',
      maxRounds: 1,
    });

    const events: BattleProgressEvent[] = [];
    const onProgress = (event: BattleProgressEvent) => { events.push(event); };

    await engine.runSymmetric(config, agentManager, bridge, undefined, onProgress);

    // planning phase event first
    expect(events[0]).toMatchObject({ phase: 'setup', type: 'info', message: 'Planning phase' });

    // round/start event after planning
    const roundStartEvents = events.filter(e => e.phase === 'round' && e.type === 'start');
    expect(roundStartEvents).toHaveLength(1);
    expect(roundStartEvents[0]).toMatchObject({ phase: 'round', type: 'start', round: 1, totalRounds: 1 });

    // info events for both agents during execution rounds
    const infoEvents = events.filter(e => e.type === 'info' && e.phase === 'round');
    expect(infoEvents).toHaveLength(2);
    expect(infoEvents.some(e => e.agent === 'agent-a')).toBe(true);
    expect(infoEvents.some(e => e.agent === 'agent-b')).toBe(true);
    infoEvents.forEach(e => expect(e).toMatchObject({ phase: 'round', round: 1 }));

    // complete events for both agents with elapsedMs
    const completeEvents = events.filter(e => e.type === 'complete');
    expect(completeEvents).toHaveLength(2);
    expect(completeEvents.some(e => e.agent === 'agent-a')).toBe(true);
    expect(completeEvents.some(e => e.agent === 'agent-b')).toBe(true);
    completeEvents.forEach(e => {
      expect(e).toMatchObject({ phase: 'round', round: 1 });
      expect(typeof e.elapsedMs).toBe('number');
    });
  });

  it('runAsymmetric accepts and calls onProgress with correct sequential events', async () => {
    const agentManager = mockAgentManager();
    agentManager.get.mockResolvedValue({
      identityPath,
      manifest: { name: 'test', version: '1.0.0', description: 'test', domains: [] },
    });
    const bridge = mockBridge();

    const config = engine.createConfig({
      agentA: 'agent-a',
      agentB: 'agent-b',
      mode: 'debate',
      topic: 'Test topic',
      maxRounds: 1,
    });

    const events: BattleProgressEvent[] = [];
    const onProgress = (event: BattleProgressEvent) => { events.push(event); };

    await engine.runAsymmetric(config, agentManager, bridge, undefined, onProgress);

    // round/start first
    expect(events[0]).toMatchObject({ phase: 'round', type: 'start', round: 1, totalRounds: 1 });

    // Sequential: agent-a info -> agent-a complete -> agent-b info -> agent-b complete
    const infoA = events.find(e => e.type === 'info' && e.agent === 'agent-a');
    const completeA = events.find(e => e.type === 'complete' && e.agent === 'agent-a');
    const infoB = events.find(e => e.type === 'info' && e.agent === 'agent-b');
    const completeB = events.find(e => e.type === 'complete' && e.agent === 'agent-b');

    expect(infoA).toMatchObject({ phase: 'round', round: 1 });
    expect(completeA).toMatchObject({ phase: 'round', round: 1 });
    expect(infoB).toMatchObject({ phase: 'round', round: 1 });
    expect(completeB).toMatchObject({ phase: 'round', round: 1 });
    expect(typeof completeA!.elapsedMs).toBe('number');
    expect(typeof completeB!.elapsedMs).toBe('number');

    // Verify sequential ordering
    const idxInfoA = events.indexOf(infoA!);
    const idxCompleteA = events.indexOf(completeA!);
    const idxInfoB = events.indexOf(infoB!);
    const idxCompleteB = events.indexOf(completeB!);
    expect(idxInfoA).toBeLessThan(idxCompleteA);
    expect(idxCompleteA).toBeLessThan(idxInfoB);
    expect(idxInfoB).toBeLessThan(idxCompleteB);
  });

  it('runSymmetric works without onProgress (no crash)', async () => {
    const agentManager = mockAgentManager();
    agentManager.get.mockResolvedValue({
      identityPath,
      manifest: { name: 'test', version: '1.0.0', description: 'test', domains: [] },
    });
    const bridge = mockBridge();

    const config = engine.createConfig({
      agentA: 'agent-a',
      agentB: 'agent-b',
      mode: 'same-task',
      task: 'Test task',
      maxRounds: 1,
    });

    await expect(engine.runSymmetric(config, agentManager, bridge)).resolves.toBeDefined();
  });

  it('runAsymmetric works without onProgress (no crash)', async () => {
    const agentManager = mockAgentManager();
    agentManager.get.mockResolvedValue({
      identityPath,
      manifest: { name: 'test', version: '1.0.0', description: 'test', domains: [] },
    });
    const bridge = mockBridge();

    const config = engine.createConfig({
      agentA: 'agent-a',
      agentB: 'agent-b',
      mode: 'debate',
      topic: 'Test topic',
      maxRounds: 1,
    });

    await expect(engine.runAsymmetric(config, agentManager, bridge)).resolves.toBeDefined();
  });

  it('runSymmetric fires progress events for each round in multi-round battle', async () => {
    const agentManager = mockAgentManager();
    agentManager.get.mockResolvedValue({
      identityPath,
      manifest: { name: 'test', version: '1.0.0', description: 'test', domains: [] },
    });
    const bridge = mockBridge();

    const config = engine.createConfig({
      agentA: 'agent-a',
      agentB: 'agent-b',
      mode: 'same-task',
      task: 'Test task',
      maxRounds: 3,
    });

    const events: BattleProgressEvent[] = [];
    const onProgress = (event: BattleProgressEvent) => { events.push(event); };

    await engine.runSymmetric(config, agentManager, bridge, undefined, onProgress);

    const startEvents = events.filter(e => e.type === 'start');
    expect(startEvents).toHaveLength(3);
    expect(startEvents.map(e => e.round)).toEqual([1, 2, 3]);
    startEvents.forEach(e => expect(e.totalRounds).toBe(3));
  });
});
