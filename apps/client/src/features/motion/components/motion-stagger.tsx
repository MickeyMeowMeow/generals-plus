import { motion } from "framer-motion";

import { useMotionPreference } from "#/features/motion/motion-provider";
import {
  MOTION_DURATION,
  MOTION_EASING,
} from "#/features/motion/motion-tokens";

export function MotionStaggerGroup({
  children,
  className,
}: {
  readonly children: React.ReactNode;
  readonly className?: string;
}) {
  const { shouldReduceMotion } = useMotionPreference();

  return (
    <motion.div
      className={className}
      data-motion-stagger-group
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: shouldReduceMotion
            ? { staggerChildren: 0 }
            : {
                staggerChildren: 0.05,
                delayChildren: 0.03,
              },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export function MotionStaggerItem({
  children,
  className,
}: {
  readonly children: React.ReactNode;
  readonly className?: string;
}) {
  const { shouldReduceMotion } = useMotionPreference();

  return (
    <motion.div
      className={className}
      variants={{
        hidden: shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 },
        visible: {
          opacity: 1,
          y: 0,
          transition: {
            duration: MOTION_DURATION.normal,
            ease: MOTION_EASING.enter,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}
