import type { Command } from 'commander';
import { ConfigManager } from '../../core/config.js';
import { parseModelSpec } from '../../types/provider.js';
import type { MiyagiConfig } from '../../types/index.js';

const MODEL_KEYS = new Set(['defaultModel', 'judge.model', 'coach.model']);

function validateModelValue(key: string, value: string): void {
  if (MODEL_KEYS.has(key)) {
    parseModelSpec(value);
  }
}

export function getConfigValue(config: ConfigManager, key: string): unknown {
  const data = config.load();
  const parts = key.split('.');

  let current: Record<string, unknown> = data as Record<string, unknown>;
  for (const part of parts) {
    if (current === undefined || current === null || typeof current !== 'object') {
      return undefined;
    }
    current = current[part] as Record<string, unknown>;
  }
  return current;
}

export function setConfigValue(config: ConfigManager, key: string, value: string): void {
  validateModelValue(key, value);

  const data = config.load() as Record<string, unknown>;
  const parts = key.split('.');

  if (parts.length === 1) {
    data[parts[0]] = value;
  } else {
    let current = data;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
        current[parts[i]] = {};
      }
      current = current[parts[i]] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]] = value;
  }

  config.save(data as MiyagiConfig);
}

export function resetConfigValue(config: ConfigManager, key: string): void {
  const data = config.load() as Record<string, unknown>;
  const parts = key.split('.');

  if (parts.length === 1) {
    delete data[parts[0]];
  } else {
    let current = data;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
        return;
      }
      current = current[parts[i]] as Record<string, unknown>;
    }
    delete current[parts[parts.length - 1]];
  }

  config.save(data as MiyagiConfig);
}

export function registerConfigCommand(program: Command): void {
  const configCmd = program
    .command('config')
    .description('Manage Miyagi configuration');

  configCmd
    .command('get')
    .argument('<key>', 'Configuration key (e.g., defaultModel, judge.model)')
    .description('Get a configuration value')
    .action((key: string) => {
      const config = new ConfigManager();
      const value = getConfigValue(config, key);
      if (value === undefined) {
        console.log(`(not set)`);
      } else {
        console.log(typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value));
      }
    });

  configCmd
    .command('set')
    .argument('<key>', 'Configuration key (e.g., defaultModel, judge.model, coach.model)')
    .argument('<value>', 'Value to set')
    .description('Set a configuration value')
    .action((key: string, value: string) => {
      const config = new ConfigManager();
      config.ensureDirectories();
      try {
        setConfigValue(config, key, value);
        console.log(`Set ${key} = ${value}`);
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  configCmd
    .command('list')
    .description('List all configuration')
    .action(() => {
      const config = new ConfigManager();
      const data = config.load();
      if (Object.keys(data).length === 0) {
        console.log('(no configuration set)');
      } else {
        console.log(JSON.stringify(data, null, 2));
      }
    });

  configCmd
    .command('reset')
    .argument('<key>', 'Configuration key to reset')
    .description('Reset a configuration value to default')
    .action((key: string) => {
      const config = new ConfigManager();
      resetConfigValue(config, key);
      console.log(`Reset ${key}`);
    });
}
