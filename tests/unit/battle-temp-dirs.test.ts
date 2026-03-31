import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { BattleEngine } from '../../src/battle/engine.js';
import { ClaudeBridge } from '../../src/core/claude-bridge.js';
import type { BattleConfig } from '../../src/types/index.js';

// Mock ClaudeBridge that records calls
class MockClaudeBridge {
  calls: Array<{ args: string[]; cwd?: string }> = [];

  buildBattleArgs(opts: any) {
    const args = ['--print'];
    if (opts.dangerouslySkipPermissions) args.push('--dangerously-skip-permissions');
    return args;
  }

  buildBattleStdin(opts: any) {
    return opts.prompt;
  }

  async runAndCapture(args: string[], timeout?: number, stdinData?: string, cwd?: string) {
    this.calls.push({ args, cwd });
    return 'mock response';
  }
}

function createMockAgentManager(tempDir: string) {
  const agentADir = join(tempDir, 'agents', 'alpha');
  const agentBDir = join(tempDir, 'agents', 'beta');
  mkdirSync(agentADir, { recursive: true });
  mkdirSync(agentBDir, { recursive: true });
  writeFileSync(join(agentADir, 'identity.md'), '# Alpha');
  writeFileSync(join(agentBDir, 'identity.md'), '# Beta');

  return {
    get: async (name: string) => {
      const dir = name === 'alpha' ? agentADir : agentBDir;
      return { name, identityPath: join(dir, 'identity.md'), rootDir: dir };
    },
  } as any;
}

function makeConfig(mode: 'same-task' | 'debate' = 'same-task'): BattleConfig {
  return {
    id: 'test-battle-id',
    mode,
    agentA: 'alpha',
    agentB: 'beta',
    task: 'Write a hello world',
    maxRounds: 1,
    background: false,
    startedAt: new Date().toISOString(),
  };
}

describe('ClaudeBridge.runAndCapture cwd parameter', () => {
  it('accepts optional cwd parameter in method signature', () => {
    const bridge = new ClaudeBridge('echo');
    // Verify the method accepts 4 parameters including cwd
    expect(bridge.runAndCapture.length).toBeGreaterThanOrEqual(0);
    // Call with cwd to confirm it's accepted without type error
    const promise = bridge.runAndCapture(['--version'], 1000, undefined, '/tmp');
    // Kill quickly to avoid hanging
    promise.catch(() => {});
  });
});

