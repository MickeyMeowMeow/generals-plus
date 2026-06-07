import { GameMode, GridType } from "@generals-plus/engine";
import * as z from "zod";

/** Schema for validating individual setup setting fields. */
export const setupSettingsUpdateSchema = z
  .object({
    gameMode: z.enum(GameMode).describe("游戏模式"),
    maxPlayers: z.number().int().min(2).describe("最大玩家人数"),
    isPublic: z.boolean().describe("房间是否公开展示"),
    playersPerTeam: z.number().int().min(1).describe("每队玩家数"),
    mapType: z.enum(GridType).describe("地图网格类型：方格或六边形"),
    mapSource: z
      .enum(["generated", "custom"])
      .describe("地图来源：程序生成或自定义地图"),
    customMapId: z
      .string()
      .describe("自定义地图 ID，在 mapSource 为 custom 时使用"),
    mapWidth: z
      .number()
      .int()
      .min(5)
      .max(100)
      .describe("方格地图宽度，范围 5 到 100"),
    mapHeight: z
      .number()
      .int()
      .min(5)
      .max(100)
      .describe("方格地图高度，范围 5 到 100"),
    mapLeft: z.number().int().min(5).max(100).describe("六边形地图左半径"),
    mapRight: z.number().int().min(5).max(100).describe("六边形地图右半径"),
    mapLeftSlant: z
      .number()
      .int()
      .min(9)
      .max(199)
      .describe("六边形地图左斜半径"),
    mapRightSlant: z
      .number()
      .int()
      .min(9)
      .max(199)
      .describe("六边形地图右斜半径"),
    seed: z.number().int().describe("地图生成随机种子"),
    mountainRate: z.number().min(0).max(1).describe("山地密度，范围 0 到 1"),
    cityRate: z.number().min(0).max(1).describe("城市密度，范围 0 到 1"),
    minGeneralDistanceFactor: z
      .number()
      .min(0)
      .max(1)
      .describe("将军最小距离系数，范围 0 到 1"),
    generalInitialTroops: z.number().int().min(1).describe("将军初始兵力"),
    cityInitialTroops: z.number().int().min(0).describe("城市初始兵力"),
    speed: z.number().min(0.5).max(10).describe("游戏速度倍率，范围 0.5 到 10"),
    duration: z.number().min(30).max(600).describe("对局持续时间，单位秒"),
    flagCount: z
      .number()
      .int()
      .min(1)
      .max(20)
      .describe("旗帜数量，仅统治模式生效"),
    targetScore: z
      .number()
      .int()
      .min(100)
      .max(10000)
      .describe("获胜分数，仅统治模式生效"),
    bombSiteCount: z
      .number()
      .int()
      .min(1)
      .max(10)
      .describe("炸弹点数量，仅爆破模式生效"),
    plantDuration: z
      .number()
      .min(1)
      .max(30)
      .describe("安包时长，单位秒，仅爆破模式生效"),
    defuseDuration: z
      .number()
      .min(1)
      .max(30)
      .describe("拆包时长，单位秒，仅爆破模式生效"),
    detonateDuration: z
      .number()
      .min(10)
      .max(300)
      .describe("爆炸倒计时，单位秒，仅爆破模式生效"),
    collapseInterval: z
      .number()
      .min(5)
      .max(300)
      .describe("塌缩波之间的间隔秒数，仅塌缩模式生效"),
    startDelay: z
      .number()
      .min(5)
      .max(600)
      .describe("首次塌缩前的延迟秒数，仅塌缩模式生效"),
    collapseShape: z
      .enum(["circle", "square"])
      .describe("塌缩区域形状，仅塌缩模式生效"),
    payloadSpeed: z
      .number()
      .min(0.5)
      .max(10)
      .describe("运载车移动速度，仅运载模式生效"),
    payloadCartSize: z
      .number()
      .int()
      .min(1)
      .max(5)
      .describe("运载车大小，仅运载模式生效"),
    payloadRequiredOccupied: z
      .number()
      .int()
      .min(1)
      .max(25)
      .describe("推动运载车所需占领人数，仅运载模式生效"),
    rugbyBallCount: z
      .number()
      .int()
      .min(1)
      .max(5)
      .describe("橄榄球数量，仅橄榄球模式生效"),
    rugbyMoveSpeed: z
      .number()
      .min(0.2)
      .max(10)
      .describe("橄榄球移动速度，仅橄榄球模式生效"),
    rugbyWinningScore: z
      .number()
      .int()
      .min(1)
      .max(20)
      .describe("获胜分数，仅橄榄球模式生效"),
    incubationDuration: z
      .number()
      .min(15)
      .max(300)
      .describe("潜伏时长，单位秒，仅生化模式生效"),
    zombieTroopMultiplier: z
      .number()
      .min(1.5)
      .max(5)
      .describe("僵尸兵力倍率，仅生化模式生效"),
  })
  .partial()
  .strict();

export type SetupSettingsUpdate = z.infer<typeof setupSettingsUpdateSchema>;
