import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionManager } from '../../src/core/session-manager.js';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('SessionManager', () => {
  let tempDir: string;
  let sessionManager: SessionManager;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'miyagi-test-'));
    sessionManager = new SessionManager(tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('records a session', () => {
    sessionManager.record('agent-a', 'session-123');
    const sessions = sessionManager.listForAgent('agent-a');
    expect(sessions.length).toBe(1);
    expect(sessions[0].claudeSessionId).toBe('session-123');
  });

  it('gets the latest session for an agent', () => {
    sessionManager.record('agent-a', 'session-1');
    sessionManager.record('agent-a', 'session-2');
    const latest = sessionManager.getLatest('agent-a');
    expect(latest?.claudeSessionId).toBe('session-2');
  });

  it('returns null for agent with no sessions', () => {
    const latest = sessionManager.getLatest('nonexistent');
    expect(latest).toBeNull();
  });

  it('keeps sessions separated by agent', () => {
    sessionManager.record('agent-a', 'session-a');
    sessionManager.record('agent-b', 'session-b');
    expect(sessionManager.listForAgent('agent-a').length).toBe(1);
    expect(sessionManager.listForAgent('agent-b').length).toBe(1);
  });
});
