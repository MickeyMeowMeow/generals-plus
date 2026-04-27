import { RenderConfig } from "#/features/game/renderer/render-config.ts";
import type {
  MoveQueueItem,
  RenderCell,
  RenderPlayer,
  RenderPoint,
  RenderViewportState,
} from "#/features/game/renderer/render-types.ts";

/** Generates stable map keys for grid points/cells. */
export class CellKeyFormatter {
  fromPoint(point: RenderPoint): string {
    return `${point.x}:${point.y}`;
  }

  fromCell(cell: RenderCell): string {
    return `${cell.x}:${cell.y}`;
  }
}

export const cellKeyFormatter = new CellKeyFormatter();

/** Resolves player metadata by owner index with input validation. */
export class RenderPlayerIndex {
  private readonly players = new Map<number, RenderPlayer>();

  constructor(players: readonly RenderPlayer[]) {
    for (const player of players) {
      if (this.players.has(player.index)) {
        throw new Error(`Duplicate render player index: ${player.index}.`);
      }
      this.players.set(player.index, player);
    }
  }

  ownerColor(ownerIndex: number): number | null {
    if (ownerIndex === -1) return null;

    const player = this.players.get(ownerIndex);
    if (!player) {
      throw new Error(`Missing render player for owner index: ${ownerIndex}.`);
    }
    return player.color;
  }

  troopColor(ownerIndex: number): number {
    const ownerColor = this.ownerColor(ownerIndex);
    if (ownerColor === null) return RenderConfig.neutralTroopColor;
    return ownerColor;
  }
}

export class RenderCellIndex {
  private readonly cells = new Map<string, RenderCell>();
  private readonly width: number;
  private readonly height: number;

  constructor(width: number, height: number, cells: readonly RenderCell[]) {
    this.width = width;
    this.height = height;

    for (const cell of cells) {
      this.assertInBounds(cell);
      const key = cellKeyFormatter.fromCell(cell);
      if (this.cells.has(key)) {
        throw new Error(`Duplicate render cell coordinate: ${key}.`);
      }
      this.cells.set(key, cell);
    }
  }

  get(point: RenderPoint): RenderCell | null {
    return this.cells.get(cellKeyFormatter.fromPoint(point)) ?? null;
  }

  /** Returns only visible cells to match interaction rules. */
  visibleCellAt(point: RenderPoint): RenderCell | null {
    const cell = this.get(point);
    if (!cell?.isVisible) return null;
    return cell;
  }

  /** Enumerates visible cells inside an inclusive grid rectangle. */
  selectVisibleCells(rect: SelectionRect): RenderPoint[] {
    const selectedCells: RenderPoint[] = [];
    for (let y = rect.top; y <= rect.bottom; y += 1) {
      for (let x = rect.left; x <= rect.right; x += 1) {
        const cell = this.visibleCellAt({ x, y });
        if (cell) selectedCells.push({ x, y });
      }
    }
    return selectedCells;
  }

  private assertInBounds(cell: RenderCell): void {
    if (
      cell.x < 0 ||
      cell.x >= this.width ||
      cell.y < 0 ||
      cell.y >= this.height
    ) {
      throw new Error(
        `Render cell is out of bounds: ${cellKeyFormatter.fromCell(cell)}.`,
      );
    }
  }
}

export class ViewportCuller {
  private readonly stride: number;
  private readonly cellSize: number;

  constructor(stride: number, cellSize: number) {
    this.stride = stride;
    this.cellSize = cellSize;
  }

  /** Checks whether a cell intersects the current viewport bounds. */
  isCellVisible(cell: RenderCell, viewport: RenderViewportState): boolean {
    const left = cell.x * this.stride;
    const top = cell.y * this.stride;
    const right = left + this.cellSize;
    const bottom = top + this.cellSize;

    return (
      right >= viewport.left &&
      left <= viewport.right &&
      bottom >= viewport.top &&
      top <= viewport.bottom
    );
  }

  /** Checks whether a queued move segment intersects the viewport. */
  isQueueItemVisible(
    item: MoveQueueItem,
    viewport: RenderViewportState,
  ): boolean {
    const from = this.cellCenter(item.from);
    const to = this.cellCenter(item.to);
    const left = Math.min(from.x, to.x);
    const right = Math.max(from.x, to.x);
    const top = Math.min(from.y, to.y);
    const bottom = Math.max(from.y, to.y);

    return (
      right >= viewport.left &&
      left <= viewport.right &&
      bottom >= viewport.top &&
      top <= viewport.bottom
    );
  }

  cellCenter(point: RenderPoint): RenderPoint {
    return {
      x: point.x * this.stride + this.cellSize / 2,
      y: point.y * this.stride + this.cellSize / 2,
    };
  }
}

export class GridCoordinateMapper {
  private readonly width: number;
  private readonly height: number;
  private readonly stride: number;

  constructor(width: number, height: number, stride: number) {
    this.width = width;
    this.height = height;
    this.stride = stride;
  }

  /** Converts world-space pointer coordinates into grid coordinates. */
  pointToCoordinate(point: RenderPoint): RenderPoint | null {
    const x = Math.floor(point.x / this.stride);
    const y = Math.floor(point.y / this.stride);
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
    return { x, y };
  }

  /** Creates an inclusive, clamped selection rectangle from drag endpoints. */
  selectionRect(start: RenderPoint, end: RenderPoint): SelectionRect {
    const startX = Math.floor(start.x / this.stride);
    const startY = Math.floor(start.y / this.stride);
    const endX = Math.floor(end.x / this.stride);
    const endY = Math.floor(end.y / this.stride);

    return new SelectionRect(
      this.clamp(Math.min(startX, endX), 0, this.width - 1),
      this.clamp(Math.min(startY, endY), 0, this.height - 1),
      this.clamp(Math.max(startX, endX), 0, this.width - 1),
      this.clamp(Math.max(startY, endY), 0, this.height - 1),
    );
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}

export class SelectionRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;

  constructor(left: number, top: number, right: number, bottom: number) {
    this.left = left;
    this.top = top;
    this.right = right;
    this.bottom = bottom;
  }

  /** Converts grid-space selection bounds into world-space pixels. */
  toWorldRect(stride: number): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    return {
      x: this.left * stride,
      y: this.top * stride,
      width: (this.right - this.left + 1) * stride - RenderConfig.cellGap,
      height: (this.bottom - this.top + 1) * stride - RenderConfig.cellGap,
    };
  }
}

export class PointerDragState {
  readonly start: RenderPoint;
  readonly current: RenderPoint;
  readonly isSelecting: boolean;

  constructor(start: RenderPoint, current: RenderPoint, isSelecting: boolean) {
    this.start = start;
    this.current = current;
    this.isSelecting = isSelecting;
  }

  /** Updates drag state and flips to selection mode past the movement threshold. */
  update(current: RenderPoint): PointerDragState {
    const dx = current.x - this.start.x;
    const dy = current.y - this.start.y;
    const distance = Math.hypot(dx, dy);

    return new PointerDragState(
      this.start,
      current,
      this.isSelecting || distance >= RenderConfig.dragSelectThreshold,
    );
  }
}
