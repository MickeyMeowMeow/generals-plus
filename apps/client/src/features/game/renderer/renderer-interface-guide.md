# Pixi Renderer Interface Guide

本文档面向前端上层状态管理、服务端数据映射、比赛页面和后续对接 agent，说明 PixiJS 渲染层对外需要什么输入、会抛出什么事件，以及哪些内部接口不应该被业务层直接依赖。

## 对接边界

渲染层入口是：

- `apps/client/src/features/game/renderer/GameApp.tsx`

对接时应优先依赖：

- `apps/client/src/features/game/renderer/render-types.ts`

渲染层只负责：

- 把上层传入的地图快照渲染成 Pixi 网格。
- 维护纯 UI 状态，例如选中、悬停、框选。
- 将用户交互通过 callback 抛给上层。

渲染层不负责：

- 不直接读取 Colyseus Schema。
- 不发 WebSocket 请求。
- 不计算战斗、移动、产兵、视野。
- 不决定玩家颜色分配。
- 不维护真实比赛状态。

## 公共输入类型

### `TerrainType`

定义位置：

```ts
export type TerrainType = Terrain;
```

来源：

- `@generals-plus/engine` 的 `Terrain`

含义：

- 表示渲染层要显示的地形类型。
- 上层需要将服务端或引擎层地形字段映射成该类型。

当前常见值包括：

- `plain`
- `general`
- `mountain`
- `swamp`
- `desert`
- `city`
- `void`

### `RenderPoint`

定义：

```ts
export interface RenderPoint {
  readonly x: number;
  readonly y: number;
}
```

用途：

- 表示网格坐标，而不是像素坐标。
- `x` 是列坐标，从左到右递增。
- `y` 是行坐标，从上到下递增。

使用场景：

- 移动队列的起点和终点。
- 框选回调返回的格子坐标。
- 渲染层内部坐标索引。

约束：

- `x` 应满足 `0 <= x < width`。
- `y` 应满足 `0 <= y < height`。

### `RenderCell`

定义：

```ts
export interface RenderCell {
  readonly x: number;
  readonly y: number;
  readonly terrain: TerrainType;
  readonly troopCount: number;
  readonly ownerIndex: number;
  readonly isVisible: boolean;
}
```

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `x` | `number` | 格子列坐标。 |
| `y` | `number` | 格子行坐标。 |
| `terrain` | `TerrainType` | 当前格子的地形。 |
| `troopCount` | `number` | 当前格子显示的兵力数量。 |
| `ownerIndex` | `number` | 所有者索引，`-1` 表示无主。 |
| `isVisible` | `boolean` | 当前玩家是否能看到该格子。 |

渲染行为：

- `isVisible === false`：
  - 只显示深色迷雾遮罩。
  - 不显示地形图标。
  - 不显示所有权颜色。
  - 不显示兵力数字。
  - 不响应点击、悬停、框选结果。
- `ownerIndex === -1`：
  - 不叠加玩家颜色。
  - 兵力数字使用中立颜色。
- `ownerIndex !== -1`：
  - 必须在 `players` 中存在对应 `RenderPlayer.index`。
  - 如果找不到玩家，渲染层会抛错，不做兜底颜色。
- `troopCount <= 0`：
  - 不显示兵力数字。

对接要求：

- 同一个 `cells` 数组中不能出现重复坐标。
- 坐标不能越界。
- 上层需要自己完成服务端 Schema 到 `RenderCell` 的映射。

### `RenderPlayer`

定义：

```ts
export interface RenderPlayer {
  readonly index: number;
  readonly color: number;
  readonly username: string;
}
```

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `index` | `number` | 玩家索引，被 `RenderCell.ownerIndex` 引用。 |
| `color` | `number` | Pixi 颜色值，格式为 `0xRRGGBB`。 |
| `username` | `string` | 玩家名，目前渲染层保留字段，后续可用于 tooltip、计分板、调试。 |

对接要求：

- `index` 不能重复。
- `color` 由上层决定，渲染层不分配颜色。
- 所有非 `-1` 的 `ownerIndex` 都必须能在 `players` 中找到对应玩家。

示例：

```ts
const players: RenderPlayer[] = [
  { index: 0, color: 0xe11d48, username: "Alice" },
  { index: 1, color: 0x2563eb, username: "Bob" },
];
```

### `MoveQueueItem`

定义：

```ts
export interface MoveQueueItem {
  readonly from: RenderPoint;
  readonly to: RenderPoint;
  readonly isSplit: boolean;
  readonly order: number;
}
```

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `from` | `RenderPoint` | 移动起点格子。 |
| `to` | `RenderPoint` | 移动目标格子。 |
| `isSplit` | `boolean` | 是否为半数移动。 |
| `order` | `number` | 队列顺序，也用于删除回调标识。 |

