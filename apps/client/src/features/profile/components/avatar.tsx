import type { AvatarPreference } from "@generals-plus/shared-types";
import { User } from "lucide-react";
import type { CSSProperties } from "react";

import { resolveAvatarUrl } from "#/features/profile/utils/avatar";

type AvatarSize = "sm" | "md" | "lg";

const SIZE_MAP: Record<AvatarSize, { box: string; icon: string }> = {
  sm: { box: "size-8", icon: "size-6" },
  md: { box: "size-10", icon: "size-7.5" },
  lg: { box: "size-16", icon: "size-12" },
};

interface AvatarProps {
  preferences: AvatarPreference | undefined;
  size?: AvatarSize;
  className?: string;
  style?: CSSProperties;
}

export function Avatar({
  preferences,
  size = "md",
  className,
  style,
}: AvatarProps) {
  const url = resolveAvatarUrl(preferences);
  const { box, icon } = SIZE_MAP[size];

  if (url) {
    return (
      <img
        src={url}
        alt=""
        className={`${box} shrink-0 rounded-none object-cover ${className ?? ""}`}
        style={style}
      />
    );
  }

  return (
    <div
      className={`flex ${box} shrink-0 items-center justify-center rounded-none bg-transparent ${className ?? ""}`}
      style={style}
    >
      <User className={`${icon} text-game-text-dim`} />
    </div>
  );
}
