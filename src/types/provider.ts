export type ProviderName = 'claude' | 'gemini' | 'codex';

export interface ModelSpec {
  provider: ProviderName;
  model: string;
}

export interface SessionOptions {
  systemPrompt: string;
  model?: string;
  effort?: string;
  cwd?: string;
  extraArgs?: string[];
  resumeSession?: string;
  dangerouslySkipPermissions?: boolean;
}

export interface BattleAgentOptions {
  systemPrompt: string;
  prompt: string;
  model?: string;
  effort?: string;
  dangerouslySkipPermissions?: boolean;
}

const VALID_PROVIDERS = new Set<string>(['claude', 'gemini', 'codex']);

export function parseModelSpec(spec?: string): ModelSpec {
  if (!spec) return { provider: 'claude', model: 'sonnet' };

  const slash = spec.indexOf('/');
  if (slash === -1) return { provider: 'claude', model: spec };

  const provider = spec.slice(0, slash);
  const model = spec.slice(slash + 1);

  if (!VALID_PROVIDERS.has(provider)) {
    throw new Error(`Unknown provider "${provider}". Valid providers: claude, gemini, codex`);
  }

  return { provider: provider as ProviderName, model };
}

export function resolveModel(
  cliOverride?: string,
  manifest?: { model?: string },
  globalConfig?: { defaultModel?: string },
): ModelSpec {
  const raw = cliOverride
    || manifest?.model
    || globalConfig?.defaultModel
    || undefined;
  return parseModelSpec(raw);
}