渲染行为：

- 每个队列项会渲染一条从 `from` 到 `to` 的箭头。
- `isSplit === true` 使用半数移动样式。
- `isSplit === false` 使用全数移动样式。
- 箭头中点显示 `order` 序号。
- 点击序号区域会触发 `onQueueItemRemove(order)`。

对接要求：

- `from` 和 `to` 应为合法格子坐标。
- `order` 应在当前队列中稳定且唯一，便于上层删除对应指令。

## 顶层渲染输入

### `GameMapProps`

定义：

```ts
export interface GameMapProps {
  readonly width: number;
  readonly height: number;
  readonly cells: readonly RenderCell[];
  readonly players: readonly RenderPlayer[];
  readonly moveQueue: readonly MoveQueueItem[];
}
```

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `width` | `number` | 地图宽度，单位是格子数。 |
| `height` | `number` | 地图高度，单位是格子数。 |
| `cells` | `readonly RenderCell[]` | 当前地图格子快照。 |
| `players` | `readonly RenderPlayer[]` | 当前参与渲染的玩家列表。 |
| `moveQueue` | `readonly MoveQueueItem[]` | 当前玩家本地移动队列。 |

对接要求：

- `width` 和 `height` 必须大于 0。
- `cells` 推荐包含完整地图的格子快照。
- 如果后续要做更细粒度更新，上层仍应保持 `RenderCell` 的字段语义不变。

最小可运行示例：

```ts
const props: GameMapProps = {
  width: 2,
  height: 2,
  cells: [
    {
      x: 0,
      y: 0,
      terrain: Terrain.PLAIN,
      troopCount: 12,
      ownerIndex: 0,
      isVisible: true,
    },
    {
      x: 1,
      y: 0,
      terrain: Terrain.MOUNTAIN,
      troopCount: 0,
      ownerIndex: -1,
      isVisible: true,
    },
    {
      x: 0,
      y: 1,
      terrain: Terrain.CITY,
      troopCount: 40,
      ownerIndex: -1,
      isVisible: true,
    },
    {
      x: 1,
      y: 1,
      terrain: Terrain.PLAIN,
      troopCount: 0,
      ownerIndex: -1,
      isVisible: false,
    },
  ],
  players: [{ index: 0, color: 0xe11d48, username: "Alice" }],
  moveQueue: [
    {
      from: { x: 0, y: 0 },
      to: { x: 1, y: 0 },
      isSplit: false,
      order: 1,
    },
  ],
};
```

## 回调接口

### `GameMapCallbacks`

定义：

```ts
export interface GameMapCallbacks {
  onCellClick?(x: number, y: number): void;
  onCellHover?(x: number, y: number): void;
  onCellLeave?(): void;
  onCellsSelect?(cells: RenderPoint[]): void;
  onQueueItemRemove?(order: number): void;
}
```

### `onCellClick`

触发时机：

- 用户左键点击一个可见格子。

参数：

- `x`：格子列坐标。
- `y`：格子行坐标。

渲染层内部行为：

- 点击未选中格子时，渲染层显示选中边框。
- 点击另一个格子时，选中边框转移。
- 再次点击同一格子时，取消选中边框。

上层建议行为：

- 判断该格子是否属于当前玩家。
- 决定是否进入移动起点选择、技能选择或其他 UI 状态。

注意：

- 迷雾格子不会触发该回调。
- 渲染层不判断格子是否可移动或是否属于当前玩家。

### `onCellHover`

触发时机：

- 鼠标进入一个可见格子。
- 鼠标从一个可见格子移动到另一个可见格子。

参数：

- `x`：格子列坐标。
- `y`：格子行坐标。

渲染层内部行为：

- 显示悬停边框。

上层建议行为：

- 更新 HUD 中的格子信息。
- 显示坐标、地形、兵力、所有者等只读信息。

注意：

- 悬停同一格子不会重复触发。
- 迷雾格子不会触发。

### `onCellLeave`

触发时机：

- 鼠标离开可见格子区域。
- 鼠标移动到地图外。
- 鼠标移动到迷雾格子导致当前 hover 清空。

参数：

- 无。

上层建议行为：

- 清除 HUD 中的 hover 信息。

### `onCellsSelect`

触发时机：

- 用户左键拖拽形成框选区域，并释放鼠标。

参数：

- `cells`：框选区域内所有可见格子的坐标列表。

渲染层内部行为：

- 拖拽过程中显示框选矩形。
- 释放后清除框选矩形。

上层建议行为：

- 批量选择己方格子。
- 批量生成移动指令。
- 进入多选操作面板。

注意：

- 返回列表只包含可见格子。
- 迷雾格子会被过滤掉。
- 渲染层不判断格子所有权，上层需要自己过滤己方格子。

