import type { GameMode, GridType, Terrain } from "@generals-plus/engine";

export interface CellTemplate {
  terrain: Terrain;
  troopCount: number | null;
  siteIndex: number | null;
}

export interface SpawnPoint {
  x: number;
  y: number;
  teamId: string;
  slot: number;
}

export interface SquareGridBounds {
  width: number;
  height: number;
}

export interface HexGridBounds {
  left: number;
  right: number;
  leftSlant: number;
  rightSlant: number;
}

export interface GridTemplate {
  gridType: GridType;
  bounds: SquareGridBounds | HexGridBounds;
  cells: CellTemplate[][];
  track?: { x: number; y: number }[];
  spawns: SpawnPoint[];
}

export interface CustomMap {
  id: string;
  name: string;
  description: string;
  authorId: string;
  authorName: string;
  grid: GridTemplate;
  supportedModes: GameMode[];
  minPlayers: number;
  maxPlayers: number;
  tags: string[];
  status: "draft" | "published";
  stats: { plays: number; likes: number };
  thumbnail: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface CustomMapListResponse {
  maps: CustomMap[];
  total: number;
}

export interface CreateCustomMapRequest {
  name: string;
  description?: string;
  grid: GridTemplate;
  supportedModes: GameMode[];
  minPlayers: number;
  maxPlayers: number;
  tags?: string[];
  status?: "draft" | "published";
  thumbnail?: string;
}

export type UpdateCustomMapRequest = Partial<CreateCustomMapRequest>;
