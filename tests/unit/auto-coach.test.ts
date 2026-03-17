import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Coach } from '../../src/training/coach.js';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { JudgeVerdict } from '../../src/types/index.js';

const mockVerdict: JudgeVerdict = {
  winner: 'alpha',
  reason: 'Better approach',
  narrative: 'Alpha was better',
  agentAAnalysis: {
    agent: 'alpha',
    strengths: ['good'],
    weaknesses: ['bad'],
    missedOpportunities: [],
    dimensionScores: { quality: 7 },
  },
  agentBAnalysis: {
    agent: 'beta',
    strengths: [],
    weaknesses: [],
    missedOpportunities: [],
    dimensionScores: {},
  },
  comparativeAnalysis: 'A vs B',
  coachingPriorities: {
    agentA: ['Improve X'],
    agentB: ['Improve Y'],
  },
};

describe('Coach.buildCoachingPrompt() with identity and manifest', () => {
  let tempDir: string;
  let coach: Coach;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'miyagi-auto-coach-test-'));
    const identityContent = '# Alpha Identity\n\nI am a developer agent.\n';
    writeFileSync(join(tempDir, 'identity.md'), identityContent);

    const mockAgentManager = {
      get: async (name: string) => ({
        name,
        identityPath: join(tempDir, 'identity.md'),
        rootDir: tempDir,
        contextDir: join(tempDir, 'context'),
        skillsDir: join(tempDir, 'skills'),
        manifest: { name, description: 'test' },
      }),
    } as any;

    coach = new Coach(mockAgentManager);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('includes agent identity in prompt', () => {
    const identity = '# Alpha Identity\n\nI am a developer agent.\n';
    const manifest = { description: 'A developer agent', domains: ['coding'], templateOrigin: 'dev-template' };
    const prompt = coach.buildCoachingPrompt('alpha', mockVerdict, identity, manifest);
    expect(prompt).toContain('# Alpha Identity');
    expect(prompt).toContain('I am a developer agent');
  });

  it('includes agent description when present', () => {
    const identity = '# Alpha\n\nDeveloper agent.';
    const manifest = { description: 'A skilled developer agent for code review' };
    const prompt = coach.buildCoachingPrompt('alpha', mockVerdict, identity, manifest);
    expect(prompt).toContain('A skilled developer agent for code review');
  });

  it('includes agent domains when present', () => {
    const identity = '# Alpha\n\nAgent.';
    const manifest = { domains: ['coding', 'testing', 'debugging'] };
    const prompt = coach.buildCoachingPrompt('alpha', mockVerdict, identity, manifest);
    expect(prompt).toContain('coding');
    expect(prompt).toContain('testing');
    expect(prompt).toContain('debugging');
  });

  it('includes coaching reminders with student name', () => {
    const identity = '# Alpha\n\nAgent.';
    const manifest = {};
    const prompt = coach.buildCoachingPrompt('alpha', mockVerdict, identity, manifest);
    expect(prompt).toContain('REMINDERS');
    expect(prompt).toContain('student you are coaching is "alpha"');
    expect(prompt).toContain('SPECIALIST');
  });

  it('includes template origin when present', () => {
    const identity = '# Alpha\n\nAgent.';
    const manifest = { templateOrigin: 'senior-dev-template' };
    const prompt = coach.buildCoachingPrompt('alpha', mockVerdict, identity, manifest);
    expect(prompt).toContain('senior-dev-template');
  });

  it('works without optional manifest fields', () => {
    const identity = '# Alpha\n\nAgent.';
    const manifest = {};
    const prompt = coach.buildCoachingPrompt('alpha', mockVerdict, identity, manifest);
    expect(prompt).toContain('alpha');
    expect(prompt).toContain('# Alpha');
    expect(prompt).toContain('REMINDERS');
  });

  it('coaching prompt for developer agent mentions coding/programming concepts', () => {
    const identity = '# Alpha\n\nAgent.';
    const manifest = { domains: ['coding'], description: 'A developer agent' };
    const prompt = coach.buildCoachingPrompt('alpha', mockVerdict, identity, manifest);
    expect(prompt).toMatch(/coding|programming|TDD|design pattern|refactor|architectural/i);
  });

  it('includes battle transcript when provided', () => {
    const identity = '# Alpha\n\nAgent.';
    const manifest = {};
    const transcript = '### Round 1\nStudent "alpha" output:\nHello world code\n\nOpponent "beta" output:\nBetter code\n';
    const prompt = coach.buildCoachingPrompt('alpha', mockVerdict, identity, manifest, transcript);
    expect(prompt).toContain('Full Battle Transcript');
    expect(prompt).toContain('Student "alpha" output');
    expect(prompt).toContain('Hello world code');
    expect(prompt).toContain('Opponent "beta" output');
  });

  it('prompt is critical in tone', () => {
    const identity = '# Alpha\n\nAgent.';
    const manifest = {};
    const prompt = coach.buildCoachingPrompt('alpha', mockVerdict, identity, manifest);
    expect(prompt).toContain('CRITICAL and REALISTIC');
  });

  it('coaching prompt for sales agent mentions sales concepts', () => {
    const identity = '# Beta\n\nSales agent.';
    const manifest = { domains: ['sales'], description: 'A sales agent' };
    const prompt = coach.buildCoachingPrompt('beta', mockVerdict, identity, manifest);
    expect(prompt).toMatch(/sales|SPIN|Challenger|objection|closing|discovery/i);
  });
});
