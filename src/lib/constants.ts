export const COLORS = {
  bg: '#0a0a0a',
  surface: '#141414',
  surfaceAlt: '#1c1c1e',
  border: '#2a2a2a',
  primary: '#6366f1',      // indigo
  primaryDim: '#4338ca',
  yes: '#22c55e',          // green
  no: '#ef4444',           // red
  text: '#f5f5f5',
  textMuted: '#737373',
  textDim: '#404040',
  warning: '#f59e0b',
  settled: '#a3e635',
} as const;

export const STAKE_MIN = 1;
export const STAKE_MAX = 500;
export const DISPUTE_WINDOW_HOURS = 48;
export const DISPUTE_THRESHOLD = 0.5;  // >50% dispute → void market

export const MIN_PARTICIPANTS_TO_ACTIVATE = 2;  // need both YES and NO sides
