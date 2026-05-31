import { Terrain } from "@generals-plus/engine";
import { ArrowLeft, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { Button } from "#/components/ui/button";
import { AuthStatus } from "#/features/auth/auth-store";
import { useAuth, useUser } from "#/features/auth/hooks";
import { mapsApi } from "#/features/map-editor/api/maps-api";
import { EditorCanvas } from "#/features/map-editor/components/editor-canvas";
import { MapMetadataPanel } from "#/features/map-editor/components/map-metadata-panel";
import { ToolPalette } from "#/features/map-editor/components/tool-palette";
import { useEditorStore } from "#/features/map-editor/store/editor-store";

const TEAM_COLORS: Record<string, number> = {
  team_0: 0xef4444,
  team_1: 0x3b82f6,
  team_2: 0x10b981,
  team_3: 0xf59e0b,
  attackers: 0xef4444,
  defenders: 0x3b82f6,
};

export function MapEditorPage() {
  const [params] = useSearchParams();
  const editId = params.get("id");

  const { state } = useAuth();
  const user = useUser((u) => u);

  const reset = useEditorStore((s) => s.reset);
  const loadFromMap = useEditorStore((s) => s.loadFromMap);
  const mapId = useEditorStore((s) => s.mapId);
  const cells = useEditorStore((s) => s.cells);
  const spawns = useEditorStore((s) => s.spawns);
  const supportedModes = useEditorStore((s) => s.supportedModes);
  const name = useEditorStore((s) => s.name);
  const description = useEditorStore((s) => s.description);
  const saving = useEditorStore((s) => s.saving);
  const saveError = useEditorStore((s) => s.saveError);
  const setSaving = useEditorStore((s) => s.setSaving);
  const setSaveError = useEditorStore((s) => s.setSaveError);
  const setLastSavedAt = useEditorStore((s) => s.setLastSavedAt);
  const setMapId = useEditorStore((s) => s.setMapId);
  const getTemplate = useEditorStore((s) => s.getTemplate);

  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!editId) {
      reset();
      return;
    }
    let cancelled = false;
    mapsApi
      .get(editId)
      .then((map) => {
        if (cancelled) return;
        loadFromMap(map);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load map");
      });
    return () => {
      cancelled = true;
    };
  }, [editId, reset, loadFromMap]);

  const playerColorByTeam = useMemo(() => {
    const map = new Map<string, number>();
    for (const [id, color] of Object.entries(TEAM_COLORS)) {
      map.set(id, color);
    }
    return map;
  }, []);

  const generalCount = useMemo(() => {
    let count = 0;
    for (const row of cells) {
      for (const c of row) if (c.terrain === Terrain.GENERAL) count++;
    }
    return count;
  }, [cells]);

  const canSave =
    name.trim().length > 0 &&
    spawns.length >= 2 &&
    spawns.length === generalCount;

  const onSave = async (publish: boolean) => {
    if (state.status !== AuthStatus.AUTHENTICATED) {
      setSaveError("Please sign in to save maps");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        grid: getTemplate(),
        supportedModes,
        minPlayers: spawns.length,
        maxPlayers: spawns.length,
        status: (publish ? "published" : "draft") as "published" | "draft",
      };

      if (mapId) {
        await mapsApi.update(mapId, payload);
      } else {
        const created = await mapsApi.create(payload);
        setMapId(created.id);
      }
      setLastSavedAt(Date.now());
    } catch (err) {
      const detail =
        err && typeof err === "object" && "details" in err
          ? JSON.stringify((err as { details: unknown }).details)
          : "";
      setSaveError(
        (err instanceof Error ? err.message : "Save failed") +
          (detail ? `\n${detail}` : ""),
      );
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div className="grid h-screen place-items-center bg-game-bg text-game-text">
        <div className="grid gap-3 text-center">
          <p>{loadError}</p>
          <Button asChild variant="outline">
            <Link to="/maps">Back to maps</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-game-bg text-game-text">
      <header className="flex items-center justify-between border-b border-game-border bg-game-surface px-4 py-2">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/maps">
              <ArrowLeft className="size-4" />
              Back
            </Link>
          </Button>
          <h1 className="text-sm font-semibold">
            {mapId ? `Editing: ${name}` : "New Map"}
          </h1>
          <span className="text-xs text-game-text-dim">
            {spawns.length} spawn{spawns.length !== 1 ? "s" : ""} ·{" "}
            {generalCount} general{generalCount !== 1 ? "s" : ""}
            {generalCount !== spawns.length && (
              <span className="text-red-400">
                {" "}
                (mismatch: each general needs a spawn tag)
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {saveError && (
            <span className="max-w-md truncate text-xs text-red-400">
              {saveError}
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={saving || !canSave || !user}
            onClick={() => onSave(false)}
            className="border-game-border bg-game-bg text-game-text"
          >
            <Save className="size-4" />
            Save draft
          </Button>
          <Button
            type="button"
            disabled={
              saving || !canSave || !user || supportedModes.length === 0
            }
            onClick={() => onSave(true)}
          >
            <Save className="size-4" />
            Publish
          </Button>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-[280px_1fr_280px] overflow-hidden">
        <aside className="overflow-y-auto border-r border-game-border bg-game-surface">
          <ToolPalette />
        </aside>
        <main className="relative">
          <EditorCanvas playerColorByTeam={playerColorByTeam} />
        </main>
        <aside className="overflow-y-auto border-l border-game-border bg-game-surface">
          <MapMetadataPanel />
        </aside>
      </div>
    </div>
  );
}

export default MapEditorPage;
