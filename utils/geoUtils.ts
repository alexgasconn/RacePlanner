
import { GPXPoint, Sector, AnalysisResult, PlannedSector, TrackStats, AidStation, UnitSystem } from '../types';
import { KM_TO_MILES } from './unitUtils';

// Haversine formula to calculate distance between two lat/lon points in meters
export const getDistanceFromLatLonInMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // Radius of the earth in km converted to meters
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in meters
  return d;
};

const deg2rad = (deg: number): number => {
  return deg * (Math.PI / 180);
};

// Interpolates a point at a specific distance between two known points
const interpolatePoint = (p1: GPXPoint, p2: GPXPoint, targetDist: number): GPXPoint => {
  if (p1.distFromStart === p2.distFromStart) return p1;

  const totalDist = p2.distFromStart - p1.distFromStart;
  const fraction = (targetDist - p1.distFromStart) / totalDist;
  
  const ele = p1.ele + (p2.ele - p1.ele) * fraction;
  const lat = p1.lat + (p2.lat - p1.lat) * fraction;
  const lon = p1.lon + (p2.lon - p1.lon) * fraction;
  
  // Interpolate time if available
  let time: Date | undefined = undefined;
  if (p1.time && p2.time) {
      const timeDiff = p2.time.getTime() - p1.time.getTime();
      time = new Date(p1.time.getTime() + timeDiff * fraction);
  }

  return {
    lat,
    lon,
    ele,
    time,
    distFromStart: targetDist
  };
};

// Finds or creates a point at an exact cumulative distance
const getPointAt = (points: GPXPoint[], targetDist: number, startIndexHint: number = 0): { point: GPXPoint, index: number } => {
    // Check bounds
    if (points.length === 0) throw new Error("No points provided");
    if (targetDist <= points[0].distFromStart) return { point: { ...points[0], distFromStart: targetDist }, index: 0 };
    const lastIdx = points.length - 1;
    if (targetDist >= points[lastIdx].distFromStart) return { point: { ...points[lastIdx], distFromStart: targetDist }, index: lastIdx };

    // Search
    for (let i = startIndexHint; i < points.length; i++) {
        if (points[i].distFromStart >= targetDist) {
            const pAfter = points[i];
            
            // Exact match
            if (Math.abs(pAfter.distFromStart - targetDist) < 0.001) {
                return { point: pAfter, index: i };
            }

            const pBefore = points[i - 1]; // Safe as we checked lower bound earlier
            return { 
                point: interpolatePoint(pBefore, pAfter, targetDist),
                index: i // Return index of the point *after* or at the target
            };
        }
    }
    return { point: points[lastIdx], index: lastIdx };
};

// Purely parses the file into points and calculates global stats
export const parseGPXRaw = async (fileContent: string): Promise<{ points: GPXPoint[], stats: TrackStats }> => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(fileContent, "text/xml");
  const trkpts = xmlDoc.getElementsByTagName("trkpt");

  if (trkpts.length === 0) {
    throw new Error("No track points found in GPX file.");
  }

  const points: GPXPoint[] = [];
  let totalDist = 0;

  // 1. Parse raw points and calculate cumulative distance
  for (let i = 0; i < trkpts.length; i++) {
    const pt = trkpts[i];
    const lat = parseFloat(pt.getAttribute("lat") || "0");
    const lon = parseFloat(pt.getAttribute("lon") || "0");
    const ele = parseFloat(pt.getElementsByTagName("ele")[0]?.textContent || "0");
    const timeStr = pt.getElementsByTagName("time")[0]?.textContent;
    const time = timeStr ? new Date(timeStr) : undefined;

    let distFromPrev = 0;
    if (i > 0) {
      distFromPrev = getDistanceFromLatLonInMeters(
        points[i - 1].lat,
        points[i - 1].lon,
        lat,
        lon
      );
    }
    totalDist += distFromPrev;

    points.push({
      lat,
      lon,
      ele,
      time,
      distFromStart: totalDist
    });
  }

  // 2. Calculate Global Stats
  let totalGain = 0;
  let totalLoss = 0;
  let maxEle = -Infinity;
  let minEle = Infinity;

  points.forEach((p, i) => {
    if (p.ele > maxEle) maxEle = p.ele;
    if (p.ele < minEle) minEle = p.ele;

    if (i > 0) {
      const diff = p.ele - points[i - 1].ele;
      if (diff > 0) totalGain += diff;
      else totalLoss += Math.abs(diff);
    }
  });

  return {
    points,
    stats: {
      totalDistance: totalDist,
      totalElevationGain: totalGain,
      totalElevationLoss: totalLoss,
      maxElevation: maxEle,
      minElevation: minEle,
      pointCount: points.length
    }
  };
};

