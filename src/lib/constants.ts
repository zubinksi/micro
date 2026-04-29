export const COLORS = {
  bg:           '#F8F8F8',
  surface:      '#FFFFFF',
  surfaceAlt:   '#F0F0F0',
  border:       '#E8E8E8',
  primary:      '#FF5252',
  primaryLight: '#FFECEC',
  yes:          '#38A169',
  yesLight:     '#E6F5EE',
  no:           '#E53E3E',
  noLight:      '#FDE8E8',
  text:         '#1A1A1A',
  textMuted:    '#606060',
  textDim:      '#909090',
  warning:      '#FFD93D',
  settled:      '#38A169',
} as const;

export const FONTS = {
  serif:      'Inter_700Bold',
  sans:       'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansBold:   'Inter_700Bold',
} as const;

export const STAKE_MIN = 1;
export const STAKE_MAX = 500;
export const DISPUTE_WINDOW_HOURS = 2;
export const DISPUTE_THRESHOLD = 0.5;
export const MIN_PARTICIPANTS_TO_ACTIVATE = 2;
