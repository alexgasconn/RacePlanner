
import { GPXPoint, Sector, PlannedSector, TrackStats, AidStation, UnitSystem } from '../types';
import { KM_TO_MILES } from './unitUtils';

// --- GEOMETRY HELPERS ---

const deg2rad = (deg: number): number => deg * (Math.PI / 180);

export const getDistanceFromLatLonInMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; 
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// --- SIGNAL PROCESSING (SMOOTHING) ---

// 1. Spatial Filter: Remove points that are too close (GPS noise/jitter)
// Using 8m threshold to filter out "finish line standing around" noise
const filterNoisyPoints = (points: GPXPoint[], minDistanceMeters: number = 8): GPXPoint[] => {
    if (points.length < 2) return points;
    
    const filtered: GPXPoint[] = [points[0]];
    let lastPoint = points[0];

    for (let i = 1; i < points.length; i++) {
        const dist = getDistanceFromLatLonInMeters(lastPoint.lat, lastPoint.lon, points[i].lat, points[i].lon);
        // Only keep point if it has moved enough, or if it's the very last point
        if (dist >= minDistanceMeters || i === points.length - 1) {
            filtered.push(points[i]);
            lastPoint = points[i];
        }
    }
    return filtered;
};

// 2. Elevation Smoothing: Weighted Moving Average [0.25, 0.5, 0.25]
const smoothElevation = (points: GPXPoint[]): GPXPoint[] => {
    if (points.length < 3) return points;
    
    const smoothed = [...points];
    
    // We skip first and last index for the window
    for (let i = 1; i < points.length - 1; i++) {
        const prev = points[i - 1].ele;
        const curr = points[i].ele;
        const next = points[i + 1].ele;
        
        // Weighted average favoring the current point
        smoothed[i].ele = (prev * 0.2 + curr * 0.6 + next * 0.2);
    }
    return smoothed;
};

// Re-calculates cumulative distance after filtering/modification
const recalculateDistances = (points: GPXPoint[]): GPXPoint[] => {
    let totalDist = 0;
    const result = [ { ...points[0], distFromStart: 0 } ];
    
    for (let i = 1; i < points.length; i++) {
        const d = getDistanceFromLatLonInMeters(
            points[i-1].lat, points[i-1].lon,
            points[i].lat, points[i].lon
        );
        totalDist += d;
        result.push({ ...points[i], distFromStart: totalDist });
    }
    return result;
};


// --- PARSING ---

export const parseGPXRaw = async (fileContent: string): Promise<{ points: GPXPoint[], stats: TrackStats }> => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(fileContent, "text/xml");
  const trkpts = xmlDoc.getElementsByTagName("trkpt");

  // Extract Name and clean it up
  const nameNode = xmlDoc.getElementsByTagName("name")[0];
  let trackName = nameNode ? nameNode.textContent || "Unknown Route" : "Unknown Route";
  // Clean up: Replace hyphens/underscores with spaces, trim
  trackName = trackName.replace(/[-_]/g, ' ').replace(/\.gpx$/i, '').trim(); 

  if (trkpts.length === 0) throw new Error("No track points found in GPX file.");

  let rawPoints: GPXPoint[] = [];

  // 1. Basic Extraction
  for (let i = 0; i < trkpts.length; i++) {
    const pt = trkpts[i];
    rawPoints.push({
      lat: parseFloat(pt.getAttribute("lat") || "0"),
      lon: parseFloat(pt.getAttribute("lon") || "0"),
      ele: parseFloat(pt.getElementsByTagName("ele")[0]?.textContent || "0"),
      time: pt.getElementsByTagName("time")[0]?.textContent ? new Date(pt.getElementsByTagName("time")[0]?.textContent!) : undefined,
      distFromStart: 0 // placeholder
    });
  }

  // --- LOGGING & OPTIMIZATION ---
  const originalCount = rawPoints.length;
  console.log(`%c[GPX] Original Points: ${originalCount}`, "color: #fbbf24; font-weight: bold; font-size: 12px;");
  
  if (originalCount > 5000) {
      console.warn(`%c[GPX] High point count detected. Downsampling by 50% for performance...`, "color: #f87171;");
      // Keep first, last, and every even index
      rawPoints = rawPoints.filter((_, i) => i === 0 || i === rawPoints.length - 1 || i % 2 === 0);
  }

  // 2. Apply Smoothing Pipeline
  const spatiallyFiltered = filterNoisyPoints(rawPoints, 8.0); // 8 meter threshold
  const elevationSmoothed = smoothElevation(spatiallyFiltered);
  const points = recalculateDistances(elevationSmoothed);

  console.log(`%c[GPX] Final Analysis Points: ${points.length}`, "color: #34d399; font-weight: bold; font-size: 12px;");

  // 3. Stats Calculation
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
      name: trackName,
      totalDistance: points[points.length - 1].distFromStart,
      totalElevationGain: totalGain,
      totalElevationLoss: totalLoss,
      maxElevation: maxEle,
      minElevation: minEle,
      pointCount: points.length
    }
  };
};

