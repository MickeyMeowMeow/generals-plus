import { PLAYER_COLOR_PALETTE } from "@generals-plus/shared-types";

interface ColorPickerProps {
  takenColors: number[];
  currentColor: number;
  onSelect: (color: number) => void;
}

export function ColorPicker({
  takenColors,
  currentColor,
  onSelect,
}: ColorPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {PLAYER_COLOR_PALETTE.map((c) => {
        const taken = takenColors.includes(c) && c !== currentColor;
        return (
          <button
            key={c}
            type="button"
            disabled={taken}
            onClick={() => onSelect(c)}
            className={`h-8 w-8 rounded-full border-2 ${
              c === currentColor
                ? "border-white"
                : taken
                  ? "border-transparent opacity-30 cursor-not-allowed"
                  : "border-transparent cursor-pointer hover:border-white/50"
            }`}
            style={{
              backgroundColor: `#${c.toString(16).padStart(6, "0")}`,
            }}
          />
        );
      })}
    </div>
  );
}
