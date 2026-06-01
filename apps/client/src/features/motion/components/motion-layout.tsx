import { motion } from "framer-motion";
import type { ReactNode } from "react";

import { useMotionPreference } from "#/features/motion/motion-provider";
import { MOTION_LAYOUT_TRANSITION } from "#/features/motion/motion-tokens";

interface MotionLayoutProps {
  children: ReactNode;
  className?: string;
}

/**
 * Layout-aware wrapper that smoothly animates size and position changes.
 *
 * Uses framer-motion's `layout` prop (FLIP animation). Falls back to a plain
 * div with no animation when reduced motion is preferred.
 */
export function MotionLayout({ children, className }: MotionLayoutProps) {
  const { shouldReduceMotion } = useMotionPreference();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      layout
      transition={{ layout: MOTION_LAYOUT_TRANSITION }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
