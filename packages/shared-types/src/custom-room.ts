export const CUSTOM_ROOM_KEY_MIN_LENGTH = 4;
export const CUSTOM_ROOM_KEY_MAX_LENGTH = 16;

export interface CustomRoomResolution {
  customRoomKey: string;
  setupRoomId: string;
  created: boolean;
}

export interface CustomRoomCreation extends CustomRoomResolution {}

export interface CustomRoomCreationRequest {
  customRoomKey?: string;
}

export function isValidCustomRoomKeyLength(customRoomKey: string) {
  return (
    customRoomKey.length >= CUSTOM_ROOM_KEY_MIN_LENGTH &&
    customRoomKey.length <= CUSTOM_ROOM_KEY_MAX_LENGTH
  );
}
