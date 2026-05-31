import { Terrain } from "@generals-plus/engine";
import { Ban, Eraser, Grid, Redo, Route, Trash2, Undo } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import {
  bombNormalIcon,
  cityIcon,
  crownIcon,
  desertIcon,
  flagIcon,
  mountainIcon,
  swampIcon,
} from "#/features/game/assets";
import type { EditorTool } from "#/features/map-editor/store/editor-store";
import { useEditorStore } from "#/features/map-editor/store/editor-store";
import { cn } from "#/lib/utils";

function toolMatches(a: EditorTool, b: EditorTool): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "terrain" && b.kind === "terrain")
    return a.terrain === b.terrain;
  if (a.kind === "city" && b.kind === "city")
    return a.troopCount === b.troopCount;
  if (a.kind === "general" && b.kind === "general")
    return a.teamId === b.teamId && a.slot === b.slot;
  return true;
}

export function ToolPalette() {
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const supportedModes = useEditorStore((s) => s.supportedModes);

  const [cityTroops, setCityTroops] = useState(50);
  const [generalTeam, setGeneralTeam] = useState("team_0");
  const [generalSlot, setGeneralSlot] = useState(0);

  // Sync inputs with the store's current active tool state
  useEffect(() => {
    if (tool.kind === "general") {
      setGeneralTeam(tool.teamId);
      setGeneralSlot(tool.slot);
    } else if (tool.kind === "city") {
      setCityTroops(tool.troopCount);
    }
  }, [tool]);

  const handleTeamSelect = (teamId: string) => {
    setGeneralTeam(teamId);
    setGeneralSlot(0); // Reset index to 0 when team changes
    setTool({ kind: "general", teamId, slot: 0 });
  };

  const handleSlotChange = (slotVal: number) => {
    const val = Math.max(0, slotVal);
    setGeneralSlot(val);
    setTool({ kind: "general", teamId: generalTeam, slot: val });
  };

  const handleCityTroopsChange = (troops: number) => {
    const val = Math.max(0, troops);
    setCityTroops(val);
    setTool({ kind: "city", troopCount: val });
  };

  const ToolButton = ({
    target,
    label,
    color,
    lucideIcon: LucideIcon,
    gameIcon,
    className,
  }: {
    target: EditorTool;
    label: string;
    color?: string;
    lucideIcon?: React.ComponentType<{ className?: string }>;
    gameIcon?: string;
    className?: string;
  }) => {
    const isSelected = toolMatches(tool, target);
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => setTool(target)}
        className={cn(
          "h-8 justify-start gap-2 border-game-border bg-game-bg text-game-text hover:bg-game-surface hover:text-white transition-colors text-xs px-2.5",
          isSelected &&
            "ring-2 ring-white/60 bg-white/10 text-white font-medium border-white/30",
          className,
        )}
      >
        {gameIcon ? (
          <img
            src={gameIcon}
            className="size-4.5 object-contain"
            style={{ filter: "brightness(0) invert(1)" }}
            alt={label}
          />
        ) : LucideIcon ? (
          <LucideIcon className="size-4 opacity-80" />
        ) : color ? (
          <span
            className="inline-block size-3 rounded-sm border border-black/30 shadow-inner"
            style={{ background: color }}
          />
        ) : null}
        <span className="truncate">{label}</span>
      </Button>
    );
  };

  const showFlag = supportedModes.includes("domination");
  const showBomb = supportedModes.includes("demolition");
  const showTrack = supportedModes.includes("payload");
  const showModeObjectivesSection = showFlag || showBomb || showTrack;

  return (
    <div className="flex flex-col gap-5 p-4 bg-game-surface h-full">
      {/* Undo/Redo Header - Left Aligned */}
      <div className="flex gap-2 border-b border-game-border/30 pb-3">
        <Button
          type="button"
          variant="outline"
          onClick={undo}
          className="flex-1 h-8 justify-start px-2.5 gap-2 border-game-border bg-game-bg text-game-text hover:bg-game-surface hover:text-white transition-colors text-xs"
        >
          <Undo className="size-3.5" /> Undo
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={redo}
          className="flex-1 h-8 justify-start px-2.5 gap-2 border-game-border bg-game-bg text-game-text hover:bg-game-surface hover:text-white transition-colors text-xs"
        >
          <Redo className="size-3.5" /> Redo
        </Button>
      </div>

      {/* 1. Base Terrains */}
      <div className="flex flex-col gap-2">
        <Label className="text-xs font-bold tracking-wider text-game-text-dim uppercase">
          Base Terrains
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {/* Plain */}
          <ToolButton
            target={{ kind: "terrain", terrain: Terrain.PLAIN }}
            label="Plain"
            color="#d8dde3"
            lucideIcon={Grid}
          />
          {/* Mountain */}
          <ToolButton
            target={{ kind: "terrain", terrain: Terrain.MOUNTAIN }}
            label="Mountain"
            color="#9da8b6"
            gameIcon={mountainIcon}
          />
          {/* Swamp */}
          <ToolButton
            target={{ kind: "terrain", terrain: Terrain.SWAMP }}
            label="Swamp"
            color="#4f8a6f"
            gameIcon={swampIcon}
          />
          {/* Desert */}
          <ToolButton
            target={{ kind: "terrain", terrain: Terrain.DESERT }}
            label="Desert"
            color="#e5cf8d"
            gameIcon={desertIcon}
          />
          {/* Void */}
          <ToolButton
            target={{ kind: "terrain", terrain: Terrain.VOID }}
            label="Void"
            color="#111111"
            lucideIcon={Ban}
          />
        </div>
      </div>

      {/* 2. Structures & Players */}
      <div className="flex flex-col gap-3 border-t border-game-border/30 pt-3">
        <Label className="text-xs font-bold tracking-wider text-game-text-dim uppercase">
          Structures & Players
        </Label>

        {/* City Tool Row: Left is 70px troops input, Right is wider Place City button */}
        <div>
          <Label className="text-xs text-game-text-dim">Neutral City</Label>
          <div className="mt-1 grid grid-cols-[70px_1fr] gap-1.5">
            <Input
              type="number"
              min={0}
              value={cityTroops}
              onChange={(e) => handleCityTroopsChange(Number(e.target.value))}
              className="h-8 border-game-border bg-game-bg text-xs text-game-text text-left px-2.5 w-full"
              placeholder="Troops"
            />
            <ToolButton
              target={{ kind: "city", troopCount: cityTroops }}
              label="Place City"
              gameIcon={cityIcon}
              className="w-full"
            />
          </div>
        </div>

        {/* General Spawn Tool Row: Team is 100px, Slot is 50px, Place is wider 1fr */}
        <div>
          <Label className="text-xs text-game-text-dim">General (spawn)</Label>
          <div className="mt-1 grid grid-cols-[100px_50px_1fr] gap-1.5">
            <Select value={generalTeam} onValueChange={handleTeamSelect}>
              <SelectTrigger className="h-8 border-game-border bg-game-bg px-2.5 text-xs text-game-text focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 w-full py-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-game-border bg-game-surface text-game-text">
                {[
                  "team_0",
                  "team_1",
                  "team_2",
                  "team_3",
                  "attackers",
                  "defenders",
                ].map((t) => (
                  <SelectItem key={t} value={t} className="text-xs">
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={0}
              value={generalSlot}
              onChange={(e) => handleSlotChange(Number(e.target.value))}
              className="h-8 border-game-border bg-game-bg text-xs text-game-text text-left px-2.5 w-full"
              placeholder="Slot"
            />
            <ToolButton
              target={{
                kind: "general",
                teamId: generalTeam,
                slot: generalSlot,
              }}
              label="Place"
              gameIcon={crownIcon}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* 3. Game Mode Objectives (Conditional) */}
      {showModeObjectivesSection && (
        <div className="flex flex-col gap-2 border-t border-game-border/30 pt-3">
          <Label className="text-xs font-bold tracking-wider text-game-text-dim uppercase">
            Game Mode Objectives
          </Label>
          <div className="flex flex-col gap-2">
            {/* Flag Card */}
            {showFlag && (
              <div className="bg-game-bg/40 border border-game-border/40 rounded-lg p-2.5 flex flex-col gap-2">
                <span className="text-[10px] font-bold text-game-text flex items-center gap-1.5 uppercase tracking-wide">
                  <img
                    src={flagIcon}
                    className="size-3.5 object-contain"
                    style={{ filter: "brightness(0) invert(1)" }}
                    alt="Flag"
                  />
                  Domination Flag
                </span>
                <ToolButton
                  target={{ kind: "terrain", terrain: Terrain.FLAG }}
                  label="Place Flag"
                  gameIcon={flagIcon}
                  className="w-full"
                />
              </div>
            )}

            {/* Bomb Site Card */}
            {showBomb && (
              <div className="bg-game-bg/40 border border-game-border/40 rounded-lg p-2.5 flex flex-col gap-2">
                <span className="text-[10px] font-bold text-game-text flex items-center gap-1.5 uppercase tracking-wide">
                  <img
                    src={bombNormalIcon}
                    className="size-3.5 object-contain"
                    style={{ filter: "brightness(0) invert(1)" }}
                    alt="Bomb"
                  />
                  Demolition Objective
                </span>
                <ToolButton
                  target={{ kind: "bombSite" }}
                  label="Place Bomb Site"
                  gameIcon={bombNormalIcon}
                  className="w-full"
                />
              </div>
            )}

            {/* Payload Track Card */}
            {showTrack && (
              <div className="bg-game-bg/40 border border-game-border/40 rounded-lg p-2.5 flex flex-col gap-2">
                <span className="text-[10px] font-bold text-game-text flex items-center gap-1.5 uppercase tracking-wide">
                  <Route className="size-3.5 text-white/80" />
                  Payload Track Route
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <ToolButton
                    target={{ kind: "trackAdd" }}
                    label="+ Track"
                    lucideIcon={Route}
                  />
                  <ToolButton
                    target={{ kind: "trackRemove" }}
                    label="- Track"
                    lucideIcon={Trash2}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Utilities */}
      <div className="flex flex-col gap-2 border-t border-game-border/30 pt-3 mt-auto">
        <div className="grid grid-cols-2 gap-2">
          <ToolButton
            target={{ kind: "erase" }}
            label="Erase Cell"
            lucideIcon={Eraser}
            className="border-red-950/20 hover:border-red-900/30 text-red-200"
          />
        </div>
      </div>
    </div>
  );
}

export default ToolPalette;
