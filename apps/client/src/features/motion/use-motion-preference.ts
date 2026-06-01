import type { MotionMode } from "@generals-plus/shared-types";
import { useEffect, useMemo, useState } from "react";

export function useResolvedMotionPreference(
  preferenceMode: MotionMode = "system",
) {
  const [systemPrefersReduced, setSystemPrefersReduced] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystemPrefersReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return useMemo(() => {
    const shouldReduceMotion =
      preferenceMode === "reduced" ||
      (preferenceMode === "system" && systemPrefersReduced);

    return {
      mode: preferenceMode,
      shouldReduceMotion,
    };
  }, [preferenceMode, systemPrefersReduced]);
}
