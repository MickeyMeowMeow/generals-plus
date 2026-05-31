import { GridType } from "@generals-plus/engine";

import { Checkbox } from "#/components/ui/checkbox";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import { GAME_MODE_OPTIONS } from "#/config/ui-constants";
import { useEditorStore } from "#/features/map-editor/store/editor-store";

export function MapMetadataPanel() {
  const name = useEditorStore((s) => s.name);
  const description = useEditorStore((s) => s.description);
  const setName = useEditorStore((s) => s.setName);
  const setDescription = useEditorStore((s) => s.setDescription);
  const gridType = useEditorStore((s) => s.gridType);
  const bounds = useEditorStore((s) => s.bounds);
  const setGridType = useEditorStore((s) => s.setGridType);
  const setSquareBounds = useEditorStore((s) => s.setSquareBounds);
  const setHexBounds = useEditorStore((s) => s.setHexBounds);
  const supportedModes = useEditorStore((s) => s.supportedModes);
  const setSupportedModes = useEditorStore((s) => s.setSupportedModes);

  return (
    <div className="grid gap-3 p-3">
      <div>
        <Label className="text-xs text-game-text-dim">Name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8 border-game-border bg-game-bg text-sm text-game-text"
        />
      </div>

      <div>
        <Label className="text-xs text-game-text-dim">Description</Label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="h-8 border-game-border bg-game-bg text-sm text-game-text"
        />
      </div>

      <div>
        <Label className="text-xs text-game-text-dim">Grid Type</Label>
        <Select
          value={gridType}
          onValueChange={(v) => setGridType(v as GridType)}
        >
          <SelectTrigger
            size="sm"
            className="h-8 border-game-border bg-game-bg px-2 text-xs text-game-text"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-game-border bg-game-surface text-game-text">
            <SelectItem value={GridType.SQUARE}>Square</SelectItem>
            <SelectItem value={GridType.HEX}>Hex</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {gridType === GridType.SQUARE ? (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-game-text-dim">Width</Label>
            <Input
              type="number"
              min={5}
              max={100}
              value={(bounds as { width: number }).width}
              onChange={(e) =>
                setSquareBounds({
                  width: Math.max(5, Math.min(100, Number(e.target.value))),
                  height: (bounds as { height: number }).height,
                })
              }
              className="h-8 border-game-border bg-game-bg text-sm text-game-text"
            />
          </div>
          <div>
            <Label className="text-xs text-game-text-dim">Height</Label>
            <Input
              type="number"
              min={5}
              max={100}
              value={(bounds as { height: number }).height}
              onChange={(e) =>
                setSquareBounds({
                  width: (bounds as { width: number }).width,
                  height: Math.max(5, Math.min(100, Number(e.target.value))),
                })
              }
              className="h-8 border-game-border bg-game-bg text-sm text-game-text"
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {(["left", "right", "leftSlant", "rightSlant"] as const).map(
            (key) => (
              <div key={key}>
                <Label className="text-xs text-game-text-dim">{key}</Label>
                <Input
                  type="number"
                  min={1}
                  value={(bounds as unknown as Record<string, number>)[key]}
                  onChange={(e) =>
                    setHexBounds({
                      ...(bounds as {
                        left: number;
                        right: number;
                        leftSlant: number;
                        rightSlant: number;
                      }),
                      [key]: Math.max(1, Number(e.target.value)),
                    })
                  }
                  className="h-8 border-game-border bg-game-bg text-sm text-game-text"
                />
              </div>
            ),
          )}
        </div>
      )}

      <div>
        <Label className="text-xs text-game-text-dim">Supported Modes</Label>
        <div className="mt-1 grid grid-cols-2 gap-1.5">
          {GAME_MODE_OPTIONS.filter((m) => !m.isVsAi).map((mode) => {
            const active = supportedModes.includes(mode.id);
            return (
              <label
                key={mode.id}
                htmlFor={`mode-chk-${mode.id}`}
                className="flex cursor-pointer items-center gap-2 border border-game-border bg-game-bg px-2 py-1.5 text-xs text-game-text transition-colors hover:bg-game-surface"
              >
                <Checkbox
                  id={`mode-chk-${mode.id}`}
                  checked={active}
                  onCheckedChange={(checked) => {
                    if (checked === true) {
                      setSupportedModes([...supportedModes, mode.id]);
                    } else {
                      setSupportedModes(
                        supportedModes.filter((m) => m !== mode.id),
                      );
                    }
                  }}
                />
                <span className="select-none">{mode.label}</span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