export const generateSectors = (points: GPXPoint[], sectorSize: number): Sector[] => {
  const sectors: Sector[] = [];
  const totalDist = points[points.length - 1].distFromStart;
  const numSectors = Math.ceil(totalDist / sectorSize);
  
  let searchHintIndex = 0;

  for (let i = 0; i < numSectors; i++) {
      const startDist = i * sectorSize;
      const endDist = Math.min((i + 1) * sectorSize, totalDist);

      // Interpolate Start and End points for this specific sector
      const startResult = getPointAt(points, startDist, searchHintIndex);
      // Update hint to speed up next search (start looking from where we found this point)
      searchHintIndex = Math.max(0, startResult.index - 1);
      
      const endResult = getPointAt(points, endDist, searchHintIndex);

      // Collect intermediate points that strictly fall within the sector
      const intermediatePoints = points.filter(p => p.distFromStart > startDist && p.distFromStart < endDist);

      // Construct the precise point list for this sector
      const sectorPoints = [startResult.point, ...intermediatePoints, endResult.point];

      sectors.push(calculateSectorStats(i + 1, sectorPoints, startDist, endDist));
  }
  return sectors;
};

const calculateSectorStats = (id: number, points: GPXPoint[], startDist: number, endDist: number): Sector => {
  let gain = 0;
  let loss = 0;
  let max = -Infinity;
  let min = Infinity;

  points.forEach((p, i) => {
    if (p.ele > max) max = p.ele;
    if (p.ele < min) min = p.ele;
    if (i > 0) {
      const diff = p.ele - points[i - 1].ele;
      if (diff > 0) gain += diff;
      else loss += Math.abs(diff);
    }
  });

  if (max === -Infinity) max = points[0]?.ele || 0;
  if (min === Infinity) min = points[0]?.ele || 0;

  const distDiff = endDist - startDist;
  const netEleChange = points[points.length - 1].ele - points[0].ele;
  const avgGradient = distDiff > 0 ? (netEleChange / distDiff) * 100 : 0;

  return {
    id,
    startDist,
    endDist,
    elevationGain: gain,
    elevationLoss: loss,
    avgGradient,
    maxEle: max,
    minEle: min,
    points
  };
};

// --- RACE PLANNING MATH ---

