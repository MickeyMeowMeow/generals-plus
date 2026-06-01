/**
 * BotSession: manages a bot player's lifecycle within a MatchRoom.
 *
 * Creates a synthetic session (no WebSocket client needed) and bridges
 * the game engine's vision data to the Python bot service via BotBridge.
 */

import type { IBaseGame, IVisionCell } from "@generals-plus/engine";
import { ActionType, PlayerStatus } from "@generals-plus/engine";
import type { MatchState } from "@generals-plus/shared-types";
import {
  ActionData,
  ClientActionQueue,
  ClientVision,
  VisionCellSchema,
} from "@generals-plus/shared-types";

import type { BotBridge } from "./bot-bridge";
import type { BotAction, BotConfig, ScoreboardEntry } from "./protocol";
import { DIRECTION_OFFSETS } from "./protocol";
import type { GridInfo } from "./serialization";
import { buildTickMessage, serializeVisionCells } from "./serialization";

function log(level: "info" | "warn" | "error", msg: string) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [BotSession] [${level}] ${msg}`);
}

export class BotSession {
  readonly playerId: string;
  readonly sessionId: string;

  private bridge: BotBridge;
  private gridInfo: GridInfo;
  private config: BotConfig;

  constructor(
    playerId: string,
    bridge: BotBridge,
    gridInfo: GridInfo,
    config: BotConfig = {},
  ) {
    this.playerId = playerId;
    this.sessionId = `bot:${playerId}`;
    this.bridge = bridge;
    this.gridInfo = gridInfo;
    this.config = config;
  }

  /**
   * Register this bot as a synthetic session in the match state maps.
   */
  register(
    state: MatchState,
    sessionToPlayerId: Map<string, string>,
    playerToSessionId: Map<string, string>,
  ): void {
    sessionToPlayerId.set(this.sessionId, this.playerId);
    playerToSessionId.set(this.playerId, this.sessionId);

    const vision = new ClientVision();
    state.clientVisions.set(this.sessionId, vision);

    const actionQueue = new ClientActionQueue();
    state.clientActionQueues.set(this.sessionId, actionQueue);

    this.bridge.send({
      type: "start",
      player_id: this.playerId,
      config: this.config,
    });

    log("info", `Registered bot player ${this.playerId}`);
  }

  /**
   * Called at the start of each tick, before processActionQueues.
   */
  async onTick(
    game: IBaseGame,
    state: MatchState,
    scoreboard: ScoreboardEntry[],
  ): Promise<void> {
    const visionGrid = game.getVisionGrid(this.playerId);
    if (!visionGrid) return;

    const cells = Array.from(visionGrid) as IVisionCell[];

    let ownedLandCount = 0;
    let ownedArmyCount = 0;
    for (const vc of cells) {
      if (
        vc.owner?.playerId === this.playerId &&
        vc.owner.status === PlayerStatus.ACTIVE
      ) {
        ownedLandCount++;
        ownedArmyCount += vc.troopCount ?? 0;
      }
    }

    const visionJSON = serializeVisionCells(cells);
    const tickMsg = buildTickMessage(
      this.playerId,
      state.tick,
      this.gridInfo,
      visionJSON,
      ownedLandCount,
      ownedArmyCount,
      scoreboard,
    );

    const botAction = await this.bridge.sendTickAndWait(this.playerId, tickMsg);

    if (!botAction || botAction.pass) return;

    const action = this.botActionToActionData(botAction);
    if (!action) return;

    const queue = state.clientActionQueues.get(this.sessionId);
    if (queue) {
      queue.queue.push(action);
    }
  }

  /**
   * Update the bot's vision in the match state (for spectators).
   */
  updateVision(game: IBaseGame, state: MatchState): void {
    const visionGrid = game.getVisionGrid(this.playerId);
    const vision = state.clientVisions.get(this.sessionId);
    if (!visionGrid || !vision) return;

    // Grid size changed (first update): full rebuild
    if (vision.cells.length !== visionGrid.totalCells) {
      vision.cells.clear();
      for (const vc of visionGrid) {
        vision.cells.push(this.createVisionCell(vc));
      }
      return;
    }

    // Incremental update: reuse existing cells, only mutate changed fields.
    // Iterate the IVisionGrid directly (no Array.from allocation).
    let i = 0;
    for (const vc of visionGrid) {
      const cell = vision.cells[i];

      if (cell.visibility !== vc.visibility) cell.visibility = vc.visibility;
      if (cell.terrain !== vc.terrain) cell.terrain = vc.terrain;

      const troopCount = vc.troopCount ?? -1;
      if (cell.troopCount !== troopCount) cell.troopCount = troopCount;

      const ownerIndex =
        vc.owner?.status === PlayerStatus.ACTIVE ? vc.owner.playerId : "";
      if (cell.ownerIndex !== ownerIndex) cell.ownerIndex = ownerIndex;

      const siteIndex = vc.siteIndex ?? -1;
      if (cell.siteIndex !== siteIndex) cell.siteIndex = siteIndex;

      const zoneIndex = vc.zoneIndex ?? -1;
      if (cell.zoneIndex !== zoneIndex) cell.zoneIndex = zoneIndex;

      const itemId = vc.item?.id ?? "";
      const itemType = vc.item?.type ?? -1;
      if (cell.item_id !== itemId) cell.item_id = itemId;
      if (cell.item_type !== itemType) cell.item_type = itemType;

      i++;
    }
  }

  private createVisionCell(vc: IVisionCell): VisionCellSchema {
    const cell = new VisionCellSchema();
    cell.visibility = vc.visibility;
    cell.terrain = vc.terrain;
    cell.troopCount = vc.troopCount ?? -1;
    cell.ownerIndex =
      vc.owner?.status === PlayerStatus.ACTIVE ? vc.owner.playerId : "";
    cell.siteIndex = vc.siteIndex ?? -1;
    cell.zoneIndex = vc.zoneIndex ?? -1;

    if (vc.item) {
      cell.item_id = vc.item.id;
      cell.item_type = vc.item.type;
    } else {
      cell.item_id = "";
      cell.item_type = -1;
    }

    return cell;
  }

  end(): void {
    this.bridge.send({
      type: "end",
      player_id: this.playerId,
    });
  }

  private botActionToActionData(action: BotAction): ActionData | null {
    if (action.direction < 0 || action.direction > 3) return null;

    const offset = DIRECTION_OFFSETS[action.direction];
    const fromX = action.col;
    const fromY = action.row;
    const toX = fromX + offset.dx;
    const toY = fromY + offset.dy;

    if (this.gridInfo.type === "square") {
      if (
        toX < 0 ||
        toX >= this.gridInfo.width ||
        toY < 0 ||
        toY >= this.gridInfo.height
      ) {
        return null;
      }
    }

    const entry = new ActionData();
    entry.type = action.split ? ActionType.SPLIT_MOVE : ActionType.MOVE;
    entry.fromX = fromX;
    entry.fromY = fromY;
    entry.toX = toX;
    entry.toY = toY;
    return entry;
  }
}
