import type { BattleModeConfig } from '../../types/index.js';

export const speedRunMode: BattleModeConfig = {
  name: 'speed-run',
  type: 'symmetric',
  description: 'Both agents race to complete a task. Judged on speed and quality balance.',
  defaultRounds: 1,
};
