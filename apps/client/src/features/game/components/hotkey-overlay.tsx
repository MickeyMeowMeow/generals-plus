import { GridType } from "@generals-plus/engine";
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import {
  ClearMoveQueueKey,
  KeyToDirection,
  KeyToPing,
  SelectPingToolModifier,
  SplitMoveModifier,
  SurrenderKey,
  ToggleHotkeysKey,
  ToggleHotkeysModifier,
} from "#/features/game/config/hotkeys";

interface HotkeyOverlayProps {
  gridType: GridType;
}

/**
 * Maps internal KeyboardEvent.code to user-friendly labels.
 */
function getKeyLabel(code: string): string {
  return code
    .replace("Key", "")
    .replace("Digit", "")
    .replace("ArrowUp", "↑")
    .replace("ArrowDown", "↓")
    .replace("ArrowLeft", "←")
    .replace("ArrowRight", "→")
    .replace("Slash", "?") // Replace with "?" since it's the toggle key for hotkeys
    .replace("Escape", "Esc");
}

function Kbd({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={`pointer-events-none inline-flex h-5 select-none items-center rounded border border-game-border bg-game-surface px-1.5 font-mono text-[10px] font-medium text-game-text shadow-sm ${className}`}
    >
      {children}
    </kbd>
  );
}

/**
 * Renders a group of keys with tight spacing.
 * */
function KbdGroup({ codes }: { codes: string[] }) {
  return (
    <div className="flex -space-x-px">
      {codes.map((code, i) => (
        <Kbd
          key={code}
          className={
            i === 0
              ? "rounded-r-none"
              : i === codes.length - 1
                ? "rounded-l-none"
                : "rounded-none"
          }
        >
          {getKeyLabel(code)}
        </Kbd>
      ))}
    </div>
  );
}

export function HotkeyOverlay({ gridType }: HotkeyOverlayProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const modifier = ToggleHotkeysModifier
        ? e.getModifierState(ToggleHotkeysModifier)
        : true;
      if (modifier && e.code === ToggleHotkeysKey) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const moveCodes = Object.keys(KeyToDirection[gridType]).filter(
    (code) => !code.startsWith("Arrow"),
  );
  const pingCodes = Object.keys(KeyToPing);

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-30">
      <AnimatePresence mode="wait">
        {isOpen ? (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="flex flex-col gap-3 rounded-none border border-game-border/80 bg-[rgb(27_27_27/0.85)] p-4 text-[11px] text-game-text-dim shadow-2xl backdrop-blur-md"
          >
            <h3 className="mb-1 text-xs font-bold tracking-widest uppercase text-game-text/50">
              Command Reference
            </h3>

            <div className="space-y-2">
              {/* Selection */}
              <div className="flex items-center justify-between gap-6">
                <span className="flex gap-1">
                  <Kbd>Click</Kbd>
                </span>
                <span className="text-right">Select cell</span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <span className="flex gap-1">
                  <Kbd>Double Click</Kbd> <Kbd>R-Click</Kbd>
                </span>
                <span className="text-right">Select & toggle split</span>
              </div>

              <div className="h-px bg-game-border/30" />

              {/* Navigation */}
              <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-1.5">
                  <KbdGroup codes={moveCodes} />
                  {gridType === GridType.SQUARE && (
                    <>
                      <span className="opacity-40">/</span>
                      <KbdGroup
                        codes={[
                          "ArrowUp",
                          "ArrowLeft",
                          "ArrowDown",
                          "ArrowRight",
                        ]}
                      />
                    </>
                  )}
                </div>
                <span className="text-right">Move</span>
              </div>

              <div className="flex items-center justify-between gap-6">
                <span className="flex items-center gap-1">
                  <Kbd>{SplitMoveModifier}</Kbd>{" "}
                  <span className="opacity-40">+</span> <span>Move</span>
                </span>
                <span className="text-right">Instant split move</span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <Kbd>{getKeyLabel(ClearMoveQueueKey)}</Kbd>
                <span className="text-right">Clear move queue</span>
              </div>

              <div className="h-px bg-game-border/30" />

              {/* Communication */}
              <div className="flex items-center justify-between gap-6">
                <KbdGroup codes={pingCodes} />
                <span className="text-right">Quick ping</span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <span className="flex items-center gap-1">
                  <Kbd>{SelectPingToolModifier}</Kbd>{" "}
                  <span className="opacity-40">+</span>{" "}
                  <KbdGroup codes={pingCodes} />
                </span>
                <span className="text-right">Select ping tool</span>
              </div>

              <div className="h-px bg-game-border/30" />

              {/* Session */}
              <div className="flex items-center justify-between gap-6">
                <Kbd>{getKeyLabel(SurrenderKey)}</Kbd>
                <span className="text-right">Surrender match</span>
              </div>
            </div>

            <div className="flex items-center gap-1 mt-1 border-t border-game-border/50 pt-2 text-[10px] text-game-text/30 italic">
              <span>Press</span>
              <Kbd>{getKeyLabel(ToggleHotkeysKey)}</Kbd>
              <span>to dismiss</span>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-1 rounded-none border border-game-border/60 bg-[rgb(27_27_27/0.5)] px-2.5 py-1.5 text-[10px] text-game-text-dim backdrop-blur-sm"
          >
            <span>Press</span>
            <Kbd>{getKeyLabel(ToggleHotkeysKey)}</Kbd>
            <span>for controls</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
