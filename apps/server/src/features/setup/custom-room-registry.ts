import { matchMaker } from "@colyseus/core";
import { GameMode } from "@generals-plus/engine";
import { ROOM_NAMES } from "@generals-plus/shared-types";

interface CustomRoomResolution {
  customRoomKey: string;
  setupRoomId: string;
  created: boolean;
}

interface CustomRoomCreation extends CustomRoomResolution {}

interface CustomRoomRecord {
  key: string;
  activeSetupRoomId: string | null;
  pendingSetupRoomId: Promise<string> | null;
  status: "setup" | "match" | "idle";
  version: number;
  ownerUserId: string | null;
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

async function createOrJoinPendingSetupRoom(
  record: CustomRoomRecord,
  ownerUserId: string | null,
): Promise<CustomRoomResolution> {
  if (record.activeSetupRoomId) {
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
): Promise<CustomRoomCreation> {
  let key = generateCustomRoomKey();
  while (customRooms.has(key)) {
    key = generateCustomRoomKey();
  }

  const setupRoomId = await createSetupRoomForKeyImpl(key);
  customRooms.set(key, {
    key,
    activeSetupRoomId: setupRoomId,
    pendingSetupRoomId: null,
    status: "setup",
    version: 1,
    ownerUserId,
  });

  return { customRoomKey: key, setupRoomId, created: true };
}

export async function resolveCustomRoom(
  customRoomKey: string,
  ownerUserId: string | null,
): Promise<CustomRoomResolution | null> {
  const record = customRooms.get(customRoomKey);
  if (!record) return null;

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
