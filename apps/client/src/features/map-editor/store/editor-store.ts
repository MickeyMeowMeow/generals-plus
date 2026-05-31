import type {
  GameMode,
  GridType,
  ICoordinate,
  Terrain,
} from "@generals-plus/engine";
import { GridType as GT, HexGrid2D, Terrain as T } from "@generals-plus/engine";
import type {
  CellTemplate,
  CustomMap,
  GridTemplate,
  HexGridBounds,
  SpawnPoint,
  SquareGridBounds,
} from "@generals-plus/shared-types";
import { create } from "zustand";

export type EditorTool =
  | { kind: "terrain"; terrain: Terrain }
  | { kind: "city"; troopCount: number }
  | { kind: "general"; teamId: string; slot: number }
  | { kind: "bombSite" }
  | { kind: "trackAdd" }
  | { kind: "trackRemove" }
  | { kind: "erase" };

export interface EditorState {
  mapId: string | null;
  name: string;
  description: string;
  supportedModes: GameMode[];

  gridType: GridType;
  bounds: SquareGridBounds | HexGridBounds;
  cells: CellTemplate[][];
  spawns: SpawnPoint[];
  track: ICoordinate[];

  tool: EditorTool;

  history: {
    cells: CellTemplate[][];
    spawns: SpawnPoint[];
    track: ICoordinate[];
  }[];
  historyIndex: number;

  saving: boolean;
  lastSavedAt: number | null;
  saveError: string | null;
}

interface EditorActions {
  reset(): void;
  loadFromMap(map: CustomMap): void;
  setName(name: string): void;
  setDescription(desc: string): void;
  setSupportedModes(modes: GameMode[]): void;
  setGridType(gridType: GridType): void;
  setSquareBounds(bounds: SquareGridBounds): void;
  setHexBounds(bounds: HexGridBounds): void;
  setTool(tool: EditorTool): void;
  paintCell(coord: ICoordinate): void;
  undo(): void;
  redo(): void;
  setSaving(value: boolean): void;
  setLastSavedAt(value: number | null): void;
  setSaveError(value: string | null): void;
  setMapId(id: string | null): void;
  getTemplate(): GridTemplate;
}

const DEFAULT_SQUARE_BOUNDS: SquareGridBounds = { width: 20, height: 14 };
const DEFAULT_HEX_BOUNDS: HexGridBounds = {
  left: 8,
  right: 8,
  leftSlant: 15,
  rightSlant: 15,
};

function createEmptyCells(
  gridType: GridType,
  bounds: SquareGridBounds | HexGridBounds,
): CellTemplate[][] {
  if (gridType === GT.SQUARE) {
    const { width, height } = bounds as SquareGridBounds;
    return Array.from({ length: height }, () =>
      Array.from({ length: width }, () => ({
        terrain: T.PLAIN as Terrain,
        troopCount: null,
        siteIndex: null,
      })),
    );
  }
  const { left, right, leftSlant, rightSlant } = bounds as HexGridBounds;
  return Array.from({ length: leftSlant }, (_, y) => {
    const minX = HexGrid2D.getMinX(y, left);
    const maxX = HexGrid2D.getMaxX(y, right, rightSlant);
    return Array.from({ length: maxX - minX + 1 }, () => ({
      terrain: T.PLAIN as Terrain,
      troopCount: null,
      siteIndex: null,
    }));
  });
}

function getRowOffsetX(
  gridType: GridType,
  bounds: SquareGridBounds | HexGridBounds,
  y: number,
): number {
  if (gridType === GT.SQUARE) return 0;
  const { left } = bounds as HexGridBounds;
  return HexGrid2D.getMinX(y, left);
}

function getCellAt(
  state: EditorState,
  coord: ICoordinate,
): CellTemplate | null {
  const row = state.cells[coord.y];
  if (!row) return null;
  const offset = getRowOffsetX(state.gridType, state.bounds, coord.y);
  const idx = coord.x - offset;
  return row[idx] ?? null;
}

function setCellAt(
  state: EditorState,
  coord: ICoordinate,
  update: Partial<CellTemplate>,
): CellTemplate[][] {
  const newCells = state.cells.map((row, y) => {
    if (y !== coord.y) return row;
    const offset = getRowOffsetX(state.gridType, state.bounds, y);
    const idx = coord.x - offset;
    return row.map((cell, i) => (i === idx ? { ...cell, ...update } : cell));
  });
  return newCells;
}

function pushHistory<S extends EditorState>(state: S, next: Partial<S>): S {
  const snapshot = {
    cells: state.cells,
    spawns: state.spawns,
    track: state.track,
  };
  const history = state.history.slice(0, state.historyIndex + 1);
  history.push(snapshot);
  if (history.length > 50) history.shift();
  return {
    ...state,
    ...next,
    history,
    historyIndex: history.length - 1,
  };
}

