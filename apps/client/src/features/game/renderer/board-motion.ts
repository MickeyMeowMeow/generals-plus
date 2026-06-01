export function getBoardPulse({
  ageMs,
  reducedMotion,
}: {
  readonly ageMs: number;
  readonly reducedMotion: boolean;
}) {
  if (reducedMotion) {
    return { alpha: 1, scale: 1 };
  }

  const clamped = Math.min(Math.max(ageMs, 0), 400);
  const progress = clamped / 400;

  return {
    alpha: 1 - progress * 0.35,
    scale: 1 + (1 - progress) * 0.08,
  };
}
