import * as z from "zod";

import {
  PickColorSchema,
  QueueJoinOptionsSchema,
  SeatReservationSchema,
} from "#/features/queue/schemas";

export const queueWsContracts = {
  channel: "queue",
  description: "官方匹配队列房间，用于排位和公开游戏模式。",
  joinOptions: QueueJoinOptionsSchema.describe("客户端提供的排队选项"),
  clientToServer: {
    confirm: {
      summary: "确认座位预约并进入对战房间",
      payload: z.object({}).describe("无请求体"),
    },
    pickColor: {
      summary: "在排队过程中选择颜色",
      payload: PickColorSchema,
    },
  },
  serverToClient: {
    error: {
      summary: "队列错误消息",
      payload: z.string().describe("面向用户展示的错误消息"),
    },
    seat: {
      summary: "已匹配成功并下发座位预约信息",
      payload: SeatReservationSchema,
    },
  },
};
