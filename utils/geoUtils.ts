
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

// --- SMART ENDURANCE RACE PLANNING ---

export const calculateRacePlan = (
  sectors: Sector[], 
  targetTimeSeconds: number,
  aidStations: AidStation[] = [],
  units: UnitSystem = 'metric'
): PlannedSector[] => {
  
  if (sectors.length === 0) return [];
  const totalDist = sectors[sectors.length - 1].endDist;

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

  // The time available to actually run the course
  const availableRunningTime = Math.max(0, targetTimeSeconds - totalStoppedTime);

  // --- PHYSICS & PHYSIOLOGY CONSTANTS ---
  const START_SOFT_RATIO = 0.05; // First 5% of race is warm-up
  const START_SOFT_PENALTY = 0.05; // Run 5% slower during warm-up
  const MAX_FATIGUE_LOSS = 0.15; // 15% efficiency loss by the end of race
  const ANCHOR_BIAS = 0.35; // 35% of pace is anchored to the goal average, 65% varies by terrain
  
  // 2. Calculate Weighted Distance
  // We calculate a "Cost Factor" for every meter of the race based on Grade + Fatigue + Strategy.
  // WeightedDistance = Sum(SectorDistance * SectorCostFactor)
  let totalWeightedDistance = 0;

  const sectorWeights = sectors.map(s => {
      const dist = s.endDist - s.startDist;
      const grade = s.avgGradient;
      const sectorMidDist = (s.startDist + s.endDist) / 2;
      const progressRatio = sectorMidDist / totalDist; // 0.0 to 1.0

      // A. Terrain Physics (The "Smart GAP" Model)
      let terrainCost = 1.0;
      if (grade > 0) {
          // Quadratic Uphill Penalty
          // 2% -> ~7% slower. 5% -> ~20% slower. 10% -> ~50% slower.
          // Formula: 1 + (g * 0.035) + (g^2 * 0.0015)
          terrainCost = 1.0 + (grade * 0.035) + (Math.pow(grade, 2) * 0.0015);
      } else {
          // Downhill Braking Physics
          // You assume speed gains, but cap them because biomechanics limits max cadence/stride.
          // -5% -> ~12% faster. -10% -> ~20% faster. 
          // Cap at 0.75 (25% faster max) to prevent world-record suggestions on cliffs.
          let boost = grade * 0.025;
          if (boost < -0.25) boost = -0.25; // Max speed bonus cap
          terrainCost = 1.0 + boost;
      }

      // B. Strategy: Start Soft
      let warmUpFactor = 1.0;
      if (progressRatio < START_SOFT_RATIO) {
          warmUpFactor = 1.0 + START_SOFT_PENALTY;
      }

      // C. Physiology: Fatigue Drift
      // Linear drift from 0% to MAX_FATIGUE_LOSS
      // At start (0.0): 1.0. At finish (1.0): 1.15
      const fatigueFactor = 1.0 + (progressRatio * MAX_FATIGUE_LOSS);

      // Combined Raw Factor (Physics + Physio)
      const rawFactor = terrainCost * warmUpFactor * fatigueFactor;

      // D. Anchoring
      // We pull the raw wildly varying factor back towards 1.0 (Average Pace)
      // This ensures we respect the specific goal time significantly
      const finalCostFactor = (rawFactor * (1 - ANCHOR_BIAS)) + (1.0 * ANCHOR_BIAS);

      totalWeightedDistance += dist * finalCostFactor;

      return {
          ...s,
          finalCostFactor,
          fatigueLevel: progressRatio * 100
      };
  });

  // 3. Solve for Base Pace
  // BasePace (sec/m) = AvailableTime / TotalWeightedDistance
  // This represents the pace on a perfectly flat, fresh segment to achieve the goal.
  const basePacePerMeter = availableRunningTime / totalWeightedDistance;

  // 4. Compile Plan
  let currentAccumulatedTime = 0;

  return sectorWeights.map(s => {
      const dist = s.endDist - s.startDist;
      
      // Calculate running duration for this sector
      // Duration = Dist * CostFactor * BasePace
      const runningDuration = dist * s.finalCostFactor * basePacePerMeter;

      // Add Aid Station Penalty
      const stopTime = stationAssignments[s.id] || 0;
      const totalDuration = runningDuration + stopTime;

      currentAccumulatedTime += totalDuration;

      // Target Pace: We display the "Running Pace" (intensity), not the "Stopped Pace".
      // If we included stop time in pace, it would look like you are walking 20min/km at aid stations.
      // The user wants to know how fast to run.
      const runningPaceSecondsPerKm = runningDuration / (dist / 1000);

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
          targetDurationSeconds: totalDuration, // Includes stop time for total ETA
          targetPaceSeconds: runningPaceSecondsPerKm, // Pure running pace
          accumulatedTimeSeconds: currentAccumulatedTime,
          hasAidStation: stopTime > 0,
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
