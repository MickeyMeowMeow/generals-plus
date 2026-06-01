import { AnimatePresence, motion } from "framer-motion";
import type { ComponentPropsWithoutRef } from "react";
import { useEffect, useRef } from "react";

import { useMotionPreference } from "#/features/motion/motion-provider";
import {
  MOTION_DISTANCE,
  MOTION_DURATION,
  MOTION_EASING,
} from "#/features/motion/motion-tokens";
import { cn } from "#/lib/utils";

type RollDirection = "up" | "down";

interface AnimatedNumberProps
  extends Omit<ComponentPropsWithoutRef<"span">, "children"> {
  /** Final formatted display value rendered by the caller. */
  readonly value: string | number;
  /** Optional classes applied to each separator or digit cell. */
  readonly cellClassName?: string;
  /** Optional explicit direction override for value changes. */
  readonly direction?: RollDirection | "auto";
}

interface NumberToken {
  readonly kind: "digits" | "separator";
  readonly key: string;
  readonly value: string;
}

interface DigitCell {
  readonly key: string;
  readonly nextChar: string;
  readonly changed: boolean;
}

/**
 * Splits a formatted value into digit runs and separator runs so mixed content
 * like `1:05` and `3 / 8` can keep punctuation stable while digits animate.
 */
function tokenizeNumberString(value: string): NumberToken[] {
  const matches = value.match(/\d+|\D+/g);

  if (!matches) {
    return [{ kind: "separator", key: "separator-0", value }];
  }

  let offset = 0;

  return matches.map((part) => {
    const token = {
      kind: /^\d+$/.test(part) ? "digits" : "separator",
      key: `${offset}-${part}`,
      value: part,
    } satisfies NumberToken;
    offset += part.length;
    return token;
  });
}

/**
 * Resolves the visual roll direction from the previous and next formatted
 * values by comparing their digit-only numeric meaning.
 */
function resolveRollDirection(
  previousValue: string,
  nextValue: string,
  direction: RollDirection | "auto",
): RollDirection {
  if (direction !== "auto") {
    return direction;
  }

  const previousDigits = Number(previousValue.replace(/\D/g, ""));
  const nextDigits = Number(nextValue.replace(/\D/g, ""));

  if (
    Number.isFinite(previousDigits) &&
    Number.isFinite(nextDigits) &&
    nextDigits < previousDigits
  ) {
    return "down";
  }

  return "up";
}

/**
 * Builds right-aligned digit cells so trailing positions stay stable when a
 * numeric run grows or shrinks, such as `9 -> 10`.
 */
function buildDigitCells(
  previousValue: string,
  nextValue: string,
  tokenIndex: number,
): DigitCell[] {
  const maxLength = Math.max(previousValue.length, nextValue.length);

  return Array.from({ length: maxLength }, (_, offset) => {
    const previousChar =
      previousValue[previousValue.length - maxLength + offset] ?? null;
    const nextChar = nextValue[nextValue.length - maxLength + offset] ?? "";

    return {
      key: `${tokenIndex}-${offset}-${nextChar || "empty"}`,
      nextChar,
      changed: previousChar !== nextChar,
    };
  }).filter((cell) => cell.nextChar !== "");
}

/** Display-only per-digit rolling number for HUD-style numeric surfaces. */
export function AnimatedNumber({
  value,
  className,
  cellClassName,
  direction = "auto",
  ...props
}: AnimatedNumberProps) {
  const { shouldReduceMotion } = useMotionPreference();
  const nextValue = String(value);
  const previousValueRef = useRef(nextValue);

  const previousTokens = tokenizeNumberString(previousValueRef.current);
  const nextTokens = tokenizeNumberString(nextValue);
  const rollDirection = resolveRollDirection(
    previousValueRef.current,
    nextValue,
    direction,
  );

  useEffect(() => {
    previousValueRef.current = nextValue;
  }, [nextValue]);

  return (
    <span
      role="img"
      aria-label={nextValue}
      data-animated-number="true"
      className={cn("inline-flex items-baseline whitespace-pre", className)}
      {...props}
    >
      {nextTokens.map((nextToken, tokenIndex) => {
        const previousToken = previousTokens[tokenIndex] ?? {
          kind: nextToken.kind,
          key: `previous-${nextToken.key}`,
          value: "",
        };

        if (nextToken.kind === "separator") {
          return (
            <span
              key={`separator-${nextToken.key}`}
              data-animated-kind="separator"
              className={cellClassName}
            >
              {nextToken.value}
            </span>
          );
        }

        const cells = buildDigitCells(
          previousToken.value,
          nextToken.value,
          tokenIndex,
        );

        return (
          <span key={`digits-${nextToken.key}`} className="inline-flex">
            {cells.map((cell) => {
              if (!cell.changed || shouldReduceMotion) {
                return (
                  <span
                    key={cell.key}
                    data-animated-kind="digit"
                    className={cellClassName}
                  >
                    {cell.nextChar}
                  </span>
                );
              }

              return (
                <span
                  key={cell.key}
                  data-animated-kind="digit"
                  data-roll-direction={rollDirection}
                  className={cn(
                    "relative inline-flex h-[1em] overflow-hidden align-baseline",
                    cellClassName,
                  )}
                >
                  <AnimatePresence initial={false} mode="popLayout">
                    <motion.span
                      key={cell.nextChar}
                      initial={{
                        y:
                          rollDirection === "up"
                            ? MOTION_DISTANCE.xs
                            : -MOTION_DISTANCE.xs,
                        opacity: 0,
                      }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{
                        y:
                          rollDirection === "up"
                            ? -MOTION_DISTANCE.xs
                            : MOTION_DISTANCE.xs,
                        opacity: 0,
                      }}
                      transition={{
                        duration: MOTION_DURATION.fast,
                        ease: MOTION_EASING.enter,
                      }}
                      className="inline-block"
                    >
                      {cell.nextChar}
                    </motion.span>
                  </AnimatePresence>
                </span>
              );
            })}
          </span>
        );
      })}
    </span>
  );
}
