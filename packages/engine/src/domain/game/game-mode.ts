/**
 * Defines the overall ruleset and victory conditions for the current match.
 */
export const GameMode = {
  /** Classic generals.io rules. Capture the general to win. */
  CLASSIC: "classic",

  /** Attack/Defend mode. Attackers must plant and detonate a bomb. */
  DEMOLITION: "demolition",

  /** High-speed area control. Most tiles owned at the end of time wins. */
  TURF_WAR: "turf_war",

  /** Survival mode. Zombies try to infect all humans. Humans try to survive. */
  BIOHAZARD: "biohazard",

  /** Objective push. Teams escort a cart to the enemy base. */
  PAYLOAD: "payload",

  /** Sports-style capture. Carry the ball to the enemy's goal zone. */
  RUGBY: "rugby",

  /** Battle royale style. The playable map area steadily shrinks over time, forcing players together. */
  COLLAPSE: "collapse",

  /** Control point mode. Capture and hold specific strategic locations on the map to accumulate score. */
  DOMINATION: "domination",

  /** Intelligence gathering. Infiltrate the enemy base to steal intel or operate under heavy fog of war. */
  ESPIONAGE: "espionage",
} as const;

export type GameMode = (typeof GameMode)[keyof typeof GameMode];
