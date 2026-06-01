import { Flag, Shield, Swords } from "lucide-react";

import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";

type PingPanelProps = {
  activePingTool: "attack" | "defense" | "rally" | null;
  setActivePingTool: (value: "attack" | "defense" | "rally" | null) => void;
};

export function PingPanel({
  activePingTool,
  setActivePingTool,
}: PingPanelProps) {
  return (
    <div className="fixed bottom-4 right-4 z-30 flex flex-col gap-2 rounded-none border border-game-border/80 bg-[rgb(27_27_27/0.76)] p-2 shadow-xl shadow-black/25 backdrop-blur-sm">
      <Button
        type="button"
        variant={activePingTool === "attack" ? "default" : "outline"}
        size="icon"
        onClick={() =>
          setActivePingTool(activePingTool === "attack" ? null : "attack")
        }
        className={cn(
          "size-9 transition-all hover:scale-105 rounded-none",
          activePingTool === "attack"
            ? "ring-2 ring-red-400/50 bg-red-950/20 border-red-400"
            : "border-game-border",
        )}
        title="Mark Attack (Swords) [1]"
      >
        <Swords
          className={cn(
            "size-4 text-red-400",
            activePingTool === "attack" && "animate-pulse",
          )}
        />
      </Button>

      <Button
        type="button"
        variant={activePingTool === "defense" ? "default" : "outline"}
        size="icon"
        onClick={() =>
          setActivePingTool(activePingTool === "defense" ? null : "defense")
        }
        className={cn(
          "size-9 transition-all hover:scale-105 rounded-none",
          activePingTool === "defense"
            ? "ring-2 ring-blue-400/50 bg-blue-950/20 border-blue-400"
            : "border-game-border",
        )}
        title="Mark Defense (Shield) [2]"
      >
        <Shield
          className={cn(
            "size-4 text-blue-400",
            activePingTool === "defense" && "animate-pulse",
          )}
        />
      </Button>

      <Button
        type="button"
        variant={activePingTool === "rally" ? "default" : "outline"}
        size="icon"
        onClick={() =>
          setActivePingTool(activePingTool === "rally" ? null : "rally")
        }
        className={cn(
          "size-9 transition-all hover:scale-105 rounded-none",
          activePingTool === "rally"
            ? "ring-2 ring-green-400/50 bg-green-950/20 border-green-400"
            : "border-game-border",
        )}
        title="Mark Rally (Flag) [3]"
      >
        <Flag
          className={cn(
            "size-4 text-green-400",
            activePingTool === "rally" && "animate-pulse",
          )}
        />
      </Button>
    </div>
  );
}
