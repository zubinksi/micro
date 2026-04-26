export const COLORS = {
  bg:           '#F5F1EB',  // warm cream
  surface:      '#FDFAF6',  // off-white
  surfaceAlt:   '#EDE8E0',  // warm grey
  border:       '#D6CFC4',  // warm border
  primary:      '#2D6A4F',  // forest green
  primaryLight: '#E8F2EC',  // light green tint
  yes:          '#2D6A4F',  // forest green for YES
  yesLight:     '#E8F2EC',
  no:           '#A85252',  // muted rose for NO
  noLight:      '#F5EAEA',
  text:         '#1A1A1A',
  textMuted:    '#6B6259',  // warm grey-brown
  textDim:      '#A89E93',
  warning:      '#C17F3E',  // warm amber
  settled:      '#2D6A4F',
} as const;

export const FONTS = {
  serif:      'DMSerifDisplay_400Regular',
  sans:       'DMSans_400Regular',
  sansMedium: 'DMSans_500Medium',
  sansBold:   'DMSans_700Bold',
} as const;

export const STAKE_MIN = 1;
export const STAKE_MAX = 500;
export const DISPUTE_WINDOW_HOURS = 2;
export const DISPUTE_THRESHOLD = 0.5;  // >50% dispute → void market

export const MIN_PARTICIPANTS_TO_ACTIVATE = 2;  // need both YES and NO sides
