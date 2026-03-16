import type { AgentManifest, AgentStats } from '../types/index.js';

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateManifest(data: unknown): ValidationResult {
  const errors: string[] = [];
  const obj = data as Record<string, unknown>;

  if (!obj || typeof obj !== 'object') {
    return { valid: false, errors: ['manifest must be an object'] };
  }
  if (typeof obj.name !== 'string' || !obj.name) {
    errors.push('name is required');
  }
  if (typeof obj.version !== 'string' || !obj.version) {
    errors.push('version is required');
  }

  return { valid: errors.length === 0, errors };
}

export function validateStatsJson(data: unknown): ValidationResult {
  const errors: string[] = [];
  const obj = data as Record<string, unknown>;

  if (!obj || typeof obj !== 'object') {
    return { valid: false, errors: ['stats must be an object'] };
  }
  if (typeof obj.agent !== 'string') errors.push('agent is required');
  if (!obj.elo || typeof obj.elo !== 'object') errors.push('elo is required');
  if (!obj.battles || typeof obj.battles !== 'object') errors.push('battles is required');

  return { valid: errors.length === 0, errors };
}

export function validateInstalledSkills(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(data)) {
    return { valid: false, errors: ['installed skills must be an array'] };
  }

  for (const [i, entry] of data.entries()) {
    if (typeof entry.name !== 'string') errors.push(`entry[${i}].name is required`);
    if (typeof entry.source !== 'string') errors.push(`entry[${i}].source is required`);
  }

  return { valid: errors.length === 0, errors };
}
