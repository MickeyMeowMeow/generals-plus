import type { VariantProps } from "class-variance-authority";

import type { badgeVariants } from "#/components/ui/badge";
import { Badge } from "#/components/ui/badge";
import { cn } from "#/lib/utils";

/** Maps a lifecycle status string to a badge variant. */
function statusToVariant(
  status: string,
): VariantProps<typeof badgeVariants>["variant"] {
  switch (status) {
    case "authenticated":
    case "connected":
      return "default";
    case "authenticating":
    case "connecting":
    case "hydrating":
    case "reconnecting":
      return "secondary";
    case "error":
      return "destructive";
    default:
      return "outline";
  }
}

interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

/** Color-coded badge for auth and connection status. */
export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <Badge
      variant={statusToVariant(status)}
      className={cn("font-mono", className)}
    >
      {label ?? status}
    </Badge>
  );
}
