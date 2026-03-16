import type { AgentStats } from '../../types/index.js';

const TREND_ICONS: Record<string, string> = {
  up: '^',
  down: 'v',
  stable: '=',
};

function bar(value: number, max: number = 10, width: number = 20): string {
  const filled = Math.round((value / max) * width);
  const empty = width - filled;
  return '[' + '#'.repeat(filled) + '-'.repeat(empty) + ']';
}

export function formatStatsDisplay(stats: AgentStats): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(`  Agent: ${stats.agent}`);
  lines.push('  ' + '='.repeat(40));
  lines.push('');

  // Battle record
  lines.push('  Battle Record');
  lines.push(`    Total: ${stats.battles.total}  |  W: ${stats.battles.record.wins}  L: ${stats.battles.record.losses}  D: ${stats.battles.record.draws}`);

  if (stats.battles.total > 0) {
    const winRate = ((stats.battles.record.wins / stats.battles.total) * 100).toFixed(1);
    lines.push(`    Win Rate: ${winRate}%`);
  }
  lines.push('');

  // ELO ratings
  if (Object.keys(stats.elo).length > 0) {
    lines.push('  ELO Ratings');
    for (const [domain, rating] of Object.entries(stats.elo)) {
      lines.push(`    ${domain}: ${rating}`);
    }
    lines.push('');
  }

  // Skill dimensions
  if (Object.keys(stats.dimensions).length > 0) {
    lines.push('  Skill Dimensions');
    for (const [name, dim] of Object.entries(stats.dimensions)) {
      const trend = TREND_ICONS[dim.trend] ?? '=';
      lines.push(`    ${name.padEnd(16)} ${bar(dim.current)} ${dim.current.toFixed(1)} ${trend}`);
    }
    lines.push('');
  }

  // Coach notes
  if (stats.coachNotes.length > 0) {
    lines.push('  Latest Coach Notes');
    const recent = stats.coachNotes.slice(-3);
    for (const note of recent) {
      lines.push(`    [${note.date}] ${note.note}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function formatComparisonDisplay(statsA: AgentStats, statsB: AgentStats): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(`  ${statsA.agent} vs ${statsB.agent}`);
  lines.push('  ' + '='.repeat(50));
  lines.push('');

  // Battle records side by side
  lines.push('  Battle Records');
  lines.push(`    ${statsA.agent}: ${statsA.battles.record.wins}W/${statsA.battles.record.losses}L/${statsA.battles.record.draws}D (${statsA.battles.total} total)`);
  lines.push(`    ${statsB.agent}: ${statsB.battles.record.wins}W/${statsB.battles.record.losses}L/${statsB.battles.record.draws}D (${statsB.battles.total} total)`);
  lines.push('');

  // Compare dimensions
  const allDims = new Set([...Object.keys(statsA.dimensions), ...Object.keys(statsB.dimensions)]);
  if (allDims.size > 0) {
    lines.push('  Dimension Comparison');
    for (const dim of allDims) {
      const a = statsA.dimensions[dim]?.current ?? 0;
      const b = statsB.dimensions[dim]?.current ?? 0;
      const winner = a > b ? '<' : a < b ? '>' : '=';
      lines.push(`    ${dim.padEnd(16)} ${a.toFixed(1)} ${winner} ${b.toFixed(1)}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
