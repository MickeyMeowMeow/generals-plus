import type { CustomMap } from "@generals-plus/shared-types";
import { ArrowLeft, Heart, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

import { Button } from "#/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import type { SystemSettings } from "#/features/admin/api/system-settings-api";
import { systemSettingsApi } from "#/features/admin/api/system-settings-api";
import { AuthStatus } from "#/features/auth/auth-store";
import { useAuth, useUser } from "#/features/auth/hooks";
import { mapsApi } from "#/features/map-editor/api/maps-api";

type SortOption = "date" | "plays" | "likes";

export function MapBrowserPage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const userId = useUser((u) => u?.id);
  const isAdmin = useUser((u) => u?.isAdmin ?? false);

  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [maps, setMaps] = useState<CustomMap[]>([]);

  useEffect(() => {
    systemSettingsApi
      .get()
      .then(setSettings)
      .catch(() => {});
  }, []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortOption>("date");
  const [total, setTotal] = useState(0);
  const limit = 12;

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    mapsApi
      .list({ page, limit, sort })
      .then((res) => {
        setMaps(res.maps);
        setTotal(res.total);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load maps");
      })
      .finally(() => setLoading(false));
  }, [page, sort]);

  useEffect(() => {
    load();
  }, [load]);

  const onDelete = async (id: string) => {
    if (!confirm("Delete this map? This cannot be undone.")) return;
    try {
      await mapsApi.remove(id);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const onLike = async (id: string) => {
    try {
      await mapsApi.toggleLike(id);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Like failed");
    }
  };

  return (
    <div className="min-h-screen bg-game-bg text-game-text">
      <header className="flex items-center justify-between border-b border-game-border bg-game-surface px-4 py-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="size-4" />
              Back
            </Link>
          </Button>
          <h1 className="text-lg font-semibold">Custom Maps</h1>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={sort}
            onValueChange={(val) => setSort(val as SortOption)}
          >
            <SelectTrigger className="h-8 border-game-border bg-game-bg px-2.5 text-xs text-game-text focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 w-[120px] py-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-game-border bg-game-surface text-game-text">
              <SelectItem value="date" className="text-xs">
                Newest
              </SelectItem>
              <SelectItem value="plays" className="text-xs">
                Most plays
              </SelectItem>
              <SelectItem value="likes" className="text-xs">
                Most likes
              </SelectItem>
            </SelectContent>
          </Select>
          {state.status === AuthStatus.AUTHENTICATED && (
            <Button
              asChild={settings ? settings.allowMapCreation || isAdmin : true}
              onClick={(e) => {
                if (settings && !settings.allowMapCreation && !isAdmin) {
                  e.preventDefault();
                  toast.error(
                    "Map creation is temporarily disabled by administrator.",
                  );
                }
              }}
              className={
                settings && !settings.allowMapCreation && !isAdmin
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }
            >
              {settings && !settings.allowMapCreation && !isAdmin ? (
                <span className="flex items-center gap-1.5 cursor-not-allowed">
                  <Plus className="size-4" />
                  New Map
                </span>
              ) : (
                <Link to="/map-editor">
                  <Plus className="size-4" />
                  New Map
                </Link>
              )}
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4">
        {loading && (
          <p className="text-center text-game-text-dim">Loading...</p>
        )}
        {error && <p className="text-center text-red-400">{error}</p>}
        {!loading && !error && maps.length === 0 && (
          <p className="text-center text-game-text-dim">
            No published maps yet. Be the first to create one!
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {maps.map((map) => (
            <MapCard
              key={map.id}
              map={map}
              isOwner={userId === map.authorId}
              isAdmin={isAdmin}
              isEditDisabled={
                settings ? !settings.allowMapUpdates && !isAdmin : false
              }
              onEdit={() => {
                if (settings && !settings.allowMapUpdates && !isAdmin) {
                  toast.error(
                    "Map editing is temporarily disabled by administrator.",
                  );
                  return;
                }
                navigate(`/map-editor?id=${encodeURIComponent(map.id)}`);
              }}
              onDelete={() => onDelete(map.id)}
              onLike={() => onLike(map.id)}
            />
          ))}
        </div>

        {total > limit && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </Button>
            <span className="text-sm text-game-text-dim">
              Page {page} / {Math.ceil(total / limit)}
            </span>
            <Button
              type="button"
              variant="outline"
              disabled={page >= Math.ceil(total / limit)}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}

function MapCard({
  map,
  isOwner,
  isAdmin,
  isEditDisabled,
  onEdit,
  onDelete,
  onLike,
}: {
  map: CustomMap;
  isOwner: boolean;
  isAdmin: boolean;
  isEditDisabled: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onLike: () => void;
}) {
  return (
    <div className="border border-game-border bg-game-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{map.name}</h3>
          <p className="text-xs text-game-text-dim">by {map.authorName}</p>
        </div>
      </div>
      {map.description && (
        <p className="mt-2 line-clamp-2 text-sm text-game-text-dim">
          {map.description}
        </p>
      )}
      <p className="mt-2 text-xs text-game-text-dim">
        {map.minPlayers === map.maxPlayers
          ? `${map.minPlayers} players`
          : `${map.minPlayers}-${map.maxPlayers} players`}{" "}
        · {map.supportedModes.join(", ") || "no modes"}
      </p>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-game-text-dim">
          <span>{map.stats.plays} plays</span>
          <button
            type="button"
            onClick={onLike}
            className="flex items-center gap-1 hover:text-pink-400"
          >
            <Heart className="size-3" />
            {map.stats.likes}
          </button>
        </div>
        <div className="flex items-center gap-1">
          {(isOwner || isAdmin) && (
            <>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onEdit}
                className={`h-7 px-2 ${isEditDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                title={
                  isAdmin && !isOwner ? "Edit map as Administrator" : "Edit map"
                }
              >
                <Pencil className="size-3" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onDelete}
                className="h-7 px-2 text-red-400 hover:text-red-300"
                title={
                  isAdmin && !isOwner
                    ? "Delete map as Administrator"
                    : "Delete map"
                }
              >
                <Trash2 className="size-3" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default MapBrowserPage;
