import { GameMode } from "@generals-plus/engine";
import * as z from "zod";

import {
  PickColorSchema,
  SeatReservationSchema,
} from "#/features/queue/schemas";
import { setupSettingsUpdateSchema } from "#/features/setup/schemas";

const ToastSeveritySchema = z.enum(["info", "warning", "error", "success"]);

const SetupJoinOptionsSchema = z.object({
  gameMode: z
    .enum(GameMode)
    .describe("用于列出和加入 setup 房间的游戏模式"),
});

const SetupRoomCreationOptionsSchema = z.object({
  gameMode: z
    .enum(GameMode)
    .default(GameMode.CLASSIC)
    .describe("创建 setup 房间时的初始游戏模式"),
  isPublic: z
    .boolean()
    .default(true)
    .describe("房间是否在公开列表中可见"),
  maxPlayers: z
    .number()
    .int()
    .min(2)
    .optional()
    .describe("房间可选的最大玩家数覆盖值"),
  customRoomKey: z
    .string()
    .optional()
    .describe("服务端为私有 setup 房间预置的自定义房间密钥"),
});

const SetupValidationFailedSchema = z.object({
  message: z.string().describe("面向用户展示的校验错误消息"),
  severity: ToastSeveritySchema.describe("提示消息严重级别"),
  field: z.string().optional().describe("校验失败的字段"),
});

export const setupWsContracts = {
  channel: "setup",
  description:
    "赛前配置大厅，用于在创建正式对战房间前配置自定义对局。",
  joinOptions: SetupJoinOptionsSchema,
  roomCreationOptions: SetupRoomCreationOptionsSchema,
  clientToServer: {
    pickColor: {
      summary: "选择颜色",
      payload: PickColorSchema,
    },
    pickTeam: {
      summary: "选择已有队伍或请求创建新队伍",
      payload: z.object({
        teamId: z.string().optional().describe("要加入的已有队伍 ID"),
        createNew: z.boolean().optional().describe("是否请求创建新队伍"),
      }),
    },
    updateSettings: {
      summary: "仅房主可用：更新游戏配置",
      payload: setupSettingsUpdateSchema,
    },
    start: {
      summary: "仅房主可用：开始游戏",
      payload: z.object({}).describe("无请求体"),
    },
  },
  serverToClient: {
    error: {
      summary: "房间错误消息",
      payload: z.string().describe("面向用户展示的错误消息"),
    },
    validationFailed: {
      summary: "设置更新或开局校验失败",
      payload: SetupValidationFailedSchema,
    },
    seat: {
      summary: "游戏已开始，并已下发座位预约信息",
      payload: SeatReservationSchema,
    },
  },
};
