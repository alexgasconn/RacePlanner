export interface GPXPoint {
  lat: number;
  lon: number;
  ele: number;
  time?: Date;
  distFromStart: number; // in meters
}

export interface Sector {
  id: number;
  startDist: number;
  endDist: number;
  elevationGain: number;
  elevationLoss: number;
  avgGradient: number;
  maxEle: number;
  minEle: number;
  points: GPXPoint[];
}

export interface PlannedSector extends Sector {
  combinedElevationChange: number; // gain + loss
  targetDurationSeconds: number; // partial time
  targetPaceSeconds: number; // seconds per km
  accumulatedTimeSeconds: number; // accum time
}

export interface TrackStats {
  totalDistance: number; // meters
  totalElevationGain: number; // meters
  totalElevationLoss: number; // meters
  maxElevation: number;
  minElevation: number;
  pointCount: number;
}

export interface AnalysisResult {
  stats: TrackStats;
  sectors: Sector[];
  rawPoints: GPXPoint[];
  plan?: PlannedSector[];
  targetTimeSeconds?: number;
}

export enum AnalysisStatus {
  IDLE = 'IDLE',
  PARSING = 'PARSING',
  TIME_SELECTION = 'TIME_SELECTION',
  ANALYZING_AI = 'ANALYZING_AI',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}