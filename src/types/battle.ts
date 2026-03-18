export type BattleType = 'symmetric' | 'asymmetric';

export type BattleMode =
  | 'same-task'
  | 'code-challenge'
  | 'iterative-refinement'
  | 'speed-run'
  | 'debate'
  | 'sales-roleplay'
  | 'negotiation'
  | 'review-duel'
  | 'interview'
  | 'support-ticket';

export interface BattleModeConfig {
  name: BattleMode;
  type: BattleType;
  description: string;
  defaultRounds: number;
  roles?: { agentA: string; agentB: string };
}

export interface BattleConfig {
  id: string;
  mode: BattleMode;
  agentA: string;
  agentB: string;
  task?: string;
  topic?: string;
  maxRounds: number;
  background: boolean;
  startedAt: string;
}

export interface BattleRound {
  round: number;
  agentAResponse: string;
  agentBResponse: string;
  timestamp: string;
}

export interface BattleResult {
  config: BattleConfig;
  rounds: BattleRound[];
  endedAt: string;
  terminationReason: 'natural' | 'round-limit' | 'user-stopped' | 'judge-called';
}

export type BattlePhase = 'setup' | 'round' | 'judge' | 'coach' | 'complete';

export interface BattleProgressEvent {
  phase: BattlePhase;
  type: 'start' | 'complete' | 'info';
  round?: number;
  totalRounds?: number;
  agent?: string;
  message?: string;
  elapsedMs?: number;
}

export type BattleProgressCallback = (event: BattleProgressEvent) => void;

export type BattleStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface BackgroundBattleConfig {
  battleConfig: BattleConfig;
  effort: string;
}

export interface BackgroundBattleInfo {
  id: string;
  status: BattleStatus;
  config: BattleConfig;
  effort: string;
  pid?: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
}
