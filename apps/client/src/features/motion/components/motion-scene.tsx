import { AnimatePresence, motion } from "framer-motion";

import { useMotionPreference } from "#/features/motion/motion-provider";
import {
  MOTION_DISTANCE,
  MOTION_DURATION,
  MOTION_EASING,
} from "#/features/motion/motion-tokens";

export function MotionScene({
  sceneKey,
  children,
  className,
}: {
  readonly sceneKey?: string;
  readonly children: React.ReactNode;
  readonly className?: string;
}) {
  const { shouldReduceMotion } = useMotionPreference();

  const variants = shouldReduceMotion
    ? {
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { duration: MOTION_DURATION.fast },
        },
        exit: { opacity: 0, transition: { duration: MOTION_DURATION.fast } },
      }
    : {
        hidden: { opacity: 0, y: MOTION_DISTANCE.sm },
        visible: {
          opacity: 1,
          y: 0,
          transition: {
            duration: MOTION_DURATION.normal,
            ease: MOTION_EASING.enter,
          },
        },
        exit: {
          opacity: 0,
          y: -MOTION_DISTANCE.xs,
          transition: {
            duration: MOTION_DURATION.fast,
            ease: MOTION_EASING.exit,
          },
        },
      };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={sceneKey}
        className={className}
        data-motion-scene
        initial="hidden"
        animate="visible"
        exit="exit"
        variants={variants}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
