export interface MiyagiConfig {
  defaultModel?: string;
  claudePath?: string;
  reportsDir?: string;
  defaultBattleRounds?: number;
}

export interface SessionEntry {
  id: string;
  agent: string;
  startedAt: string;
  endedAt?: string;
  claudeSessionId?: string;
}