### `onQueueItemRemove`

触发时机：

- 用户点击移动队列箭头中间的序号标记。

参数：

- `order`：被点击队列项的序号。

上层建议行为：

- 从本地移动队列中删除对应 `order` 的队列项。
- 如队列已经同步到服务端，上层负责发送取消或重建队列的协议消息。

注意：

- 渲染层只发出删除意图，不直接修改上层 `moveQueue`。

## 视口接口

### `RenderViewportState`

定义：

```ts
export interface RenderViewportState {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly scale: number;
}
```

用途：

- 描述当前 Pixi viewport 在世界坐标中的可视范围。
- `GridLayer` 使用该对象进行视口裁剪。
- `GridCellView` 使用 `scale` 判断是否显示兵力数字。

注意：

- 该接口目前由 `GameApp` 通过 `Viewport.onViewportChange` 维护。
- 普通业务层对接 `GameApp` 时不需要手动传入 `RenderViewportState`。
- 如果直接对接 `GridLayer`，才需要传入该字段。

### `ViewportBounds`

定义位置：

- `apps/client/src/components/pixi/Viewport.tsx`

字段：

- `left`
- `top`
- `right`
- `bottom`
- `scale`

用途：

- `Viewport` 对外发布当前 Pixi 视口状态。
- 字段语义与 `RenderViewportState` 相同。

## 推荐对接方式

比赛页面或状态管理层建议这样对接：

```tsx
<GameApp
  width={state.width}
  height={state.height}
  cells={renderCells}
  players={renderPlayers}
  moveQueue={localMoveQueue}
  onCellClick={(x, y) => {
    // 更新选中起点或生成移动意图
  }}
  onCellHover={(x, y) => {
    // 更新 HUD hover 信息
  }}
  onCellLeave={() => {
    // 清除 HUD hover 信息
  }}
  onCellsSelect={(cells) => {
    // 批量选择或批量指令
  }}
  onQueueItemRemove={(order) => {
    // 删除本地队列项
  }}
/>
```

上层映射建议：

- Colyseus Schema 或后端 DTO 不要直接传给 `GameApp`。
- 建议在 match store 或 adapter 层集中转换为 `RenderCell[]`、`RenderPlayer[]` 和 `MoveQueueItem[]`。
- 渲染层数据应尽量保持不可变更新，方便 React memo 和 diff 正常工作。

## 内部实现接口

以下类目前属于渲染层内部实现，业务层不要直接依赖：

- `CellKeyFormatter`
- `RenderPlayerIndex`
- `RenderCellIndex`
- `ViewportCuller`
- `GridCoordinateMapper`
- `SelectionRect`
- `PointerDragState`

它们定义在：

- `apps/client/src/features/game/renderer/grid-model.ts`

内部职责：

- 坐标键格式化。
- 玩家颜色索引。
- 格子索引和校验。
- viewport 裁剪。
- Pixi 世界坐标到网格坐标的转换。
- 框选矩形建模。
- 拖拽状态建模。

## 内部组件职责

以下组件位于 `apps/client/src/features/game/renderer/components/`，通常不由业务层直接使用：

- `GridCellView.tsx`
  - 渲染单个格子的地形、所有权叠色、图标、兵力数字、迷雾。
  - 使用 memo 减少未变化格子的重绘。
- `InteractionLayer.tsx`
  - 处理点击、悬停、框选。
  - 维护选中、悬停、框选框这些渲染层内部 UI 状态。
- `MoveQueueLayer.tsx`
  - 渲染移动队列箭头和序号。
  - 点击序号时触发队列项删除回调。

## 常见错误

### `Missing render player for owner index`

原因：

- 某个 `RenderCell.ownerIndex` 不是 `-1`，但 `players` 中不存在同 index 的 `RenderPlayer`。

解决：

- 检查上层玩家数组映射。
- 保证所有格子的 owner 都有对应玩家。

### `Duplicate render cell coordinate`

原因：

- `cells` 中存在两个相同 `x:y` 的格子。

解决：

- 检查服务端状态到 `RenderCell[]` 的转换逻辑。
- 确保每个地图坐标只输出一次。

### `Render cell is out of bounds`

原因：

- 某个格子坐标不满足地图尺寸。

解决：

- 检查 `width`、`height` 和 `cells` 是否来自同一份地图快照。

### 点击或悬停没有回调

可能原因：

- 格子 `isVisible` 为 `false`。
- 鼠标点击的是右键或中键。
- 上层没有传入对应 callback。

### 兵力数字不显示

可能原因：

- `troopCount <= 0`。
- `isVisible === false`。
- 当前 viewport 缩放低于 `RenderConfig.troopTextMinScale`。

