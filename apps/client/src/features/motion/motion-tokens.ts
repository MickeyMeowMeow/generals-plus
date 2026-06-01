export const MOTION_DURATION = {
  fast: 0.12,
  normal: 0.18,
  slow: 0.26,
} as const;

export const MOTION_DISTANCE = {
  none: 0,
  xs: 4,
  sm: 10,
} as const;

export const MOTION_EASING = {
  enter: [0.2, 0.9, 0.2, 1],
  exit: [0.4, 0, 1, 1],
  emphasis: [0.22, 1, 0.36, 1],
} as const;
