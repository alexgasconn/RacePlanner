
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
  fatigueLevel: number; // 0 to 100 representing accumulated fatigue/stress
  hasAidStation?: boolean;
}

export interface TrackStats {
  name?: string; // Parsed from GPX <name>
  totalDistance: number; // meters
  totalElevationGain: number; // meters
  totalElevationLoss: number; // meters
  maxElevation: number;
  minElevation: number;
  pointCount: number;
}

export type UnitSystem = 'metric' | 'imperial';

export interface WeatherData {
  temperatureMax: number;
  precipitationProb: number;
  windSpeed: number;
  conditionCode: number;
}

export interface AidStation {
  id: string;
  distanceFromStart: number; // in user units (km or mi)
  penaltySeconds: number;
}

export interface AnalysisResult {
  stats: TrackStats;
  sectors: Sector[];
  rawPoints: GPXPoint[];
  plan?: PlannedSector[];
  targetTimeSeconds?: number;
  units: UnitSystem;
  weather?: WeatherData;
  aidStations?: AidStation[];
}

export type MapMetric = 'gradient' | 'pace' | 'elevation' | 'bank' | 'fatigue';

export enum AnalysisStatus {
  IDLE = 'IDLE',
  PARSING = 'PARSING',
  TIME_SELECTION = 'TIME_SELECTION',
  ANALYZING_AI = 'ANALYZING_AI',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}
