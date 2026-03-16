import { describe, it, expect } from 'vitest';
import { extractBalancedJson } from '../../src/utils/json-parser.js';
import { Judge } from '../../src/training/judge.js';

describe('extractBalancedJson', () => {
  it('extracts simple JSON object', () => {
    const result = extractBalancedJson('{"key": "value"}');
    expect(result).toBe('{"key": "value"}');
  });

  it('extracts JSON from surrounding text', () => {
    const result = extractBalancedJson('Here is the result: {"key": "value"} end');
    expect(result).toBe('{"key": "value"}');
  });

  it('handles nested braces correctly', () => {
    const json = '{"outer": {"inner": {"deep": true}}}';
    const result = extractBalancedJson(`Text before ${json} text after`);
    expect(result).toBe(json);
  });

  it('handles braces inside strings', () => {
    const json = '{"text": "this has {braces} inside"}';
    const result = extractBalancedJson(json);
    expect(result).toBe(json);
    expect(JSON.parse(result!)).toEqual({ text: 'this has {braces} inside' });
  });

  it('handles escaped quotes inside strings', () => {
    const json = '{"text": "escaped \\"quotes\\" here"}';
    const result = extractBalancedJson(json);
    expect(result).toBe(json);
  });

  it('returns null when no JSON found', () => {
    expect(extractBalancedJson('no json here')).toBeNull();
    expect(extractBalancedJson('')).toBeNull();
  });

  it('returns null for unbalanced braces', () => {
    expect(extractBalancedJson('{unclosed')).toBeNull();
    expect(extractBalancedJson('{{{')).toBeNull();
  });

  it('extracts only the first JSON object when multiple exist (GAP-5 fix)', () => {
    // This is the key test - the old greedy regex would match from first { to last }
    const json1 = '{"winner": "alpha", "reason": "better"}';
    const json2 = '{"note": "extra info"}';
    const text = `Here is my evaluation: ${json1} Note: ${json2}`;

    const result = extractBalancedJson(text);
    expect(result).toBe(json1);
    // Verify it's valid JSON
    expect(JSON.parse(result!).winner).toBe('alpha');
  });

  it('handles complex multi-block LLM response', () => {
    // Simulates an LLM returning explanation + JSON + more text with braces
    const verdict = JSON.stringify({
      winner: 'agent-a',
      reason: 'Superior argumentation',
      agentAAnalysis: { agent: 'agent-a', strengths: ['clear'], weaknesses: [], missedOpportunities: [], dimensionScores: { quality: 8 } },
      agentBAnalysis: { agent: 'agent-b', strengths: [], weaknesses: ['unclear'], missedOpportunities: [], dimensionScores: { quality: 5 } },
      narrative: 'A won decisively',
      comparativeAnalysis: 'A was better',
      coachingPriorities: { agentA: [], agentB: ['improve clarity'] },
    });
    const text = `I've analyzed the battle. Here's my verdict:\n\n${verdict}\n\nNote: The scores above are based on {criteria from the rubric}.`;

    const result = extractBalancedJson(text);
    const parsed = JSON.parse(result!);
    expect(parsed.winner).toBe('agent-a');
  });

  it('handles escaped backslashes correctly', () => {
    const json = '{"path": "C:\\\\Users\\\\test"}';
    const result = extractBalancedJson(json);
    expect(result).toBe(json);
  });
});

describe('Judge.parseVerdict with multiple JSON blocks (GAP-5)', () => {
  const judge = new Judge();

  it('correctly parses verdict when LLM response contains extra JSON blocks', () => {
    const verdict = JSON.stringify({
      winner: 'alpha',
      reason: 'Better arguments',
      narrative: 'Alpha won',
      agentAAnalysis: { agent: 'alpha', strengths: ['s1'], weaknesses: [], missedOpportunities: [], dimensionScores: {} },
      agentBAnalysis: { agent: 'beta', strengths: [], weaknesses: ['w1'], missedOpportunities: [], dimensionScores: {} },
      comparativeAnalysis: 'Alpha was better',
      coachingPriorities: { agentA: [], agentB: [] },
    });

    // LLM response with extra JSON block after the verdict
    const raw = `Here's my evaluation:\n${verdict}\n\nAdditional context: {"metadata": "extra"}`;

    const parsed = judge.parseVerdict(raw);
    expect(parsed.winner).toBe('alpha');
  });
});
