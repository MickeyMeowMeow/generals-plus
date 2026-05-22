/**
 * Prettifies raw team identifiers (e.g. "team_0" -> "Team 1").
 */
export function formatTeamLabel(teamId: string): string {
  if (teamId.startsWith("team_")) {
    const num = Number.parseInt(teamId.substring("team_".length), 10);
    if (!Number.isNaN(num)) {
      return `Team ${num + 1}`;
    }
  }
  return `Team ${teamId}`;
}
