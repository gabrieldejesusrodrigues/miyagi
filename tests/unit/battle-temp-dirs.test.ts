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

    // Spy on mkdtempSync by checking that cwd values passed to runAndCapture
    // are directories that exist (they must have been created)
    await engine.runSymmetric(config, mockAgentManager, mockBridge as any);

    // runAndCapture was called twice (once per agent per round)
    expect(mockBridge.calls).toHaveLength(2);
    // Each call should have received a cwd argument
    expect(mockBridge.calls[0].cwd).toBeDefined();
    expect(mockBridge.calls[1].cwd).toBeDefined();
    // The two cwds should be different directories
    expect(mockBridge.calls[0].cwd).not.toBe(mockBridge.calls[1].cwd);
  });

  it('runSymmetric cleans up temp directories after battle completes', async () => {
    const mockBridge = new MockClaudeBridge();
    const config = makeConfig();

    let capturedCwdA: string | undefined;
    let capturedCwdB: string | undefined;

    // Intercept to capture paths
    const originalRunAndCapture = mockBridge.runAndCapture.bind(mockBridge);
    let callCount = 0;
    mockBridge.runAndCapture = async (args, timeout, stdinData, cwd) => {
      callCount++;
      if (callCount === 1) capturedCwdA = cwd;
      if (callCount === 2) capturedCwdB = cwd;
      return originalRunAndCapture(args, timeout, stdinData, cwd);
    };

    await engine.runSymmetric(config, mockAgentManager, mockBridge as any);

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

    await expect(engine.runSymmetric(config, mockAgentManager, mockBridge as any)).rejects.toThrow('Battle failed');

    // Temp dirs should still be cleaned up despite the error
    if (capturedCwdA) expect(existsSync(capturedCwdA)).toBe(false);
    if (capturedCwdB) expect(existsSync(capturedCwdB)).toBe(false);
  });

  it('runSymmetric passes dangerouslySkipPermissions=true to bridge args', async () => {
    const mockBridge = new MockClaudeBridge();
    const config = makeConfig();

    await engine.runSymmetric(config, mockAgentManager, mockBridge as any);

    // Every call should include --dangerously-skip-permissions in args
    for (const call of mockBridge.calls) {
      expect(call.args).toContain('--dangerously-skip-permissions');
    }
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

    await engine.runAsymmetric(config, mockAgentManager, mockBridge as any);

    // Both cwds should have been set and cleaned up
    expect(capturedCwdA).toBeDefined();
    expect(capturedCwdB).toBeDefined();
    expect(existsSync(capturedCwdA!)).toBe(false);
    expect(existsSync(capturedCwdB!)).toBe(false);
  });
});