// --- SECTOR GENERATION ---

const getInterpolatedPoint = (p1: GPXPoint, p2: GPXPoint, targetDist: number): GPXPoint => {
    const totalDist = p2.distFromStart - p1.distFromStart;
    const ratio = totalDist === 0 ? 0 : (targetDist - p1.distFromStart) / totalDist;
    return {
        lat: p1.lat + (p2.lat - p1.lat) * ratio,
        lon: p1.lon + (p2.lon - p1.lon) * ratio,
        ele: p1.ele + (p2.ele - p1.ele) * ratio,
        distFromStart: targetDist,
        time: undefined 
    };
};

export const generateSectors = (points: GPXPoint[], sectorSize: number): Sector[] => {
  const sectors: Sector[] = [];
  const totalDist = points[points.length - 1].distFromStart;
  const numSectors = Math.ceil(totalDist / sectorSize);
  
  let currentPIdx = 0;

  for (let i = 0; i < numSectors; i++) {
      const startDist = i * sectorSize;
      const endDist = Math.min((i + 1) * sectorSize, totalDist);
      
      const sectorPoints: GPXPoint[] = [];

      while (currentPIdx < points.length - 1 && points[currentPIdx + 1].distFromStart <= startDist) {
          currentPIdx++;
      }
      
      if (Math.abs(points[currentPIdx].distFromStart - startDist) < 0.1) {
           sectorPoints.push(points[currentPIdx]);
      } else if (currentPIdx < points.length - 1) {
           sectorPoints.push(getInterpolatedPoint(points[currentPIdx], points[currentPIdx+1], startDist));
      }

      let scanIdx = currentPIdx;
      while (scanIdx < points.length) {
          if (points[scanIdx].distFromStart > startDist && points[scanIdx].distFromStart < endDist) {
              sectorPoints.push(points[scanIdx]);
          }
          if (points[scanIdx].distFromStart >= endDist) break;
          scanIdx++;
      }

      if (scanIdx < points.length && scanIdx > 0) {
           if (Math.abs(points[scanIdx].distFromStart - endDist) < 0.1) {
                sectorPoints.push(points[scanIdx]);
           } else {
                sectorPoints.push(getInterpolatedPoint(points[scanIdx-1], points[scanIdx], endDist));
           }
      } else if (scanIdx === points.length) {
          sectorPoints.push(points[points.length-1]);
      }

      let gain = 0;
      let loss = 0;
      let max = -Infinity;
      let min = Infinity;
      
      sectorPoints.forEach((p, idx) => {
          if (p.ele > max) max = p.ele;
          if (p.ele < min) min = p.ele;
          if (idx > 0) {
              const d = p.ele - sectorPoints[idx-1].ele;
              if (d > 0) gain += d;
              else loss += Math.abs(d);
          }
      });
      
      if (max === -Infinity) max = 0;
      if (min === Infinity) min = 0;

      const distDiff = endDist - startDist;
      const netChange = sectorPoints[sectorPoints.length - 1].ele - sectorPoints[0].ele;
      const avgGradient = distDiff > 0 ? (netChange / distDiff) * 100 : 0;

      sectors.push({
          id: i + 1,
          startDist,
          endDist,
          elevationGain: gain,
          elevationLoss: loss,
          avgGradient,
          maxEle: max,
          minEle: min,
          points: sectorPoints
      });
  }
  return sectors;
};


