import type { GameMode } from "@generals-plus/engine";

import type {
  IMap,
  IMapRepository,
  MapCreateOptions,
  MapUpdateOptions,
} from "#/infra/db/interfaces";
import type { IMapDocument } from "#/infra/db/models/map-model";
import { MapModel } from "#/infra/db/models/map-model";

export class MongoMapRepository implements IMapRepository {
  private mapToEntity(doc: IMapDocument): IMap {
    return {
      id: doc._id.toString(),
      name: doc.name,
      description: doc.description,
      authorId: doc.authorId,
      authorName: doc.authorName,
      grid: doc.grid,
      supportedModes: doc.supportedModes,
      minPlayers: doc.minPlayers,
      maxPlayers: doc.maxPlayers,
      tags: doc.tags,
      status: doc.status,
      stats: doc.stats,
      thumbnail: doc.thumbnail,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async create(
    authorId: string,
    authorName: string,
    options: MapCreateOptions,
  ): Promise<IMap> {
    const map = new MapModel({
      ...options,
      authorId,
      authorName,
      description: options.description ?? "",
      tags: options.tags ?? [],
      status: options.status ?? "draft",
      thumbnail: options.thumbnail ?? "",
    });
    const saved = await map.save();
    return this.mapToEntity(saved);
  }

  async findById(id: string): Promise<IMap | null> {
    const map = await MapModel.findById(id).exec();
    return map ? this.mapToEntity(map) : null;
  }

  async findByAuthor(authorId: string): Promise<IMap[]> {
    const maps = await MapModel.find({ authorId })
      .sort({ updatedAt: -1 })
      .exec();
    return maps.map((m) => this.mapToEntity(m));
  }

  async findPublished(options: {
    page?: number;
    limit?: number;
    mode?: GameMode;
    sort?: "plays" | "likes" | "date";
    search?: string;
  }): Promise<{ maps: IMap[]; total: number }> {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(50, Math.max(1, options.limit ?? 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { status: "published" };
    if (options.mode) {
      filter.supportedModes = options.mode;
    }

    if (options.search) {
      const escapedSearch = options.search.replace(
        /[-/\\^$*+?.()|[\]{}]/g,
        "\\$&",
      );
      filter.$or = [
        { name: { $regex: escapedSearch, $options: "i" } },
        { authorName: { $regex: escapedSearch, $options: "i" } },
        { description: { $regex: escapedSearch, $options: "i" } },
      ];
    }

    const sortOptions: Record<string, 1 | -1> =
      options.sort === "plays"
        ? { "stats.plays": -1 }
        : options.sort === "likes"
          ? { "stats.likes": -1 }
          : { updatedAt: -1 };

    const [maps, total] = await Promise.all([
      MapModel.find(filter).sort(sortOptions).skip(skip).limit(limit).exec(),
      MapModel.countDocuments(filter),
    ]);

    return { maps: maps.map((m) => this.mapToEntity(m)), total };
  }

  async update(
    id: string,
    authorId: string,
    update: MapUpdateOptions,
  ): Promise<IMap | null> {
    const map = await MapModel.findOneAndUpdate(
      { _id: id, authorId },
      { $set: update },
      { new: true, runValidators: true },
    ).exec();
    return map ? this.mapToEntity(map) : null;
  }

  async delete(id: string, authorId?: string): Promise<boolean> {
    const filter: Record<string, unknown> = { _id: id };
    if (authorId) {
      filter.authorId = authorId;
    }
    const result = await MapModel.deleteOne(filter).exec();
    return result.deletedCount > 0;
  }

  async incrementPlays(id: string): Promise<void> {
    await MapModel.updateOne(
      { _id: id },
      { $inc: { "stats.plays": 1 } },
    ).exec();
  }

  async toggleLike(id: string, userId: string): Promise<"liked" | "unliked"> {
    const LikeModel = (await import("#/infra/db/models/like-model")).LikeModel;
    const existing = await LikeModel.findOne({ mapId: id, userId }).exec();
    if (existing) {
      await existing.deleteOne();
      await MapModel.updateOne(
        { _id: id },
        { $inc: { "stats.likes": -1 } },
      ).exec();
      return "unliked";
    }
    await LikeModel.create({ mapId: id, userId });
    await MapModel.updateOne(
      { _id: id },
      { $inc: { "stats.likes": 1 } },
    ).exec();
    return "liked";
  }
}