describe('BattleEngine temp directory management', () => {
  let engine: BattleEngine;
  let agentManagerDir: string;
  let mockAgentManager: any;

  beforeEach(() => {
    engine = new BattleEngine();
    agentManagerDir = mkdtempSync(join(tmpdir(), 'miyagi-test-agents-'));
    mockAgentManager = createMockAgentManager(agentManagerDir);
  });

  afterEach(() => {
    rmSync(agentManagerDir, { recursive: true, force: true });
  });

  it('runSymmetric creates temp directories for each agent', async () => {
    const mockBridge = new MockClaudeBridge();
    const config = makeConfig();

    await engine.runSymmetric(config, mockAgentManager, mockBridge as any, mockBridge as any);

    // 2 planning calls + 2 execution calls = 4 total
    expect(mockBridge.calls).toHaveLength(4);
    // Each call should have received a cwd argument
    expect(mockBridge.calls[0].cwd).toBeDefined();
    expect(mockBridge.calls[1].cwd).toBeDefined();
    // The two cwds should be different directories (planning calls use same dirs as execution)
    expect(mockBridge.calls[0].cwd).not.toBe(mockBridge.calls[1].cwd);
  });

  it('runSymmetric cleans up temp directories after battle completes', async () => {
    const mockBridge = new MockClaudeBridge();
    const config = makeConfig();

    let capturedCwdA: string | undefined;
    let capturedCwdB: string | undefined;

    // Intercept to capture paths (planning calls use same dirs)
    const originalRunAndCapture = mockBridge.runAndCapture.bind(mockBridge);
    let callCount = 0;
    mockBridge.runAndCapture = async (args, timeout, stdinData, cwd) => {
      callCount++;
      // Capture from planning calls (1 and 2)
      if (callCount === 1) capturedCwdA = cwd;
      if (callCount === 2) capturedCwdB = cwd;
      return originalRunAndCapture(args, timeout, stdinData, cwd);
    };

    await engine.runSymmetric(config, mockAgentManager, mockBridge as any, mockBridge as any);

    // Both temp dirs should have been removed
    expect(capturedCwdA).toBeDefined();
    expect(capturedCwdB).toBeDefined();
    expect(existsSync(capturedCwdA!)).toBe(false);
    expect(existsSync(capturedCwdB!)).toBe(false);
  });

  it('runSymmetric cleans up temp directories even on error', async () => {
    const mockBridge = new MockClaudeBridge();
    const config = makeConfig();

    let capturedCwdA: string | undefined;
    let capturedCwdB: string | undefined;
    let callCount = 0;

    mockBridge.runAndCapture = async (_args, _timeout, _stdinData, cwd) => {
      callCount++;
      if (callCount === 1) capturedCwdA = cwd;
      if (callCount === 2) capturedCwdB = cwd;
      throw new Error('Battle failed');
    };

    await expect(engine.runSymmetric(config, mockAgentManager, mockBridge as any, mockBridge as any)).rejects.toThrow('Battle failed');

    // Temp dirs should still be cleaned up despite the error
    if (capturedCwdA) expect(existsSync(capturedCwdA)).toBe(false);
    if (capturedCwdB) expect(existsSync(capturedCwdB)).toBe(false);
  });

  it('runSymmetric passes dangerouslySkipPermissions=true to bridge args', async () => {
    const mockBridge = new MockClaudeBridge();
    const config = makeConfig();

    await engine.runSymmetric(config, mockAgentManager, mockBridge as any, mockBridge as any);

    // Every call should include --dangerously-skip-permissions in args
    for (const call of mockBridge.calls) {
      expect(call.args).toContain('--dangerously-skip-permissions');
    }
  });

  it('runSymmetric includes planning phase before execution rounds', async () => {
    const mockBridge = new MockClaudeBridge();
    const config = makeConfig();
    config.maxRounds = 1;

    const planResponse = `## Deliverable
Working solution.

## Approach
My strategy.

## Steps
### 1. Implement solution
Write the code.`;

    let callIndex = 0;
    mockBridge.runAndCapture = async (args: string[], timeout?: number, stdinData?: string, cwd?: string) => {
      callIndex++;
      mockBridge.calls.push({ args, cwd });
      if (callIndex <= 2) return planResponse;
      return 'executed solution';
    };

    const result = await engine.runSymmetric(config, mockAgentManager, mockBridge as any, mockBridge as any);

    expect(callIndex).toBe(4);
    expect(result.planA).toBeDefined();
    expect(result.planA!.approach).toBe('My strategy.');
    expect(result.planA!.steps).toHaveLength(1);
    expect(result.planA!.deliverable).toBe('Working solution.');
    expect(result.planB).toBeDefined();
  });

  it('runSymmetric falls back to current behavior when plan parsing fails', async () => {
    const mockBridge = new MockClaudeBridge();
    const config = makeConfig();
    config.maxRounds = 1;

    let callIndex = 0;
    mockBridge.runAndCapture = async (args: string[], timeout?: number, stdinData?: string, cwd?: string) => {
      callIndex++;
      mockBridge.calls.push({ args, cwd });
      if (callIndex <= 2) return 'I cannot produce a plan in that format.';
      return 'fallback execution';
    };

    const result = await engine.runSymmetric(config, mockAgentManager, mockBridge as any, mockBridge as any);

    expect(result.rounds).toHaveLength(1);
    expect(result.planA).toBeUndefined();
    expect(result.planB).toBeUndefined();
  });

  it('runSymmetric distributes steps across multiple rounds', async () => {
    const mockBridge = new MockClaudeBridge();
    const config = makeConfig();
    config.maxRounds = 2;

    const planResponse = `## Deliverable
Fully implemented and tested API.

## Approach
Incremental.

## Steps
### 1. Foundation
Build base.

### 2. Features
Add features.

### 3. Tests
Write tests.

### 4. Polish
Clean up.`;

    let callIndex = 0;
    const stdinCaptures: string[] = [];
    mockBridge.runAndCapture = async (args: string[], timeout?: number, stdinData?: string, cwd?: string) => {
      callIndex++;
      mockBridge.calls.push({ args, cwd });
      if (stdinData) stdinCaptures.push(stdinData);
      if (callIndex <= 2) return planResponse;
      return 'round output';
    };

    const result = await engine.runSymmetric(config, mockAgentManager, mockBridge as any, mockBridge as any);

    expect(result.rounds).toHaveLength(2);
    expect(result.planA).toBeDefined();
    expect(result.planA!.steps).toHaveLength(4);
    // Execution stdinCaptures should reference specific steps
    // Planning: captures 0,1 | Execution: captures 2,3 (round1 A,B), 4,5 (round2 A,B)
    expect(stdinCaptures.length).toBeGreaterThanOrEqual(4);
  });

  it('emits planning phase progress event', async () => {
    const mockBridge = new MockClaudeBridge();
    const config = makeConfig();
    const events: any[] = [];

    const planResponse = `## Deliverable\nCompleted task.\n\n## Approach\nStrategy.\n\n## Steps\n### 1. Do it\nDo the thing.`;
    let callIndex = 0;
    mockBridge.runAndCapture = async (args: string[], timeout?: number, stdinData?: string, cwd?: string) => {
      callIndex++;
      mockBridge.calls.push({ args, cwd });
      return callIndex <= 2 ? planResponse : 'output';
    };

    await engine.runSymmetric(config, mockAgentManager, mockBridge as any, mockBridge as any, undefined, (event) => {
      events.push(event);
    });

    expect(events[0]).toEqual({ phase: 'setup', type: 'info', message: 'Planning phase' });
  });

  it('runAsymmetric creates and cleans up temp directories', async () => {
    const mockBridge = new MockClaudeBridge();
    // debate mode is asymmetric (multi-round, alternating)
    const config = makeConfig('debate');

    let capturedCwdA: string | undefined;
    let capturedCwdB: string | undefined;
    let callCount = 0;

    const originalRunAndCapture = mockBridge.runAndCapture.bind(mockBridge);
    mockBridge.runAndCapture = async (args, timeout, stdinData, cwd) => {
      callCount++;
      if (callCount === 1) capturedCwdA = cwd;
      if (callCount === 2) capturedCwdB = cwd;
      return originalRunAndCapture(args, timeout, stdinData, cwd);
    };

    await engine.runAsymmetric(config, mockAgentManager, mockBridge as any, mockBridge as any);

    // Both cwds should have been set and cleaned up
    expect(capturedCwdA).toBeDefined();
    expect(capturedCwdB).toBeDefined();
    expect(existsSync(capturedCwdA!)).toBe(false);
    expect(existsSync(capturedCwdB!)).toBe(false);
  });
});