function recomputeBombSiteIndices(cells: CellTemplate[][]): CellTemplate[][] {
  let counter = 0;
  return cells.map((row) =>
    row.map((cell) => {
      if (cell.terrain === T.BOMB_SITE) {
        return { ...cell, siteIndex: counter++ };
      }
      return cell;
    }),
  );
}

function buildInitialState(): EditorState {
  const gridType = GT.SQUARE as GridType;
  const bounds = DEFAULT_SQUARE_BOUNDS;
  return {
    mapId: null,
    name: "Untitled Map",
    description: "",
    supportedModes: [] as GameMode[],
    gridType,
    bounds,
    cells: createEmptyCells(gridType, bounds),
    spawns: [],
    track: [],
    tool: { kind: "terrain", terrain: T.PLAIN as Terrain },
    history: [],
    historyIndex: -1,
    saving: false,
    lastSavedAt: null,
    saveError: null,
  };
}

export const useEditorStore = create<EditorState & EditorActions>(
  (set, get) => ({
    ...buildInitialState(),

    reset() {
      set(buildInitialState());
    },

    loadFromMap(map) {
      set({
        mapId: map.id,
        name: map.name,
        description: map.description,
        supportedModes: map.supportedModes,
        gridType: map.grid.gridType,
        bounds: map.grid.bounds,
        cells: map.grid.cells,
        spawns: map.grid.spawns,
        track: map.grid.track ?? [],
        history: [],
        historyIndex: -1,
        saving: false,
        lastSavedAt: null,
        saveError: null,
        tool: { kind: "terrain", terrain: T.PLAIN as Terrain },
      });
    },

    setMapId(id) {
      set({ mapId: id });
    },

    setName(name) {
      set({ name });
    },

    setDescription(description) {
      set({ description });
    },

    setSupportedModes(supportedModes) {
      set({ supportedModes });
    },

    setGridType(gridType) {
      const bounds =
        gridType === GT.SQUARE ? DEFAULT_SQUARE_BOUNDS : DEFAULT_HEX_BOUNDS;
      set({
        gridType,
        bounds,
        cells: createEmptyCells(gridType, bounds),
        spawns: [],
        track: [],
        history: [],
        historyIndex: -1,
      });
    },

    setSquareBounds(bounds) {
      set((state) => {
        if (state.gridType !== GT.SQUARE) return state;
        const newCells = createEmptyCells(GT.SQUARE, bounds);
        // Preserve existing cells where possible
        const oldBounds = state.bounds as SquareGridBounds;
        for (let y = 0; y < Math.min(oldBounds.height, bounds.height); y++) {
          for (let x = 0; x < Math.min(oldBounds.width, bounds.width); x++) {
            newCells[y][x] = state.cells[y][x];
          }
        }
        const filteredSpawns = state.spawns.filter(
          (s) => s.x < bounds.width && s.y < bounds.height,
        );
        const filteredTrack = state.track.filter(
          (c) => c.x < bounds.width && c.y < bounds.height,
        );
        return pushHistory(state, {
          bounds,
          cells: recomputeBombSiteIndices(newCells),
          spawns: filteredSpawns,
          track: filteredTrack,
        });
      });
    },

    setHexBounds(bounds) {
      set((state) => {
        if (state.gridType !== GT.HEX) return state;
        const newCells = createEmptyCells(GT.HEX, bounds);
        // Preserve where in-bounds for both old and new
        const oldBounds = state.bounds as HexGridBounds;
        for (let y = 0; y < state.cells.length && y < bounds.leftSlant; y++) {
          const oldOffset = HexGrid2D.getMinX(y, oldBounds.left);
          const newOffset = HexGrid2D.getMinX(y, bounds.left);
          const newMax = HexGrid2D.getMaxX(y, bounds.right, bounds.rightSlant);
          const newWidth = newMax - newOffset + 1;
          for (let i = 0; i < newWidth; i++) {
            const x = newOffset + i;
            const oldIdx = x - oldOffset;
            if (oldIdx >= 0 && oldIdx < state.cells[y].length) {
              newCells[y][i] = state.cells[y][oldIdx];
            }
          }
        }
        const isInBounds = (x: number, y: number): boolean => {
          if (y < 0 || y >= bounds.leftSlant) return false;
          const minX = HexGrid2D.getMinX(y, bounds.left);
          const maxX = HexGrid2D.getMaxX(y, bounds.right, bounds.rightSlant);
          return x >= minX && x <= maxX;
        };
        const filteredSpawns = state.spawns.filter((s) => isInBounds(s.x, s.y));
        const filteredTrack = state.track.filter((c) => isInBounds(c.x, c.y));
        return pushHistory(state, {
          bounds,
          cells: recomputeBombSiteIndices(newCells),
          spawns: filteredSpawns,
          track: filteredTrack,
        });
      });
    },

    setTool(tool) {
      set({ tool });
    },

    paintCell(coord) {
      set((state) => {
        const cell = getCellAt(state, coord);
        if (!cell) return state;

        const { tool } = state;
        let newCells = state.cells;
        let newSpawns = state.spawns;
        let newTrack = state.track;

        const removeSpawnAt = (c: ICoordinate) =>
          newSpawns.filter((s) => !(s.x === c.x && s.y === c.y));

        switch (tool.kind) {
          case "terrain": {
            if (cell.terrain === tool.terrain) return state;
            newCells = setCellAt(state, coord, {
              terrain: tool.terrain,
              troopCount: null,
              siteIndex: null,
            });
            // If we changed a general/bombsite/etc, clean spawns/track
            if (cell.terrain === T.GENERAL) newSpawns = removeSpawnAt(coord);
            if (cell.terrain === T.BOMB_SITE)
              newCells = recomputeBombSiteIndices(newCells);
            break;
          }
          case "city": {
            newCells = setCellAt(state, coord, {
              terrain: T.CITY as Terrain,
              troopCount: tool.troopCount,
              siteIndex: null,
            });
            if (cell.terrain === T.GENERAL) newSpawns = removeSpawnAt(coord);
            if (cell.terrain === T.BOMB_SITE)
              newCells = recomputeBombSiteIndices(newCells);
            break;
          }
          case "general": {
            // Place general & spawn assignment
            newCells = setCellAt(state, coord, {
              terrain: T.GENERAL as Terrain,
              troopCount: null,
              siteIndex: null,
            });
            // Remove existing spawn at this position (replacing)
            newSpawns = newSpawns.filter(
              (s) => !(s.x === coord.x && s.y === coord.y),
            );
            // Remove any other spawn with same team+slot
            newSpawns = newSpawns.filter(
              (s) => !(s.teamId === tool.teamId && s.slot === tool.slot),
            );
            newSpawns = [
              ...newSpawns,
              {
                x: coord.x,
                y: coord.y,
                teamId: tool.teamId,
                slot: tool.slot,
              },
            ];
            if (cell.terrain === T.BOMB_SITE)
              newCells = recomputeBombSiteIndices(newCells);
            break;
          }
          case "bombSite": {
            newCells = setCellAt(state, coord, {
              terrain: T.BOMB_SITE as Terrain,
              troopCount: null,
              siteIndex: 0,
            });
            if (cell.terrain === T.GENERAL) newSpawns = removeSpawnAt(coord);
            newCells = recomputeBombSiteIndices(newCells);
            break;
          }
          case "trackAdd": {
            if (newTrack.some((c) => c.x === coord.x && c.y === coord.y)) {
              return state;
            }
            newTrack = [...newTrack, { x: coord.x, y: coord.y }];
            break;
          }
          case "trackRemove": {
            newTrack = newTrack.filter(
              (c) => !(c.x === coord.x && c.y === coord.y),
            );
            break;
          }
          case "erase": {
            newCells = setCellAt(state, coord, {
              terrain: T.PLAIN as Terrain,
              troopCount: null,
              siteIndex: null,
            });
            newSpawns = removeSpawnAt(coord);
            newTrack = newTrack.filter(
              (c) => !(c.x === coord.x && c.y === coord.y),
            );
            if (cell.terrain === T.BOMB_SITE)
              newCells = recomputeBombSiteIndices(newCells);
            break;
          }
        }

        return pushHistory(state, {
          cells: newCells,
          spawns: newSpawns,
          track: newTrack,
        });
      });
    },

    undo() {
      set((state) => {
        if (state.historyIndex < 0) return state;
        const snapshot = state.history[state.historyIndex];
        if (!snapshot) return state;
        return {
          ...state,
          cells: snapshot.cells,
          spawns: snapshot.spawns,
          track: snapshot.track,
          historyIndex: state.historyIndex - 1,
        };
      });
    },

    redo() {
      set((state) => {
        const next = state.historyIndex + 1;
        const snapshot = state.history[next];
        if (!snapshot) return state;
        // Note: simple impl — redo replays the next snapshot
        return {
          ...state,
          cells: snapshot.cells,
          spawns: snapshot.spawns,
          track: snapshot.track,
          historyIndex: next,
        };
      });
    },

    setSaving(value) {
      set({ saving: value });
    },

    setLastSavedAt(value) {
      set({ lastSavedAt: value });
    },

    setSaveError(value) {
      set({ saveError: value });
    },

    getTemplate(): GridTemplate {
      const s = get();
      return {
        gridType: s.gridType,
        bounds: s.bounds,
        cells: s.cells,
        spawns: s.spawns,
        track: s.track.length > 0 ? s.track : undefined,
      };
    },
  }),
);
