import { GameMode } from "@generals-plus/engine";
import type {
  SeatReservation,
  SetupClientMessagePayload,
  SetupServerMessagePayload,
  SetupSettings,
  SetupState,
} from "@generals-plus/shared-types";
import {
  ROOM_NAMES,
  SetupClientMessage,
  SetupServerMessage,
} from "@generals-plus/shared-types";
import { useEffect, useState } from "react";

import { networkProvider } from "#/infra/network/provider";
import type { RoomClient } from "#/infra/network/room";

type SetupRoomClient = RoomClient<
  SetupState,
  SetupClientMessagePayload,
  SetupServerMessagePayload
>;

interface SharedSetupConnection {
  promise: Promise<SetupRoomClient>;
  room: SetupRoomClient | null;
  refs: number;
  leaveTimer: ReturnType<typeof setTimeout> | null;
}

const setupConnections = new Map<string, SharedSetupConnection>();

export function resetSetupConnectionsForTesting() {
  setupConnections.clear();
}

interface SetupRoomOptions {
  enabled?: boolean;
  roomId?: string;
}

/**
 * Clone only setup states that have received their required schema containers.
 *
 * Creating a room and navigating by URL can race with Colyseus' initial patch:
 * the room object may exist before `players` is populated. Returning `null`
 * keeps the UI in its joining state until a render-safe setup state arrives.
 */
function cloneReadySetupState(state: SetupState): SetupState | null {
  const cloned = state.clone();
  return cloned.players ? cloned : null;
}

function acquireSetupRoom(roomId: string | undefined) {
  if (roomId) {
    const existing = setupConnections.get(roomId);
    if (existing) {
      existing.refs++;
      if (existing.leaveTimer) {
        clearTimeout(existing.leaveTimer);
        existing.leaveTimer = null;
      }
      return existing.promise;
    }
  }

  const promise = roomId
    ? networkProvider.joinById<
        SetupState,
        SetupClientMessagePayload,
        SetupServerMessagePayload
      >(roomId)
    : networkProvider.joinOrCreate<
        SetupState,
        SetupClientMessagePayload,
        SetupServerMessagePayload
      >(ROOM_NAMES.SETUP, { gameMode: GameMode.CLASSIC });

  const key = roomId ?? "__default_setup__";
  const entry: SharedSetupConnection = {
    refs: 1,
    room: null,
    leaveTimer: null,
    promise: promise
      .then((room) => {
        setupConnections.delete(key);
        const roomEntry = setupConnections.get(room.roomId);
        if (roomEntry && roomEntry !== entry) {
          return roomEntry.promise;
        }
        entry.room = room;
        setupConnections.set(room.roomId, entry);
        return room;
      })
      .catch((error) => {
        if (setupConnections.get(key) === entry) {
          setupConnections.delete(key);
        }
        throw error;
      }),
  };
  setupConnections.set(key, entry);
  return entry.promise;
}

/**
 * Release one hook's claim on a setup room after a short route-handoff delay.
 */
function releaseSetupRoom(room: SetupRoomClient | null, roomId?: string) {
  const key = room?.roomId ?? roomId;
  if (!key) return;

  const entry = setupConnections.get(key);
  if (!entry) return;

  entry.refs = Math.max(0, entry.refs - 1);
  if (entry.refs > 0 || entry.leaveTimer) return;

  entry.leaveTimer = setTimeout(() => {
    const current = setupConnections.get(key);
    if (!current || current.refs > 0) return;
    setupConnections.delete(key);
    void current.promise.then((setupRoom) => setupRoom.leave()).catch(() => {});
  }, 500);
}

/**
 * Own one concrete setup-room connection and surface its render-safe state.
 */
export function useSetupRoom({
  enabled = true,
  roomId,
}: SetupRoomOptions = {}) {
  const [room, setRoom] = useState<SetupRoomClient | null>(null);
  const [setupState, setSetupState] = useState<SetupState | null>(null);
  const [seatReservation, setSeatReservation] =
    useState<SeatReservation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let currentRoom: SetupRoomClient | null = null;
    let isCurrent = true;
    const unsubscribers: Array<() => void> = [];

    const connect = async () => {
      setIsConnecting(true);
      setError(null);
      setRoom(null);
      setSetupState(null);
      try {
        currentRoom = await acquireSetupRoom(roomId);

        if (!isCurrent) {
          return;
        }
        setRoom(currentRoom);
        const currentState = cloneReadySetupState(currentRoom.state);
        if (currentState) {
          setSetupState(currentState);
          setIsConnecting(false);
        }

        unsubscribers.push(
          currentRoom.onStateChange((state) => {
            const nextState = cloneReadySetupState(state);
            if (!nextState) return;
            setSetupState(nextState);
            setIsConnecting(false);
          }),
        );
        unsubscribers.push(
          currentRoom.onMessage(
            SetupServerMessage.SEAT_RESERVATION,
            (reservation) => {
              setSeatReservation(reservation);
            },
          ),
        );
        unsubscribers.push(
          currentRoom.onMessage(SetupServerMessage.ERROR, (message) => {
            setError(message);
          }),
        );
      } catch (e) {
        if (!isCurrent) return;
        setIsConnecting(false);
        setError(e instanceof Error ? e.message : "Failed to join setup room");
      }
    };

    connect();

    return () => {
      isCurrent = false;
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
      releaseSetupRoom(currentRoom, roomId);
    };
  }, [enabled, roomId]);

  const startGame = () => {
    room?.send(SetupClientMessage.START_GAME);
  };

  const updateSettings = (settings: Partial<SetupSettings>) => {
    room?.send(SetupClientMessage.UPDATE_SETTINGS, settings);
  };

  const clearSeatReservation = () => {
    setSeatReservation(null);
    setRoom(null);
    setSetupState(null);
    setError(null);
  };

  return {
    room,
    setupState,
    seatReservation,
    startGame,
    updateSettings,
    clearSeatReservation,
    error,
    isConnecting,
  };
}
