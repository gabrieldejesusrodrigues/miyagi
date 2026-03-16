export interface SkillMetadata {
  name: string;
  description: string;
  internal?: boolean;
}

export interface AgentSkill {
  name: string;
  metadata: SkillMetadata;
  path: string;
  type: 'installed' | 'custom';
  source?: string;
}
