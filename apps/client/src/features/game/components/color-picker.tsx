import { PLAYER_COLOR_PALETTE } from "@generals-plus/shared-types";

import { Button } from "#/components/ui/button";

interface ColorPickerProps {
  /** Palette colors already claimed by other players in the current room. */
  takenColors: number[];
  /** The color currently assigned to the local player. */
  currentColor: number;
  /** Sends the selected palette value to the owning queue/setup room. */
  onSelect: (color: number) => void;
}

/**
 * Shared palette picker for official queue and custom setup rooms.
 *
 * The component is intentionally room-agnostic: callers decide whether color
 * choices become queue messages or setup messages. It only enforces local UI
 * affordances such as disabling colors taken by other players and preserving
 * the current player's selected color as pressable/active.
 */
export function ColorPicker({
  takenColors,
  currentColor,
  onSelect,
}: ColorPickerProps) {
  return (
    <fieldset
      className="flex flex-wrap gap-3 border-0 p-0"
      aria-label="Color picker"
    >
      {PLAYER_COLOR_PALETTE.map((c) => {
        const taken = takenColors.includes(c) && c !== currentColor;
        const colorHex = `#${c.toString(16).padStart(6, "0")}`;
        return (
          <Button
            key={c}
            type="button"
            variant="outline"
            size="icon"
            disabled={taken}
            aria-label={`Pick color ${colorHex}`}
            aria-pressed={c === currentColor}
            data-motion-emphasis={c === currentColor ? "selected" : undefined}
            onClick={() => onSelect(c)}
            className={`size-9 rounded-full border transition-[transform,border-color,box-shadow,filter,opacity] duration-(--motion-duration-fast) ease-(--motion-ease-emphasis) ${
              c === currentColor
                ? "scale-105 border-white ring-2 ring-white/50"
                : taken
                  ? "cursor-not-allowed border-transparent opacity-25 grayscale"
                  : "border-white/20 hover:scale-105 hover:border-white/70"
            }`}
            style={{
              backgroundColor: colorHex,
            }}
          />
        );
      })}
    </fieldset>
  );
}
