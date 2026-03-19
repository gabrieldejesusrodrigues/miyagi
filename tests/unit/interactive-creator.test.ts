import { describe, it, expect } from 'vitest';
import { InteractiveCreator } from '../../src/core/interactive-creator.js';
import type { AgentAnswers } from '../../src/core/interactive-creator.js';

describe('InteractiveCreator', () => {
  const creator = new InteractiveCreator();

  const fullAnswers: AgentAnswers = {
    description: 'A sales agent that closes enterprise deals',
    domains: ['sales', 'negotiation'],
    archetype: 'Specialist',
    expertise: 'SPIN selling, MEDDIC, objection handling',
    boundaries: 'Do not handle legal or compliance matters',
    tone: 'Professional',
    verbosity: 'Balanced',
    communicationRules: 'Always use bullet points for proposals',
    workflow: '1. Discover needs 2. Present value 3. Handle objections 4. Close',
    uncertainty: 'Ask for clarification before proceeding',
    alwaysDo: 'Verify customer budget before proposing',
    neverDo: 'Never disparage competitors',
  };

  const minimalAnswers: AgentAnswers = {
    description: 'A code review specialist',
    domains: ['programming', 'code-review'],
    archetype: 'Specialist',
    expertise: 'TypeScript, React, Node.js best practices',
    boundaries: '',
    tone: 'Direct',
    verbosity: 'Concise',
    communicationRules: '',
    workflow: '',
    uncertainty: 'Make best judgment and flag the assumption',
    alwaysDo: '',
    neverDo: '',
  };

  describe('buildGenerationPrompt', () => {
    it('includes agent name', () => {
      const prompt = creator.buildGenerationPrompt('my-agent', fullAnswers);
      expect(prompt).toContain('my-agent');
    });

    it('includes all required fields', () => {
      const prompt = creator.buildGenerationPrompt('sales-pro', fullAnswers);
      expect(prompt).toContain('A sales agent that closes enterprise deals');
      expect(prompt).toContain('sales, negotiation');
      expect(prompt).toContain('Specialist');
      expect(prompt).toContain('SPIN selling, MEDDIC, objection handling');
      expect(prompt).toContain('Professional');
      expect(prompt).toContain('Balanced');
      expect(prompt).toContain('Ask for clarification before proceeding');
    });

    it('includes optional fields when provided', () => {
      const prompt = creator.buildGenerationPrompt('sales-pro', fullAnswers);
      expect(prompt).toContain('Do not handle legal or compliance matters');
      expect(prompt).toContain('Always use bullet points for proposals');
      expect(prompt).toContain('1. Discover needs');
      expect(prompt).toContain('Verify customer budget before proposing');
      expect(prompt).toContain('Never disparage competitors');
    });

    it('omits optional fields when empty', () => {
      const prompt = creator.buildGenerationPrompt('reviewer', minimalAnswers);
      expect(prompt).not.toContain('Boundaries');
      expect(prompt).not.toContain('Communication Rules');
      expect(prompt).not.toContain('Workflow');
      expect(prompt).not.toContain('Always Do');
      expect(prompt).not.toContain('Never Do');
    });

    it('includes identity.md format instructions', () => {
      const prompt = creator.buildGenerationPrompt('test', minimalAnswers);
      expect(prompt).toContain('## Personality');
      expect(prompt).toContain('## Strategy');
      expect(prompt).toContain('## Skill Directives');
      expect(prompt).toContain('## Context References');
    });

    it('appends feedback when provided', () => {
      const prompt = creator.buildGenerationPrompt('test', minimalAnswers, 'Make it more aggressive');
      expect(prompt).toContain('Make it more aggressive');
      expect(prompt).toContain('Feedback');
    });

    it('does not include feedback section when no feedback', () => {
      const prompt = creator.buildGenerationPrompt('test', minimalAnswers);
      expect(prompt).not.toContain('Feedback');
    });
  });

  describe('buildSkeletonIdentity', () => {
    it('produces valid markdown with agent name', () => {
      const skeleton = creator.buildSkeletonIdentity('my-agent', fullAnswers);
      expect(skeleton).toContain('# my-agent');
      expect(skeleton).toContain('## Personality');
      expect(skeleton).toContain('## Strategy');
      expect(skeleton).toContain('## Skill Directives');
      expect(skeleton).toContain('## Context References');
    });

    it('incorporates user answers into skeleton', () => {
      const skeleton = creator.buildSkeletonIdentity('sales-pro', fullAnswers);
      expect(skeleton).toContain('professional');
      expect(skeleton).toContain('specialist');
      expect(skeleton).toContain('A sales agent that closes enterprise deals');
      expect(skeleton).toContain('SPIN selling, MEDDIC, objection handling');
    });

    it('uses provided workflow when available', () => {
      const skeleton = creator.buildSkeletonIdentity('sales-pro', fullAnswers);
      expect(skeleton).toContain('1. Discover needs');
    });

    it('uses default workflow when none provided', () => {
      const skeleton = creator.buildSkeletonIdentity('reviewer', minimalAnswers);
      expect(skeleton).toContain('**Understand**');
      expect(skeleton).toContain('**Execute**');
    });

    it('includes communication rules when provided', () => {
      const skeleton = creator.buildSkeletonIdentity('sales-pro', fullAnswers);
      expect(skeleton).toContain('Always use bullet points for proposals');
    });
  });
});
