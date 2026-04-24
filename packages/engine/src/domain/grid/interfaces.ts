import type { ICell } from "@/domain/cell/interfaces";
import type { IEffectTarget } from "@/domain/effect/interfaces";
import type { IGrid2D } from "@/math/grid-2d";

export interface IGrid extends IGrid2D<ICell>, IEffectTarget {}
