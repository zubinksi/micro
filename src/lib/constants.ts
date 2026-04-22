export const COLORS = {
  bg: '#F5F6FA',
  surface: '#FFFFFF',
  surfaceAlt: '#F0F1F5',
  border: '#E8E9EE',
  primary: '#4B7BF5',      // blue
  primaryDim: '#2B5BD5',
  yes: '#22c55e',          // green
  no: '#ef4444',           // red
  text: '#111111',
  textMuted: '#777777',
  textDim: '#BBBBBB',
  warning: '#f59e0b',
  settled: '#16a34a',
} as const;

export const STAKE_MIN = 1;
export const STAKE_MAX = 500;
export const DISPUTE_WINDOW_HOURS = 48;
export const DISPUTE_THRESHOLD = 0.5;  // >50% dispute → void market

export const MIN_PARTICIPANTS_TO_ACTIVATE = 2;  // need both YES and NO sides
