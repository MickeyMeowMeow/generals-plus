import type { CustomMap } from "@generals-plus/shared-types";
import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "#/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { useUser } from "#/features/auth/hooks";
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
  const isAdmin = useUser((user) => user?.isAdmin ?? false);

  const [maps, setMaps] = useState<CustomMap[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 8; // Compact size for dialog

  // Handle Search Debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Reset page when search changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const loadMaps = useCallback(() => {
    setLoading(true);
    setError(null);
    mapsApi
      .list({ sort: "plays", limit, page, search: debouncedSearch })
      .then((res) => {
        setMaps(res.maps);
        setTotal(res.total);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load maps"),
      )
      .finally(() => setLoading(false));
  }, [page, debouncedSearch]);

  useEffect(() => {
    if (!open) return;
    loadMaps();
  }, [open, loadMaps]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-h-[85vh] flex flex-col border-game-border bg-game-surface text-game-text sm:max-w-3xl overflow-hidden"
        aria-describedby={undefined}
        showCloseButton={true}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>Select a custom map</DialogTitle>
        </DialogHeader>

        {/* Search bar */}
        <div className="my-2 shrink-0">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search maps by name, author, or description..."
            className="border-game-border bg-game-bg text-game-text placeholder:text-game-text-dim focus-visible:ring-white/20"
          />
        </div>

        {/* Scrollable Map List */}
        <div className="flex-1 overflow-y-auto min-h-0 py-2">
          {loading && (
            <p className="text-game-text-dim text-center py-4">Loading...</p>
          )}
          {error && <p className="text-red-400 text-center py-4">{error}</p>}
          {!loading && !error && maps.length === 0 && (
            <p className="text-game-text-dim text-center py-4">
              No published maps found.
            </p>
          )}

          {!loading && !error && maps.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {maps.map((map) => (
                <div key={map.id} className="relative group">
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(map);
                      onClose();
                    }}
                    className="w-full h-full border border-game-border bg-game-bg p-3 pr-10 text-left hover:bg-game-surface transition-colors flex flex-col justify-between"
                  >
                    <div>
                      <h4 className="font-semibold text-sm line-clamp-1">
                        {map.name}
                      </h4>
                      <p className="text-[11px] text-game-text-dim">
                        by {map.authorName} ·{" "}
                        {map.minPlayers === map.maxPlayers
                          ? `${map.minPlayers} players`
                          : `${map.minPlayers}-${map.maxPlayers} players`}
                      </p>
                      {map.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-game-text-dim">
                          {map.description}
                        </p>
                      )}
                    </div>
                    <p className="mt-1.5 text-[10px] text-game-text-dim/80 self-start">
                      modes: {map.supportedModes.join(", ") || "—"}
                    </p>
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (
                          confirm(
                            `Delete map "${map.name}"? This cannot be undone.`,
                          )
                        ) {
                          try {
                            await mapsApi.remove(map.id);
                            loadMaps();
                          } catch (err) {
                            alert(
                              err instanceof Error
                                ? err.message
                                : "Delete failed",
                            );
                          }
                        }
                      }}
                      className="absolute right-2 top-2 p-1.5 text-red-400 hover:text-red-300 hover:bg-white/10 rounded transition-colors"
                      title="Delete map as Administrator"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination & Close Controls */}
        <div className="mt-3 border-t border-game-border pt-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page === 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-8 border-game-border bg-game-bg text-game-text"
            >
              Prev
            </Button>
            <span className="text-xs text-game-text-dim">
              Page {page} of {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="h-8 border-game-border bg-game-bg text-game-text"
            >
              Next
            </Button>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-8 border-game-border bg-game-bg text-game-text"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