export const calculateRacePlan = (
  sectors: Sector[], 
  targetTimeSeconds: number,
  aidStations: AidStation[] = [],
  units: UnitSystem = 'metric'
): PlannedSector[] => {
  
  // 1. Identify "stopped time" in aid stations and subtract from running budget
  let totalStoppedTime = 0;
  const aidStationMeters = aidStations.map(station => ({
     // Convert station distance to meters for matching
     distMeters: units === 'metric' ? station.distanceFromStart * 1000 : (station.distanceFromStart / KM_TO_MILES) * 1000,
     penalty: station.penaltySeconds
  }));

  // Map stations to sectors
  const stationAssignments: Record<number, number> = {}; // sectorId -> seconds
  sectors.forEach(sector => {
      aidStationMeters.forEach(station => {
          if (station.distMeters > sector.startDist && station.distMeters <= sector.endDist) {
              stationAssignments[sector.id] = (stationAssignments[sector.id] || 0) + station.penalty;
              totalStoppedTime += station.penalty;
          }
      });
  });

  const availableRunningTime = targetTimeSeconds - totalStoppedTime;

  // --- FATIGUE & GAP MODEL ---
  // 1. Calculate pure Effort Distance (Terrain Cost)
  let totalEffortUnits = 0;
  
  // Temporary array to hold effort dist before fatigue application
  const sectorEfforts = sectors.map(s => {
    const dist = s.endDist - s.startDist;
    // GAP Heuristics:
    // Uphill: 1m gain ~= 7.5m flat distance
    // Downhill: 1m loss ~= -2.0m flat distance (energy saving)
    
    let effortDist = dist;
    effortDist += s.elevationGain * 7.5; 
    effortDist -= s.elevationLoss * 2.0;

    // Safety: Downhill cannot be faster than ~40% boost (arbitrary physics limit for stability)
    if (effortDist < dist * 0.6) {
      effortDist = dist * 0.6;
    }

    return { ...s, effortDist, rawDist: dist };
  });

  // 2. Calculate Cumulative Effort to determine Fatigue Factor
  // We assume total "work" done corresponds to total Effort Distance.
  const totalRaceEffort = sectorEfforts.reduce((acc, s) => acc + s.effortDist, 0);
  
  // Fatigue Decay Model:
  // We assume at the end of the race, the runner is X% less efficient than at start.
  // E.g. 20% drift (MAX_FATIGUE = 0.20)
  const MAX_FATIGUE = 0.20; 
  
  let currentAccumulatedEffort = 0;
  let totalAdjustedEffortUnits = 0; // "Cost" units including fatigue penalty

  const sectorsWithFatigue = sectorEfforts.map(s => {
      // Calculate average fatigue for this sector based on where we are in the race effort
      const startFatigueRatio = currentAccumulatedEffort / totalRaceEffort;
      const endFatigueRatio = (currentAccumulatedEffort + s.effortDist) / totalRaceEffort;
      const avgFatigueRatio = (startFatigueRatio + endFatigueRatio) / 2;

      // Fatigue Multiplier: 1.0 (Fresh) -> 1.2 (Tired)
      const fatigueMultiplier = 1 + (avgFatigueRatio * MAX_FATIGUE);
      
      // The "Time Cost" of this sector is its Effort Distance * Fatigue Multiplier
      const adjustedEffort = s.effortDist * fatigueMultiplier;

      totalAdjustedEffortUnits += adjustedEffort;
      currentAccumulatedEffort += s.effortDist;

      return {
          ...s,
          adjustedEffort,
          fatigueLevel: avgFatigueRatio * 100 // Store as percentage 0-100
      };
  });

  // 3. Solve for Base Pace
  // availableRunningTime = Sum(AdjustedEffort_i * BaseSecondsPerUnit)
  // BaseSecondsPerUnit = availableRunningTime / TotalAdjustedEffortUnits
  const secondsPerEffortUnit = availableRunningTime / totalAdjustedEffortUnits;

  // 4. Final Compilation
  let accumulatedTime = 0;

  return sectorsWithFatigue.map(s => {
    // Basic running time with terrain + fatigue
    let sectorDuration = s.adjustedEffort * secondsPerEffortUnit;
    
    // Add aid station penalty if present
    const penalty = stationAssignments[s.id] || 0;
    sectorDuration += penalty;

    accumulatedTime += sectorDuration;
    
    const sectorDistKm = (s.endDist - s.startDist) / 1000;
    const paceSeconds = sectorDuration / sectorDistKm;

    return {
      id: s.id,
      startDist: s.startDist,
      endDist: s.endDist,
      elevationGain: s.elevationGain,
      elevationLoss: s.elevationLoss,
      avgGradient: s.avgGradient,
      maxEle: s.maxEle,
      minEle: s.minEle,
      points: s.points,
      combinedElevationChange: s.elevationGain + s.elevationLoss,
      targetDurationSeconds: sectorDuration,
      targetPaceSeconds: paceSeconds,
      accumulatedTimeSeconds: accumulatedTime,
      hasAidStation: penalty > 0,
      fatigueLevel: s.fatigueLevel
    };
  });
};

export const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  const pad = (num: number) => num.toString().padStart(2, '0');
  
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
};
