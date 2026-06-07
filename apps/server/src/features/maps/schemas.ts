import { GameMode, GridType, Terrain } from "@generals-plus/engine";
import * as z from "zod";

const TerrainSchema = z.enum(Terrain);

const CellTemplateSchema = z.object({
  terrain: TerrainSchema.describe("格子的地形类型"),
  troopCount: z
    .number()
    .nullable()
    .default(null)
    .describe("初始兵力；非城市格子时为 null"),
  siteIndex: z
    .number()
    .int()
    .min(0)
    .nullable()
    .default(null)
    .describe("炸弹点或旗帜的点位索引"),
  zoneIndex: z
    .number()
    .int()
    .min(0)
    .nullable()
    .default(null)
    .describe("目标区域索引"),
});

const SpawnPointSchema = z.object({
  x: z.number().int().describe("网格上的 X 坐标"),
  y: z.number().int().describe("网格上的 Y 坐标"),
  teamId: z.string().min(1).describe("该出生点所属队伍标识"),
  slot: z.number().int().min(0).describe("该队伍内的玩家槽位索引"),
});

const CoordinateSchema = z.object({
  x: z.number().int().describe("X 坐标"),
  y: z.number().int().describe("Y 坐标"),
});

const SquareBoundsSchema = z.object({
  width: z.number().int().min(5).max(100).describe("网格宽度，范围 5 到 100"),
  height: z.number().int().min(5).max(100).describe("网格高度，范围 5 到 100"),
});

const HexBoundsSchema = z.object({
  left: z.number().int().min(1).describe("左半径"),
  right: z.number().int().min(1).describe("右半径"),
  leftSlant: z.number().int().min(3).describe("左斜半径"),
  rightSlant: z.number().int().min(3).describe("右斜半径"),
});

const GridTemplateSchema = z.discriminatedUnion("gridType", [
  z.object({
    gridType: z.literal(GridType.SQUARE).describe("方格地图类型"),
    bounds: SquareBoundsSchema.describe("方格地图尺寸"),
    cells: z.array(z.array(CellTemplateSchema)).describe("二维格子模板数组"),
    track: z.array(CoordinateSchema).optional().describe("运载模式轨道路径点"),
    spawns: z.array(SpawnPointSchema).describe("出生点定义"),
  }),
  z.object({
    gridType: z.literal(GridType.HEX).describe("六边形地图类型"),
    bounds: HexBoundsSchema.describe("六边形地图尺寸"),
    cells: z.array(z.array(CellTemplateSchema)).describe("二维格子模板数组"),
    track: z.array(CoordinateSchema).optional().describe("运载模式轨道路径点"),
    spawns: z.array(SpawnPointSchema).describe("出生点定义"),
  }),
]);

export const createMapSchema = z.object({
  name: z.string().min(1).max(100).describe("地图名称，长度 1 到 100"),
  description: z
    .string()
    .max(1000)
    .optional()
    .describe("地图说明，最大长度 1000"),
  grid: GridTemplateSchema.describe("地图网格布局定义"),
  supportedModes: z
    .array(z.enum(GameMode))
    .min(1)
    .describe("支持的游戏模式，至少 1 个"),
  minPlayers: z.number().int().min(2).describe("最小玩家人数"),
  maxPlayers: z.number().int().min(2).describe("最大玩家人数"),
  tags: z.array(z.string()).optional().describe("可检索标签"),
  status: z.enum(["draft", "published"]).optional().describe("发布状态"),
  thumbnail: z.string().optional().describe("缩略图 URL"),
});

export const updateMapSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .optional()
    .describe("地图名称，长度 1 到 100"),
  description: z
    .string()
    .max(1000)
    .optional()
    .describe("地图说明，最大长度 1000"),
  grid: GridTemplateSchema.optional().describe("地图网格布局定义"),
  supportedModes: z
    .array(z.enum(GameMode))
    .min(1)
    .optional()
    .describe("支持的游戏模式，至少 1 个"),
  minPlayers: z.number().int().min(2).optional().describe("最小玩家人数"),
  maxPlayers: z.number().int().min(2).optional().describe("最大玩家人数"),
  tags: z.array(z.string()).optional().describe("可检索标签"),
  status: z.enum(["draft", "published"]).optional().describe("发布状态"),
  thumbnail: z.string().optional().describe("缩略图 URL"),
});

export type CreateMapInput = z.infer<typeof createMapSchema>;
export type UpdateMapInput = z.infer<typeof updateMapSchema>;

export const MapResponseSchema = z.object({
  id: z.string().describe("地图唯一标识"),
  name: z.string().describe("地图名称"),
  description: z.string().describe("地图说明"),
  authorId: z.string().describe("作者用户 ID"),
  authorName: z.string().describe("作者显示名称"),
  grid: GridTemplateSchema.describe("地图网格布局定义"),
  supportedModes: z.array(z.enum(GameMode)).describe("支持的游戏模式"),
  minPlayers: z.number().describe("最小玩家人数"),
  maxPlayers: z.number().describe("最大玩家人数"),
  tags: z.array(z.string()).describe("可检索标签"),
  status: z.enum(["draft", "published"]).describe("发布状态"),
  stats: z
    .object({
      plays: z.number().describe("总游玩次数"),
      likes: z.number().describe("总点赞数"),
    })
    .describe("地图统计信息"),
  thumbnail: z.string().describe("缩略图 URL"),
  createdAt: z.union([z.string(), z.date()]).describe("创建时间戳"),
  updatedAt: z.union([z.string(), z.date()]).describe("最后更新时间戳"),
});

export const MapListResponseSchema = z.object({
  maps: z.array(MapResponseSchema).describe("当前页地图数组"),
  total: z.number().int().describe("已发布地图总数"),
});

export const ToggleLikeResponseSchema = z.object({
  result: z.enum(["liked", "unliked"]).describe("点赞切换结果"),
});

export const MapQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).describe("页码，从 1 开始"),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .describe("每页条目数，最大 50"),
  mode: z.enum(GameMode).optional().describe("按游戏模式筛选"),
  sort: z.enum(["plays", "likes", "date"]).optional().describe("排序方式"),
  search: z.string().optional().describe("地图名称或作者的搜索关键词"),
});

export const MapIdParamsSchema = z.object({
  id: z.string().describe("地图唯一标识"),
});
