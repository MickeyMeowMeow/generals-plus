/**
 * Defines the strategic nature and win conditions of a team.
 */
export const TeamType = {
  /** Standard FFA or balanced team mode. Goal: Eliminate enemy capitals. */
  STANDARD: "standard",

  /** Attackers in Demolition mode. Goal: Plant and detonate the bomb. */
  ATTACKER: "attacker",
  /** Defenders in Demolition mode. Goal: Prevent planting or defuse the bomb. */
  DEFENDER: "defender",

  /** Human survivors in Biohazard mode. Goal: Survive until time runs out. */
  HUMAN: "human",
  /** The infected swarm in Biohazard mode. Goal: Infect all humans. */
  ZOMBIE: "zombie",

  /** Teams focused on numerical score (e.g., Turf War area or Rugby touchdowns). */
  SCORER: "scorer",
  /** Teams focused on movement progress (e.g., pushing the Payload cart). */
  PUSHER: "pusher",
} as const;

export type TeamType = (typeof TeamType)[keyof typeof TeamType];
