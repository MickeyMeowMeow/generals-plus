import { Terrain } from "@generals-plus/engine";
import { Redo, Undo } from "lucide-react";
import { useState } from "react";

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
import type { EditorTool } from "#/features/map-editor/store/editor-store";
import { useEditorStore } from "#/features/map-editor/store/editor-store";
import { cn } from "#/lib/utils";

const TERRAIN_PALETTE: { terrain: Terrain; label: string; color: string }[] = [
  { terrain: Terrain.PLAIN, label: "Plain", color: "#d8dde3" },
  { terrain: Terrain.MOUNTAIN, label: "Mountain", color: "#9da8b6" },
  { terrain: Terrain.SWAMP, label: "Swamp", color: "#4f8a6f" },
  { terrain: Terrain.DESERT, label: "Desert", color: "#e5cf8d" },
  { terrain: Terrain.VOID, label: "Void", color: "#111111" },
  { terrain: Terrain.FLAG, label: "Flag", color: "#8aa4c8" },
];

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

  const ToolButton = ({
    target,
    children,
    className,
  }: {
    target: EditorTool;
    children: React.ReactNode;
    className?: string;
  }) => (
    <Button
      type="button"
      variant="outline"
      onClick={() => setTool(target)}
      className={cn(
        "h-9 justify-start gap-2 border-game-border bg-game-bg text-game-text hover:bg-game-surface",
        toolMatches(tool, target) && "ring-2 ring-white/70",
        className,
      )}
    >
      {children}
    </Button>
  );

  return (
    <div className="grid gap-3 p-3">
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={undo}
          className="h-8 border-game-border bg-game-bg text-game-text"
        >
          <Undo className="size-4" /> Undo
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={redo}
          className="h-8 border-game-border bg-game-bg text-game-text"
        >
          <Redo className="size-4" /> Redo
        </Button>
      </div>

      <div>
        <Label className="text-xs text-game-text-dim">Terrain</Label>
        <div className="mt-1 grid grid-cols-2 gap-1.5">
          {TERRAIN_PALETTE.map((t) => (
            <ToolButton
              key={t.terrain}
              target={{ kind: "terrain", terrain: t.terrain }}
            >
              <span
                className="inline-block size-4 border border-black/30"
                style={{ background: t.color }}
              />
              {t.label}
            </ToolButton>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-xs text-game-text-dim">City</Label>
        <div className="mt-1 grid grid-cols-[1fr_auto] gap-2">
          <Input
            type="number"
            min={0}
            value={cityTroops}
            onChange={(e) => setCityTroops(Number(e.target.value))}
            className="h-8 border-game-border bg-game-bg text-sm text-game-text"
          />
          <ToolButton
            target={{ kind: "city", troopCount: cityTroops }}
            className="px-3"
          >
            Place City
          </ToolButton>
        </div>
      </div>

      <div>
        <Label className="text-xs text-game-text-dim">General (spawn)</Label>
        <div className="mt-1 grid grid-cols-[1fr_1fr_auto] gap-2">
          <Select value={generalTeam} onValueChange={setGeneralTeam}>
            <SelectTrigger
              size="sm"
              className="h-8 border-game-border bg-game-bg px-2 text-xs text-game-text"
            >
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
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            min={0}
            value={generalSlot}
            onChange={(e) => setGeneralSlot(Number(e.target.value))}
            className="h-8 border-game-border bg-game-bg text-sm text-game-text"
          />
          <ToolButton
            target={{ kind: "general", teamId: generalTeam, slot: generalSlot }}
            className="px-3"
          >
            Place
          </ToolButton>
        </div>
      </div>

      <div>
        <Label className="text-xs text-game-text-dim">Mode elements</Label>
        <div className="mt-1 grid grid-cols-2 gap-1.5">
          <ToolButton target={{ kind: "bombSite" }}>Bomb Site</ToolButton>
          <ToolButton target={{ kind: "erase" }}>Erase</ToolButton>
        </div>
      </div>

      {supportedModes.some((m) => m === "payload") && (
        <div>
          <Label className="text-xs text-game-text-dim">Payload track</Label>
          <div className="mt-1 grid grid-cols-2 gap-1.5">
            <ToolButton target={{ kind: "trackAdd" }}>+ Track</ToolButton>
            <ToolButton target={{ kind: "trackRemove" }}>- Track</ToolButton>
          </div>
        </div>
      )}
    </div>
  );
}
