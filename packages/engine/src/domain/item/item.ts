import type { IItem } from "#/domain/item/interfaces";
import type { ItemType } from "#/domain/item/item-type";
import type { ICoordinate } from "#/math/coordinate";

export class GameItem implements IItem {
  readonly type: ItemType;
  readonly id: string;
  coordinate: ICoordinate;

  constructor(type: ItemType, id: string, coordinate: ICoordinate) {
    this.type = type;
    this.id = id;
    this.coordinate = coordinate;
  }
}
