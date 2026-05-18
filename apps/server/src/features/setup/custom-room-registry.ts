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

export async function createCustomRoom(
  ownerUserId: string | null,
): Promise<CustomRoomCreation> {
  let key = generateCustomRoomKey();
  while (customRooms.has(key)) {
    key = generateCustomRoomKey();
  }

  const setupRoomId = await createSetupRoomForKey(key);
  customRooms.set(key, {
    key,
    activeSetupRoomId: setupRoomId,
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

  if (record.activeSetupRoomId) {
    return {
      customRoomKey,
      setupRoomId: record.activeSetupRoomId,
      created: false,
    };
  }

  const setupRoomId = await createSetupRoomForKey(customRoomKey);
  record.activeSetupRoomId = setupRoomId;
  record.status = "setup";
  record.version += 1;
  record.ownerUserId = ownerUserId;
  return { customRoomKey, setupRoomId, created: true };
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
}
