import type { MotionMode } from "@generals-plus/shared-types";
import { MotionConfig } from "framer-motion";
import { createContext, useContext } from "react";

import { useResolvedMotionPreference } from "#/features/motion/use-motion-preference";

interface MotionPreferenceContextValue {
  readonly mode: MotionMode;
  readonly shouldReduceMotion: boolean;
}

const MotionPreferenceContext = createContext<MotionPreferenceContextValue>({
  mode: "system",
  shouldReduceMotion: false,
});

export function MotionProvider({
  preferenceMode,
  children,
}: {
  readonly preferenceMode?: MotionMode;
  readonly children: React.ReactNode;
}) {
  const value = useResolvedMotionPreference(preferenceMode);

  return (
    <MotionPreferenceContext.Provider value={value}>
      <MotionConfig
        reducedMotion={value.shouldReduceMotion ? "always" : "never"}
      >
        <div data-motion={value.shouldReduceMotion ? "reduced" : "full"}>
          {children}
        </div>
      </MotionConfig>
    </MotionPreferenceContext.Provider>
  );
}

export function useMotionPreference() {
  return useContext(MotionPreferenceContext);
}
