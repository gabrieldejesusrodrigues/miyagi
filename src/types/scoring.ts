export interface DimensionScore {
  current: number;
  history: number[];
  trend: 'up' | 'down' | 'stable';
}

export interface AgentStats {
  agent: string;
  elo: Record<string, number>;
  dimensions: Record<string, DimensionScore>;
  battles: {
    total: number;
    record: { wins: number; losses: number; draws: number };
  };
  coachNotes: Array<{ date: string; note: string }>;
  lastBattle?: string;
}

export interface JudgeVerdict {
  winner: string | 'draw';
  reason: string;
  narrative: string;
  agentAAnalysis: AgentAnalysis;
  agentBAnalysis: AgentAnalysis;
  comparativeAnalysis: string;
  coachingPriorities: {
    agentA: string[];
    agentB: string[];
  };
}

export interface AgentAnalysis {
  agent: string;
  strengths: string[];
  weaknesses: string[];
  missedOpportunities: string[];
  dimensionScores: Record<string, number>;
}
