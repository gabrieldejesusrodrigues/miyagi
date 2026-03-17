import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { AgentStats, BattleResult, JudgeVerdict } from '../types/index.js';
import type { AgentManager } from '../core/agent-manager.js';
import { updateDimensionScores } from './scoring.js';
import { validateStatsJson } from '../utils/validators.js';

export class HistoryManager {
  private readonly agentManager: AgentManager;

  constructor(agentManager: AgentManager) {
    this.agentManager = agentManager;
  }

  async getStats(agentName: string): Promise<AgentStats> {
    const agent = await this.agentManager.get(agentName);
    if (!agent) throw new Error(`Agent "${agentName}" not found`);

    const statsPath = join(agent.historyDir, 'stats.json');
    try {
      const data = JSON.parse(readFileSync(statsPath, 'utf-8'));
      const validation = validateStatsJson(data);
      if (!validation.valid) {
        throw new Error(`Invalid stats.json for "${agentName}": ${validation.errors.join(', ')}`);
      }
      return data as AgentStats;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Failed to parse stats.json for "${agentName}": ${error.message}`);
      }
      throw error;
    }
  }

  async recordBattle(agentName: string, result: BattleResult): Promise<void> {
    const agent = await this.agentManager.get(agentName);
    if (!agent) throw new Error(`Agent "${agentName}" not found`);

    const battlesPath = join(agent.historyDir, 'battles.json');
    let battles: unknown[];
    try {
      battles = JSON.parse(readFileSync(battlesPath, 'utf-8'));
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Failed to parse battles.json for "${agentName}": ${error.message}`);
      }
      throw error;
    }
    battles.push({
      id: result.config.id,
      mode: result.config.mode,
      opponent: result.config.agentA === agentName ? result.config.agentB : result.config.agentA,
      date: result.endedAt,
      terminationReason: result.terminationReason,
    });
    writeFileSync(battlesPath, JSON.stringify(battles, null, 2));
  }

  async updateStats(
    agentName: string,
    result: BattleResult,
    verdict: JudgeVerdict,
  ): Promise<void> {
    const stats = await this.getStats(agentName);

    // Update battle record
    stats.battles.total++;
    if (verdict.winner === agentName) {
      stats.battles.record.wins++;
    } else if (verdict.winner === 'draw') {
      stats.battles.record.draws++;
    } else {
      stats.battles.record.losses++;
    }

    // Update dimension scores
    const isAgentA = result.config.agentA === agentName;
    const analysis = isAgentA ? verdict.agentAAnalysis : verdict.agentBAnalysis;
    stats.dimensions = updateDimensionScores(stats.dimensions, analysis.dimensionScores);

    // Update last battle
    stats.lastBattle = result.config.id;

    // Save
    const agent = await this.agentManager.get(agentName);
    if (!agent) throw new Error(`Agent "${agentName}" not found`);
    const statsPath = join(agent.historyDir, 'stats.json');
    writeFileSync(statsPath, JSON.stringify(stats, null, 2));
  }

  async appendTrainingLog(agentName: string, note: string): Promise<void> {
    const agent = await this.agentManager.get(agentName);
    if (!agent) throw new Error(`Agent "${agentName}" not found`);

    const logPath = join(agent.historyDir, 'training-log.md');
    const date = new Date().toISOString().split('T')[0];
    appendFileSync(logPath, `\n## ${date}\n\n${note}\n`);
  }

  async addCoachNote(agentName: string, note: string): Promise<void> {
    const stats = await this.getStats(agentName);
    stats.coachNotes.push({
      date: new Date().toISOString(),
      note,
    });

    const agent = await this.agentManager.get(agentName);
    if (!agent) throw new Error(`Agent "${agentName}" not found`);
    const statsPath = join(agent.historyDir, 'stats.json');
    writeFileSync(statsPath, JSON.stringify(stats, null, 2));
  }

  saveBattleData(reportsDir: string, battleId: string, result: BattleResult, verdict: JudgeVerdict): void {
    if (!/^[a-zA-Z0-9_-]+$/.test(battleId)) {
      throw new Error(`Invalid battle ID: "${battleId}"`);
    }
    const battleDataDir = join(reportsDir, 'battle-data');
    if (!existsSync(battleDataDir)) {
      mkdirSync(battleDataDir, { recursive: true });
    }
    const filePath = join(battleDataDir, `${battleId}.json`);
    writeFileSync(filePath, JSON.stringify({ result, verdict }, null, 2), 'utf-8');
  }

  getBattleData(reportsDir: string, battleId: string): { result: BattleResult; verdict: JudgeVerdict } | null {
    if (!/^[a-zA-Z0-9_-]+$/.test(battleId)) {
      throw new Error(`Invalid battle ID: "${battleId}"`);
    }
    const filePath = join(reportsDir, 'battle-data', `${battleId}.json`);
    if (!existsSync(filePath)) {
      return null;
    }
    const raw = readFileSync(filePath, 'utf-8');
    try {
      return JSON.parse(raw) as { result: BattleResult; verdict: JudgeVerdict };
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Failed to parse battle data for "${battleId}": ${error.message}`);
      }
      throw error;
    }
  }
}
