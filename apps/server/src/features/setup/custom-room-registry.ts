import { matchMaker } from "@colyseus/core";
import { GameMode } from "@generals-plus/engine";
import type { SetupPlayer } from "@generals-plus/shared-types";
import { ROOM_NAMES } from "@generals-plus/shared-types";

interface CustomRoomResolution {
  customRoomKey: string;
  setupRoomId: string;
  created: boolean;
}

interface CustomRoomCreation extends CustomRoomResolution {}

export class CustomRoomAlreadyExistsError extends Error {
  constructor(customRoomKey: string) {
    super(`custom room already exists: ${customRoomKey}`);
    this.name = "CustomRoomAlreadyExistsError";
  }
}

export class CustomRoomFullError extends Error {
  constructor(customRoomKey: string) {
    super(`custom room is full: ${customRoomKey}`);
    this.name = "CustomRoomFullError";
  }
}

interface CustomRoomRecord {
  key: string;
  activeSetupRoomId: string | null;
  pendingSetupRoomId: Promise<string> | null;
  status: "setup" | "match" | "idle";
  version: number;
  ownerUserId: string | null;
}

function getSetupRoomForRecord(roomId: string) {
  return matchMaker.getLocalRoomById(roomId) as
    | {
        maxClients: number;
        state: { players: SetupPlayer[] };
      }
    | undefined;
}

function ensureRoomHasCapacity(
  record: CustomRoomRecord,
  requesterUserId: string | null,
) {
  if (!record.activeSetupRoomId) return;

  const room = getSetupRoomForRecord(record.activeSetupRoomId);
  if (!room) return;

  const isExistingPlayer = room.state.players.some(
    (player) => player.id === requesterUserId,
  );
  if (!isExistingPlayer && room.state.players.length >= room.maxClients) {
    throw new CustomRoomFullError(record.key);
  }
}

const customRooms = new Map<string, CustomRoomRecord>();

function generateCustomRoomKey() {
  return crypto.randomUUID().split("-")[0];
}

async function createSetupRoomForKey(customRoomKey: string) {
  const listing = await matchMaker.createRoom(ROOM_NAMES.SETUP, {
    gameMode: GameMode.CLASSIC,
    isPublic: false,
    customRoomKey,
  });
  return listing.roomId;
}

let createSetupRoomForKeyImpl = createSetupRoomForKey;

function createCustomRoomRecord(
  key: string,
  ownerUserId: string | null,
): CustomRoomRecord {
  return {
    key,
    activeSetupRoomId: null,
    pendingSetupRoomId: null,
    status: "idle",
    version: 0,
    ownerUserId,
  };
}

async function createOrJoinPendingSetupRoom(
  record: CustomRoomRecord,
  ownerUserId: string | null,
): Promise<CustomRoomResolution> {
  if (record.activeSetupRoomId) {
    ensureRoomHasCapacity(record, ownerUserId);
    return {
      customRoomKey: record.key,
      setupRoomId: record.activeSetupRoomId,
      created: false,
    };
  }

  let startedCreation = false;
  if (!record.pendingSetupRoomId) {
    startedCreation = true;
    record.pendingSetupRoomId = createSetupRoomForKeyImpl(record.key)
      .then((setupRoomId) => {
        record.activeSetupRoomId = setupRoomId;
        record.status = "setup";
        record.version += 1;
        record.ownerUserId = ownerUserId;
        return setupRoomId;
      })
      .finally(() => {
        record.pendingSetupRoomId = null;
      });
  }

  const pendingSetupRoomId = record.pendingSetupRoomId;
  if (!pendingSetupRoomId) {
    throw new Error("pending setup room promise must exist before awaiting");
  }
  const setupRoomId = await pendingSetupRoomId;
  return {
    customRoomKey: record.key,
    setupRoomId,
    created: startedCreation,
  };
}

export async function createCustomRoom(
  ownerUserId: string | null,
  requestedKey?: string,
): Promise<CustomRoomCreation> {
  let key = requestedKey?.trim() ?? "";
  if (key) {
    if (customRooms.has(key)) {
      throw new CustomRoomAlreadyExistsError(key);
    }
  } else {
    key = generateCustomRoomKey();
    while (customRooms.has(key)) {
      key = generateCustomRoomKey();
    }
  }

  const record = createCustomRoomRecord(key, ownerUserId);
  customRooms.set(key, record);

  const pendingSetupRoomId = createSetupRoomForKeyImpl(key)
    .then((setupRoomId) => {
      record.activeSetupRoomId = setupRoomId;
      record.status = "setup";
      record.version = 1;
      return setupRoomId;
    })
    .catch((error) => {
      if (customRooms.get(key) === record) {
        customRooms.delete(key);
      }
      throw error;
    })
    .finally(() => {
      record.pendingSetupRoomId = null;
    });

  record.pendingSetupRoomId = pendingSetupRoomId;
  const setupRoomId = await pendingSetupRoomId;

  return { customRoomKey: key, setupRoomId, created: true };
}

export async function resolveCustomRoom(
  customRoomKey: string,
  ownerUserId: string | null,
): Promise<CustomRoomResolution> {
  const record =
    customRooms.get(customRoomKey) ??
    (() => {
      const newRecord = createCustomRoomRecord(customRoomKey, ownerUserId);
      customRooms.set(customRoomKey, newRecord);
      return newRecord;
    })();

  return createOrJoinPendingSetupRoom(record, ownerUserId);
}

export function markCustomRoomMatchStarted(
  customRoomKey: string,
  setupRoomId: string,
) {
  const record = customRooms.get(customRoomKey);
  if (!record || record.activeSetupRoomId !== setupRoomId) return;
  record.activeSetupRoomId = null;
  record.status = "match";
}

export function onSetupRoomDisposed(
  customRoomKey: string,
  setupRoomId: string,
) {
  const record = customRooms.get(customRoomKey);
  if (!record || record.activeSetupRoomId !== setupRoomId) return;
  record.activeSetupRoomId = null;
  record.status = "idle";
}

export function resetCustomRoomsForTesting() {
  customRooms.clear();
  createSetupRoomForKeyImpl = createSetupRoomForKey;
}

export function setCreateSetupRoomForKeyForTesting(
  createSetupRoom: (customRoomKey: string) => Promise<string>,
) {
  createSetupRoomForKeyImpl = createSetupRoom;
}
