import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type { SessionEntry } from '../types/index.js';

export class SessionManager {
  private readonly sessionsPath: string;

  constructor(rootDir: string) {
    if (!existsSync(rootDir)) mkdirSync(rootDir, { recursive: true });
    this.sessionsPath = join(rootDir, 'sessions.json');
  }

  record(agentName: string, claudeSessionId: string): SessionEntry {
    const sessions = this.loadAll();
    const entry: SessionEntry = {
      id: randomUUID(),
      agent: agentName,
      startedAt: new Date().toISOString(),
      claudeSessionId,
    };
    sessions.push(entry);
    this.saveAll(sessions);
    return entry;
  }

  listForAgent(agentName: string): SessionEntry[] {
    const filtered = this.loadAll().filter(s => s.agent === agentName);
    // Reverse so newest (last appended) comes first; stable for equal timestamps
    return filtered.reverse();
  }

  getLatest(agentName: string): SessionEntry | null {
    const sessions = this.listForAgent(agentName);
    return sessions[0] ?? null;
  }

  endSession(sessionId: string): void {
    const sessions = this.loadAll();
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      session.endedAt = new Date().toISOString();
      this.saveAll(sessions);
    }
  }

  private loadAll(): SessionEntry[] {
    if (!existsSync(this.sessionsPath)) return [];
    return JSON.parse(readFileSync(this.sessionsPath, 'utf-8'));
  }

  private saveAll(sessions: SessionEntry[]): void {
    writeFileSync(this.sessionsPath, JSON.stringify(sessions, null, 2));
  }
}
