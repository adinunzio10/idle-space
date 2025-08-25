export interface Player {
  id: string;
  name: string;
  level: number;
  experience: number;
  createdAt: number;
  lastActiveAt: number;
  settings: PlayerSettings;
  statistics: PlayerStatistics;
}

export interface PlayerSettings {
  soundEnabled: boolean;
  musicEnabled: boolean;
  hapticsEnabled: boolean;
  autoSaveInterval: number; // seconds
  theme: 'dark' | 'light';
  language: string;
}

export interface PlayerStatistics {
  totalPlayTime: number; // seconds
  beaconsPlaced: number;
  probesLaunched: number;
  starsReignited: number;
  quantumDataEarned: number;
  totalSaveCount: number;
}

export interface Resources {
  quantumData: number;
  stellarEssence: number;
  voidFragments: number;
  resonanceCrystals: number;
  chronosParticles: number;
  lastUpdated: number;
}

export interface Beacon {
  id: string;
  x: number;
  y: number;
  z: number; // for 3D depth if needed
  level: number;
  type: BeaconType;
  status: BeaconStatus;
  connections: string[]; // IDs of connected beacons
  createdAt: number;
  lastUpgraded: number;
  productionRate: number;
  efficiency: number;
}

export type BeaconType = 'basic' | 'harvester' | 'amplifier' | 'relay';
export type BeaconStatus = 'active' | 'inactive' | 'upgrading' | 'corrupted';

export interface Probe {
  id: string;
  type: ProbeType;
  status: ProbeStatus;
  sourceBeaconId: string;
  targetX: number;
  targetY: number;
  launchedAt: number;
  estimatedArrival: number;
  speed: number;
  payload: ProbePayload;
}

export type ProbeType = 'pioneer' | 'harvester' | 'architect';
export type ProbeStatus = 'launched' | 'traveling' | 'arrived' | 'failed';

export interface ProbePayload {
  beaconBlueprint?: BeaconType;
  resources?: Partial<Resources>;
  upgrades?: string[];
}

export interface Galaxy {
  id: string;
  sectors: GalaxySector[];
  discoveredSectors: number;
  totalSectors: number;
  centerX: number;
  centerY: number;
  zoom: number;
  lastExplored: number;
}

export interface GalaxySector {
  id: string;
  x: number;
  y: number;
  status: SectorStatus;
  beaconIds: string[];
  stars: Star[];
  discoveredAt: number;
  threatLevel: number;
}

export type SectorStatus = 'unexplored' | 'discovered' | 'colonized' | 'abandoned';

export interface Star {
  id: string;
  x: number;
  y: number;
  status: StarStatus;
  type: StarType;
  reignitedAt?: number;
  energy: number;
  maxEnergy: number;
}

export type StarStatus = 'dying' | 'stable' | 'reignited';
export type StarType = 'red_dwarf' | 'yellow_dwarf' | 'blue_giant' | 'white_dwarf' | 'neutron';

export interface GameState {
  version: number;
  player: Player;
  resources: Resources;
  beacons: Record<string, Beacon>;
  probes: Record<string, Probe>;
  galaxy: Galaxy;
  gameTime: number; // Total game time in seconds
  lastSaved: number;
  saveCount: number;
  checksum?: string; // For save validation
}

export interface SaveMetadata {
  version: number;
  timestamp: number;
  compressed: boolean;
  size: number;
  checksum: string;
}

export interface SaveFile {
  metadata: SaveMetadata;
  gameState: GameState;
}

export const CURRENT_SAVE_VERSION = 1;

export const DEFAULT_PLAYER_SETTINGS: PlayerSettings = {
  soundEnabled: true,
  musicEnabled: true,
  hapticsEnabled: true,
  autoSaveInterval: 30,
  theme: 'dark',
  language: 'en',
};

export const DEFAULT_PLAYER_STATISTICS: PlayerStatistics = {
  totalPlayTime: 0,
  beaconsPlaced: 0,
  probesLaunched: 0,
  starsReignited: 0,
  quantumDataEarned: 0,
  totalSaveCount: 0,
};

export const DEFAULT_RESOURCES: Resources = {
  quantumData: 100,
  stellarEssence: 0,
  voidFragments: 0,
  resonanceCrystals: 0,
  chronosParticles: 0,
  lastUpdated: Date.now(),
};