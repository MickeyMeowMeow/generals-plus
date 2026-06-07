import * as z from "zod";

import { SeatReservationSchema } from "#/features/queue/schemas";

export const vsAiWsContracts = {
  channel: "vs-ai",
  description: "即时 1v1 人机对战房间。认证用户加入后会立即创建机器人对局。",
  joinOptions: z
    .object({})
    .describe("无需额外参数；通过认证令牌识别玩家身份。"),
  clientToServer: {
    confirm: {
      summary: "确认已创建人机对局的座位预约信息",
      payload: z.object({}).describe("无请求体"),
    },
  },
  serverToClient: {
    seat: {
      summary: "已创建对战房间的座位预约信息",
      payload: SeatReservationSchema,
    },
  },
};
