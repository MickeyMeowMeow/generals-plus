export interface CustomRoomResolution {
  customRoomKey: string;
  setupRoomId: string;
  created: boolean;
}

export interface CustomRoomCreation extends CustomRoomResolution {}
