import type { Terrain } from "@generals-plus/engine";

export type TerrainType = Terrain;

/** Grid-space coordinate, not pixel-space. */
export interface RenderPoint {
  readonly x: number;
  readonly y: number;
}

/** Immutable cell snapshot consumed by the renderer. */
export interface RenderCell {
  readonly x: number;
  readonly y: number;
  readonly terrain: TerrainType;
  readonly troopCount: number;
  readonly ownerIndex: number;
  readonly isVisible: boolean;
}

/** Player visual metadata referenced by cell owner index. */
export interface RenderPlayer {
  readonly index: number;
  readonly color: number;
  readonly username: string;
}

/** One queued move visualized as an arrow. */
export interface MoveQueueItem {
  readonly from: RenderPoint;
  readonly to: RenderPoint;
  readonly isSplit: boolean;
  readonly order: number;
}

/** Top-level props for the renderer entry point. */
export interface GameMapProps {
  readonly width: number;
  readonly height: number;
  readonly cells: readonly RenderCell[];
  readonly players: readonly RenderPlayer[];
  readonly moveQueue: readonly MoveQueueItem[];
}

/** Renderer interaction callbacks emitted to upper layers. */
export interface GameMapCallbacks {
  onCellClick?(x: number, y: number): void;
  onCellHover?(x: number, y: number): void;
  onCellLeave?(): void;
  onQueueItemRemove?(order: number): void;
}

/** Current world-space viewport bounds and zoom level. */
export interface RenderViewportState {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly scale: number;
}
