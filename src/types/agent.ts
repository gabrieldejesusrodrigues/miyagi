export interface AgentManifest {
  name: string;
  version: string;
  author: string;
  templateOrigin?: string;
  createdAt: string;
  updatedAt?: string;
  description?: string;
  domains?: string[];
}

export interface Agent {
  name: string;
  manifest: AgentManifest;
  identityPath: string;
  contextDir: string;
  skillsDir: string;
  historyDir: string;
  rootDir: string;
  scope: 'global' | 'project';
}

export interface InstalledSkillEntry {
  name: string;
  source: string;
  installedAt: string;
  version?: string;
}