// --- PROFESSIONAL PACING ENGINE (BIO-METRIC) ---

const getMetabolicCost = (grad: number): number => {
    // Minetti-based cost function approximated for trail running
    if (grad >= 0) {
        // Uphill: 1 + 3.0x + 12x^2
        return 1 + (grad * 3.0) + (grad * grad * 12);
    } else {
        // Downhill: Optimized for controlled descent
        const g = Math.abs(grad);
        if (g < 0.15) return 1 - (g * 2.0); // Efficient
        if (g < 0.25) return 0.7 + (g - 0.15) * 1.5; // Braking
        return 0.85 + (g - 0.25) * 3.0; // Extreme braking
    }
};

const getTechnicalityPenalty = (s: Sector): number => {
    const dist = s.endDist - s.startDist;
    if (dist === 0) return 0;
    const oscillation = (s.elevationGain + s.elevationLoss) / dist;
    const netGrade = Math.abs(s.avgGradient / 100);
    const noise = Math.max(0, oscillation - netGrade);
    return noise * 0.5; 
};

export const calculateRacePlan = (
  sectors: Sector[], 
  targetTimeSeconds: number,
  aidStations: AidStation[] = [],
  units: UnitSystem = 'metric'
): PlannedSector[] => {
  
  if (sectors.length === 0) return [];

  // 1. Handle Aid Stations
  let totalStoppedTime = 0;
  const aidStationMeters = aidStations.map(s => ({
     distMeters: units === 'metric' ? s.distanceFromStart * 1000 : (s.distanceFromStart / KM_TO_MILES) * 1000,
     penalty: s.penaltySeconds
  }));
  
  const stationAssignments: Record<number, number> = {};
  sectors.forEach(s => {
      aidStationMeters.forEach(as => {
          if (as.distMeters > s.startDist && as.distMeters <= s.endDist) {
              stationAssignments[s.id] = (stationAssignments[s.id] || 0) + as.penalty;
              totalStoppedTime += as.penalty;
          }
      });
  });

  const runBudget = Math.max(0, targetTimeSeconds - totalStoppedTime);
  const totalDist = sectors[sectors.length - 1].endDist;
  const avgPacePerMeter = runBudget / totalDist;

  // 2. PASS 1: Calculate "Raw Effort Units" based on Terrain
  
  let totalEffortUnits = 0;
  
  const analyzedSectors = sectors.map(s => {
      const dist = s.endDist - s.startDist;
      const gradFraction = s.avgGradient / 100;
      
      let costMultiplier = getMetabolicCost(gradFraction);
      const techPenalty = getTechnicalityPenalty(s);
      costMultiplier += techPenalty;

      // Altitude penalty
      if (s.minEle > 2000) {
          costMultiplier += (s.minEle - 2000) / 10000;
      }
      
      // Base Effort = Distance * Difficulty
      const effortUnits = dist * costMultiplier;
      totalEffortUnits += effortUnits;

      return { ...s, dist, costMultiplier, effortUnits };
  });

  // 3. PASS 2: Apply Strategy & Fatigue to calculate "Performance Factors"
  
  let accumulatedFatigueLoad = 0;
  
  const rawFactors = analyzedSectors.map((s, i) => {
      const progress = s.endDist / totalDist; 
      
      // A. CONSERVATIVE STRATEGY CURVE
      let strategy = 1.0;
      
      if (progress < 0.10) {
          strategy = 0.96; // Start: Conservative (-4%)
      } else if (progress < 0.30) {
          strategy = 1.00; // Build: Base (0%)
      } else if (progress < 0.85) {
          strategy = 1.02; // Attack: Efficient Push (+2%)
      } else {
          strategy = 1.01; // Finish: Maintain/Grit (+1%)
      }

      // B. PHYSIOLOGICAL FATIGUE
      accumulatedFatigueLoad += s.effortUnits;
      const relativeFatigue = accumulatedFatigueLoad / totalEffortUnits;
      
      let fatigue = 1.0;
      if (relativeFatigue > 0.80) {
          // Late race drift. Max penalty ~5% at finish line.
          // This models glycogen depletion without "bonking"
          fatigue = 1.0 - ((relativeFatigue - 0.80) * 0.25); 
      }
      
      // Performance Factor = Strategy * Fatigue
      // > 1.0 means running faster than terrain suggests
      // < 1.0 means running slower
      const performanceFactor = strategy * fatigue;

      return {
          performanceFactor,
          relativeFatigue
      };
  });

  // 4. PASS 3: SMOOTHING "Performance Factors" (Trend Locking)
  // We smooth the *intensity*, not the time. This fixes the short-sector bug.
  
  const smoothedFactors = rawFactors.map((curr, i, arr) => {
      // LOCK-IN: The last sector strictly follows the trend of the previous one.
      // This prevents end-of-race anomalies caused by GPS jitter or partial sectors.
      if (i === arr.length - 1) {
          return arr[i-1]?.performanceFactor || curr.performanceFactor;
      }

      // Penultimate sector: heavier bias to previous
      if (i === arr.length - 2) {
          const prev = arr[i-1]?.performanceFactor || curr.performanceFactor;
          return (prev * 0.7 + curr.performanceFactor * 0.3);
      }

      // Standard smoothing (Moving Average)
      const prev = arr[i-1]?.performanceFactor || curr.performanceFactor;
      const next = arr[i+1]?.performanceFactor || curr.performanceFactor;
      return (prev * 0.2 + curr.performanceFactor * 0.6 + next * 0.2);
  });

  // 5. PASS 4: Allocation & Safety Clamping
  
  // Weights determine how we split the Time Budget.
  // Time = Effort / Performance.
  // Weight = EffortUnits / SmoothedPerformance.
  const weightedSectors = analyzedSectors.map((s, i) => {
      const factor = smoothedFactors[i];
      return {
          ...s,
          allocatedWeight: s.effortUnits / factor,
          relativeFatigue: rawFactors[i].relativeFatigue
      };
  });

  const totalAllocatedWeight = weightedSectors.reduce((sum, sec) => sum + sec.allocatedWeight, 0);
  let accumulatedTime = 0;

  return weightedSectors.map((s, _, allSectors) => {
      // Normalize
      const weightRatio = s.allocatedWeight / totalAllocatedWeight;
      let sectorRunTime = runBudget * weightRatio;

      // --- SAFETY CLAMP ---
      // Prevent singularities (infinite pace) on short/flat sectors due to floating point math
      const distMeters = s.dist;
      // Handle edge case of 0 distance sector
      if (distMeters < 1) {
          return {
             id: s.id, startDist: s.startDist, endDist: s.endDist, elevationGain: 0, elevationLoss: 0, 
             avgGradient: 0, maxEle: s.maxEle, minEle: s.minEle, points: s.points, combinedElevationChange: 0,
             targetDurationSeconds: 0, targetPaceSeconds: 0, accumulatedTimeSeconds: accumulatedTime, 
             hasAidStation: false, fatigueLevel: 100
          }
      }

      const calculatedPace = sectorRunTime / distMeters; // seconds per meter
      const isExtremeTerrain = Math.abs(s.avgGradient) > 15;
      
      // If terrain is not extreme, we shouldn't be walking or sprinting wildly vs average
      if (!isExtremeTerrain) {
          const minPaceAllowed = avgPacePerMeter * 0.4; // 2.5x faster than avg max
          const maxPaceAllowed = avgPacePerMeter * 3.0; // 3.0x slower than avg max
          
          if (calculatedPace < minPaceAllowed) sectorRunTime = minPaceAllowed * distMeters;
          if (calculatedPace > maxPaceAllowed) sectorRunTime = maxPaceAllowed * distMeters;
      }
      
      const stopTime = stationAssignments[s.id] || 0;
      const totalTime = sectorRunTime + stopTime;
      
      accumulatedTime += totalTime;
      
      const visFatigue = Math.min(100, Math.round(s.relativeFatigue * 100));

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
          targetDurationSeconds: totalTime,
          targetPaceSeconds: sectorRunTime / (s.dist / 1000), // Pace based on MOVING time
          accumulatedTimeSeconds: accumulatedTime,
          hasAidStation: stopTime > 0,
          fatigueLevel: visFatigue
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
