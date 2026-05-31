import type { CustomMap } from "@generals-plus/shared-types";
import { useEffect, useState } from "react";

import { Button } from "#/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { mapsApi } from "#/features/map-editor/api/maps-api";

interface MapPickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (map: CustomMap) => void;
}

export function MapPickerDialog({
  open,
  onClose,
  onSelect,
}: MapPickerDialogProps) {
  const [maps, setMaps] = useState<CustomMap[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    mapsApi
      .list({ sort: "plays", limit: 50 })
      .then((res) => setMaps(res.maps))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load maps"),
      )
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-h-[80vh] overflow-auto border-game-border bg-game-surface text-game-text sm:max-w-3xl"
        aria-describedby={undefined}
        showCloseButton={true}
      >
        <DialogHeader>
          <DialogTitle>Select a custom map</DialogTitle>
        </DialogHeader>

        {loading && <p className="text-game-text-dim">Loading...</p>}
        {error && <p className="text-red-400">{error}</p>}
        {!loading && !error && maps.length === 0 && (
          <p className="text-game-text-dim">No published maps available yet.</p>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          {maps.map((map) => (
            <button
              type="button"
              key={map.id}
              onClick={() => {
                onSelect(map);
                onClose();
              }}
              className="border border-game-border bg-game-bg p-3 text-left hover:bg-game-surface"
            >
              <h4 className="font-semibold">{map.name}</h4>
              <p className="text-xs text-game-text-dim">
                by {map.authorName} ·{" "}
                {map.minPlayers === map.maxPlayers
                  ? `${map.minPlayers} players`
                  : `${map.minPlayers}-${map.maxPlayers} players`}
              </p>
              <p className="text-xs text-game-text-dim">
                modes: {map.supportedModes.join(", ") || "—"}
              </p>
              {map.description && (
                <p className="mt-1 line-clamp-2 text-sm text-game-text-dim">
                  {map.description}
                </p>
              )}
            </button>
          ))}
        </div>

        <div className="mt-3 text-right">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
