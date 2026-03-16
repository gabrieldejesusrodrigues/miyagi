import { Command } from 'commander';

export function createProgram(): Command {
  const program = new Command();
  program
    .name('miyagi')
    .description('Agent & Skill Trainer for Claude Code')
    .version('0.1.0');
  return program;
}
