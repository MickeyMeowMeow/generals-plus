import { GridType } from "@generals-plus/engine";
import { useEffect, useState } from "react";

interface HotkeyOverlayProps {
  gridType: GridType;
}

export function HotkeyOverlay({ gridType }: HotkeyOverlayProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "?") {
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-30 flex flex-col gap-1.5 rounded-none border border-game-border/80 bg-[rgb(27_27_27/0.76)] p-3 text-xs text-game-text-dim shadow-xl shadow-black/25 backdrop-blur-sm">
      {isOpen ? (
        <>
          <h3 className="mb-1 font-semibold text-game-text">Hotkeys</h3>
          <p>
            <span className="font-mono text-game-text">
              {gridType === GridType.HEX ? "QWEASD" : "WASD"}
            </span>{" "}
            to move
          </p>
          <p>
            <span className="font-mono text-game-text">Shift</span> + move to
            split move
          </p>
          <p>
            <span className="font-mono text-game-text">Double click</span> or{" "}
            <span className="font-mono text-game-text">right click</span> to
            toggle split move
          </p>
          <p>
            <span className="font-mono text-game-text">Space</span> to clear
            move queue
          </p>
          <p>
            <span className="font-mono text-game-text">1/2/3</span> to ping
            attack / defense / rally
          </p>
          <p>
            <span className="font-mono text-game-text">Shift + 1/2/3</span> to
            change ping brush (click to ping)
          </p>
          <p>
            <span className="font-mono text-game-text">Escape</span> to
            surrender
          </p>
        </>
      ) : (
        <p>
          Press <span className="font-mono text-game-text">?</span> for hotkeys
        </p>
      )}
    </div>
  );
}
