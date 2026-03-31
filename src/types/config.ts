export interface MiyagiConfig {
  defaultModel?: string;
  claudePath?: string;
  reportsDir?: string;
  defaultBattleRounds?: number;
  judge?: { model?: string };
  coach?: { model?: string };
}

export interface SessionEntry {
  id: string;
  agent: string;
  startedAt: string;
  endedAt?: string;
  claudeSessionId?: string;
}
