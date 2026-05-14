import { PLAYER_COLOR_PALETTE } from "@generals-plus/shared-types";

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
          <button
            key={c}
            type="button"
            disabled={taken}
            aria-label={`Pick color ${colorHex}`}
            aria-pressed={c === currentColor}
            onClick={() => onSelect(c)}
            className={`size-10 rounded-full border-2 shadow-lg transition ${
              c === currentColor
                ? "scale-110 border-white ring-2 ring-amber-200/70"
                : taken
                  ? "cursor-not-allowed border-transparent opacity-25 grayscale"
                  : "cursor-pointer border-white/10 hover:scale-105 hover:border-white/70"
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
