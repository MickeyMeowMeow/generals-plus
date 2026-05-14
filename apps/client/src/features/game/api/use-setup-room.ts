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

/**
 * Shared client-side handle for one setup room connection.
 *
 * The custom-room flow creates a Colyseus setup room from `/` and immediately
 * navigates to `/match/:roomId`, where the route-level setup screen should take
 * over the same socket. Keeping this handle in module scope prevents the
 * creating component from leaving the room during that handoff and avoids a
 * second `joinById()` against a room that may be closing.
 *
 * The handle stores both the in-flight `promise` and the resolved `room` so
 * concurrent React mounts reuse the same connection attempt. `refs` counts
 * mounted consumers, while `leaveTimer` provides a short grace period for route
 * transitions and StrictMode remounts before the socket is actually closed.
 */
interface SharedSetupConnection {
  /** Resolves to the setup room connection shared by all current consumers. */
  promise: Promise<SetupRoomClient>;
  /** The resolved room instance, filled after `promise` completes. */
  room: SetupRoomClient | null;
  /** Number of mounted hooks currently using this connection. */
  refs: number;
  /** Delayed leave scheduled when the last consumer unmounts. */
  leaveTimer: ReturnType<typeof setTimeout> | null;
}

/**
 * In-memory setup connection pool.
 *
 * Entries are first registered under the requested room id or a temporary
 * default key, then normalized to the actual Colyseus `room.roomId` after the
 * connection resolves. The pool intentionally lives only for the current page
 * session; a full refresh should reconnect through the URL instead of restoring
 * stale socket state.
 */
const setupConnections = new Map<string, SharedSetupConnection>();

export function resetSetupConnectionsForTesting() {
  setupConnections.clear();
}

interface SetupRoomOptions {
  enabled?: boolean;
  roomId?: string;
}

function cloneReadySetupState(state: SetupState): SetupState | null {
  const cloned = state.clone();
  return cloned.players ? cloned : null;
}

/**
 * Create a private custom setup room and cache its live connection for the
 * upcoming `/match/:roomId` navigation.
 *
 * The lobby only exposes room creation, not a manual join form. After creation
 * the returned `roomId` becomes the shareable URL, and `useSetupRoom({ roomId })`
 * can adopt this already-open connection from `setupConnections`.
 */
export async function createCustomSetupRoom() {
  const room = await networkProvider.create<
    SetupState,
    SetupClientMessagePayload,
    SetupServerMessagePayload
  >(ROOM_NAMES.SETUP, {
    gameMode: GameMode.CLASSIC,
    isPublic: false,
  });

  setupConnections.set(room.roomId, {
    promise: Promise.resolve(room),
    room,
    refs: 0,
    leaveTimer: null,
  });
  return room;
}

/**
 * Acquire a setup room for the current route.
 *
 * If the room was created moments earlier by `createCustomSetupRoom`, this
 * returns the cached socket instead of reconnecting. Otherwise it joins the
 * provided URL room id. The room-id-less branch remains for internal callers and
 * mirrors the old join-or-create behavior without exposing a UI route for it.
 */
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
 * Release one hook's claim on a setup room.
 *
 * When the reference count reaches zero, the room is left after a short delay
 * rather than immediately. That delay is the small bridge between "old component
 * unmounted" and "new route component mounted", and it also absorbs development
 * StrictMode remounts without closing a valid room.
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
 * React hook for the `/match/:roomId` setup phase.
 *
 * It owns the setup-room lifecycle, exposes cloned setup state for rendering,
 * listens for the server seat reservation that starts the match phase, and
 * returns a `startGame` command that uses the shared protocol enum. The hook is
 * disabled until auth/routing is ready so custom-room URLs can show login first
 * and then continue connecting on the same URL.
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
