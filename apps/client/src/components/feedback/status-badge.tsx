import type { VariantProps } from "class-variance-authority";

import type { badgeVariants } from "#/components/ui/badge";
import { Badge } from "#/components/ui/badge";
import { cn } from "#/lib/utils";

/** Maps a lifecycle status string to a badge variant. */
const STATUS_VARIANT_MAP: Record<
  string,
  VariantProps<typeof badgeVariants>["variant"]
> = {
  authenticated: "default",
  connected: "default",
  authenticating: "secondary",
  connecting: "secondary",
  hydrating: "secondary",
  error: "destructive",
};

function statusToVariant(
  status: string,
): VariantProps<typeof badgeVariants>["variant"] {
  return STATUS_VARIANT_MAP[status] ?? "outline";
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
