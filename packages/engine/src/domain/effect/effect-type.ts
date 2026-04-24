export const EffectType = {
  TROOP_GENERATION: "troop_generation",
  TROOP_DRAIN: "troop_drain",
} as const;

export type EffectType = (typeof EffectType)[keyof typeof EffectType];
