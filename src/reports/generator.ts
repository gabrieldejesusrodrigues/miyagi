import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Handlebars from 'handlebars';
import type { BattleResult, JudgeVerdict, AgentStats } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Register helpers
Handlebars.registerHelper('winnerClass', (agent: string, winner: string) => {
  if (winner === 'draw') return 'draw';
  return agent === winner ? 'winner' : 'loser';
});

Handlebars.registerHelper('multiply', (a: number, b: number) => a * b);

export class ReportGenerator {
  private readonly templatesDir: string;
  private readonly stylesPath: string;
  private styles: string;

  constructor() {
    this.templatesDir = join(__dirname, 'templates');
    this.stylesPath = join(__dirname, 'assets', 'styles.css');
    this.styles = existsSync(this.stylesPath)
      ? readFileSync(this.stylesPath, 'utf-8')
      : '';
  }

  generateBattleReport(
    result: BattleResult,
    verdict: JudgeVerdict,
    outputPath: string,
  ): void {
    const templatePath = join(this.templatesDir, 'battle.hbs');
    const template = Handlebars.compile(readFileSync(templatePath, 'utf-8'));

    const html = template({
      agentA: result.config.agentA,
      agentB: result.config.agentB,
      mode: result.config.mode,
      date: new Date(result.endedAt).toLocaleDateString(),
      winner: verdict.winner,
      reason: verdict.reason,
      narrative: verdict.narrative,
      rounds: result.rounds,
      coachingA: verdict.coachingPriorities.agentA,
      coachingB: verdict.coachingPriorities.agentB,
      generatedAt: new Date().toISOString(),
      styles: this.styles,
    });

    const dir = dirname(outputPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(outputPath, html, 'utf-8');
  }

  generateProfileReport(
    agentName: string,
    stats: AgentStats,
    outputPath: string,
    description?: string,
  ): void {
    const templatePath = join(this.templatesDir, 'profile.hbs');
    const template = Handlebars.compile(readFileSync(templatePath, 'utf-8'));

    const html = template({
      name: agentName,
      description: description ?? '',
      battles: stats.battles,
      dimensions: stats.dimensions,
      elo: stats.elo,
      generatedAt: new Date().toISOString(),
      styles: this.styles,
    });

    const dir = dirname(outputPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(outputPath, html, 'utf-8');
  }
}
