import * as z from "zod";

import {
  ActionSchema,
  ClientPingSchema,
  GameResultSchema,
  ServerPingSchema,
} from "#/features/match/schemas";

export const matchWsContracts = {
  channel: "match",
  description: "进行中的对战房间。仅能通过座位预约信息加入。",
  joinOptions: z
    .object({})
    .describe("无需额外参数；客户端通过座位预约信息加入。"),
  clientToServer: {
    action: {
      summary: "提交游戏操作",
      payload: ActionSchema,
    },
    clear_queue: {
      summary: "清空玩家已排队的操作",
      payload: z.object({}).describe("无请求体"),
    },
    ping: {
      summary: "发送仅队友可见的地图标记",
      payload: ClientPingSchema,
    },
  },
  serverToClient: {
    game_end: {
      summary: "对局结束",
      payload: GameResultSchema,
    },
    ping: {
      summary: "队内地图标记广播",
      payload: ServerPingSchema,
    },
  },
};
