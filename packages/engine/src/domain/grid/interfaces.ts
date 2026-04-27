import type { ICell } from "#/domain/cell/interfaces";
import type { EffectTarget } from "#/domain/effect/effect-target";
import type { IGrid2D } from "#/math/grid-2d";

export interface IGrid extends IGrid2D<ICell>, EffectTarget {}
