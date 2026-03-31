import type { ModelSpec } from '../../types/provider.js';
import type { ProviderBridge } from './types.js';
import { ClaudeBridge } from './claude-bridge.js';
import { GeminiBridge } from './gemini-bridge.js';
import { CodexBridge } from './codex-bridge.js';

export function createBridge(spec?: ModelSpec): ProviderBridge {
  const provider = spec?.provider ?? 'claude';

  switch (provider) {
    case 'claude':
      return new ClaudeBridge();
    case 'gemini':
      return new GeminiBridge();
    case 'codex':
      return new CodexBridge();
    default:
      throw new Error(`Unknown provider: "${provider}"`);
  }
}
