import type { BattleProgressEvent, BattleProgressCallback } from '../../types/index.js';

export function formatElapsed(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export function formatEvent(event: BattleProgressEvent): string {
  const { phase, type, round, totalRounds, agent, message, elapsedMs } = event;

  if (phase === 'setup' && type === 'start') {
    const detail = message ? `: ${message}` : '';
    return `\u2694\ufe0f  Battle started${detail}`;
  }

  if (phase === 'round' && type === 'start') {
    const roundPart = `\ud83d\udccd Round ${round ?? '?'}/${totalRounds ?? '?'}`;
    const agentPart = agent ? ` — ${agent}` : '';
    const taskPart = message ? `\n    Task: ${message}` : '';
    return `${roundPart}${agentPart}${taskPart}`;
  }

  if (phase === 'round' && type === 'info' && agent) {
    return `  \ud83e\udd16 ${agent} is responding...`;
  }

  if (phase === 'round' && type === 'complete') {
    if (agent) {
      const elapsed = elapsedMs !== undefined ? ` (${formatElapsed(elapsedMs)})` : '';
      const MAX_PREVIEW = 200;
      const preview = message
        ? `\n    ${message.length > MAX_PREVIEW ? message.slice(0, MAX_PREVIEW).replace(/\n/g, ' ') + '...' : message.replace(/\n/g, ' ')}`
        : '';
      return `  \u2705 ${agent} completed${elapsed}${preview}`;
    }
    if (round !== undefined) {
      return `\u2705 Round ${round} complete`;
    }
    return `\u2705 Round complete`;
  }

  if (phase === 'judge' && type === 'start') {
    return `\u2696\ufe0f  Judge evaluating...`;
  }

  if (phase === 'judge' && type === 'complete') {
    const elapsed = elapsedMs !== undefined ? ` (${formatElapsed(elapsedMs)})` : '';
    return `\u2696\ufe0f  Judge evaluation complete${elapsed}`;
  }

  if (phase === 'coach' && type === 'start') {
    return agent ? `\ud83e\udd4b Coaching ${agent}...` : `\ud83e\udd4b Coaching...`;
  }

  if (phase === 'coach' && type === 'complete') {
    const elapsed = elapsedMs !== undefined ? ` (${formatElapsed(elapsedMs)})` : '';
    return agent ? `\ud83e\udd4b ${agent} coached${elapsed}` : `\ud83e\udd4b Coached${elapsed}`;
  }

  if (phase === 'complete' && type === 'complete') {
    return `\ud83c\udfc1 Battle complete!`;
  }

  // Fallback for unknown phase/type combos
  const parts: string[] = [`[${phase}/${type}]`];
  if (message) parts.push(message);
  return parts.join(' ');
}

export function createProgressCallback(writer?: (line: string) => void): BattleProgressCallback {
  const write = writer ?? console.log;
  return (event: BattleProgressEvent): void => {
    write(formatEvent(event));
  };
}
