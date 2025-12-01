
import React from 'react';
import { TrendingUp, Zap, ArrowRight, Activity, Percent, Mountain, Timer, ArrowUpRight, Flag, BrainCircuit } from 'lucide-react';
import { PlannedSector, TrackStats, UnitSystem } from '../types';
import { formatDuration } from '../utils/geoUtils';
import { formatDistance, formatElevation } from '../utils/unitUtils';

interface RouteInsightsProps {
  stats: TrackStats;
  sectors: PlannedSector[];
  units: UnitSystem;
  targetTimeSeconds: number;
}

const RouteInsights: React.FC<RouteInsightsProps> = ({ stats, sectors, units, targetTimeSeconds }) => {
  if (!sectors.length) return null;

  // 1. Calculate Splits (Strategy)
  const totalDist = stats.totalDistance;
  const halfDist = totalDist / 2;
  
  let firstHalfTime = 0;
  let secondHalfTime = 0;
  
  sectors.forEach(s => {
      if (s.endDist <= halfDist) {
          firstHalfTime += s.targetDurationSeconds;
      } else if (s.startDist >= halfDist) {
          secondHalfTime += s.targetDurationSeconds;
      } else {
          // Split sector logic
          const ratio = (halfDist - s.startDist) / (s.endDist - s.startDist);
          firstHalfTime += s.targetDurationSeconds * ratio;
          secondHalfTime += s.targetDurationSeconds * (1 - ratio);
      }
  });

  const splitDiff = secondHalfTime - firstHalfTime;
  const isNegativeSplit = splitDiff < 0;
  
  // 2. Key Landmarks
  const cruxSector = [...sectors].sort((a, b) => b.avgGradient - a.avgGradient)[0];
  const summitSector = [...sectors].sort((a, b) => b.maxEle - a.maxEle)[0];
  
  // The Grind Logic
  let maxGrindDist = 0;
  let currentGrindDist = 0;
  let grindStartSector = sectors[0];
  let tempGrindStart = sectors[0];

  sectors.forEach((s) => {
      if (s.avgGradient > 3) {
          if (currentGrindDist === 0) tempGrindStart = s;
          currentGrindDist += (s.endDist - s.startDist);
      } else {
          if (currentGrindDist > maxGrindDist) {
              maxGrindDist = currentGrindDist;
              grindStartSector = tempGrindStart;
          }
          currentGrindDist = 0;
      }
  });
  if (currentGrindDist > maxGrindDist) {
      maxGrindDist = currentGrindDist;
      grindStartSector = tempGrindStart;
  }


  // 3. Course DNA Metrics
  const totalDistUnit = units === 'metric' ? stats.totalDistance / 1000 : (stats.totalDistance / 1000) * 0.621371;
  const totalGainUnit = units === 'metric' ? stats.totalElevationGain : stats.totalElevationGain * 3.28084;
  
  const vertRatio = Math.round(totalGainUnit / totalDistUnit);
  const flatDist = sectors.filter(s => Math.abs(s.avgGradient) < 4).reduce((acc, s) => acc + (s.endDist - s.startDist), 0);
  const runnability = Math.round((flatDist / stats.totalDistance) * 100);
  
  // Lowered threshold from 10% to 8% per user request
  const steepDist = sectors.filter(s => s.avgGradient > 8).reduce((acc, s) => acc + (s.endDist - s.startDist), 0);
  const steepness = Math.round((steepDist / stats.totalDistance) * 100);

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl shadow-xl mb-8">
        <div className="flex items-center gap-2 mb-6 border-b border-slate-700/50 pb-4">
            <BrainCircuit className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-bold text-white uppercase tracking-wider">Race Intelligence</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 divide-y lg:divide-y-0 lg:divide-x divide-slate-700/50">
            
            {/* COL 1: Course DNA */}
            <div className="space-y-4 pr-4">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Course DNA</div>
                
                <div className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-900 rounded-lg text-slate-400"><Mountain className="w-4 h-4"/></div>
                        <div>
                            <div className="text-sm text-slate-400">Vertical Density</div>
                            <div className="text-xs text-slate-600 font-mono">Gain per {units === 'metric' ? 'km' : 'mi'}</div>
                        </div>
                    </div>
                    <div className="text-xl font-black text-white">{vertRatio} <span className="text-xs font-medium text-slate-500">{units === 'metric' ? 'm' : 'ft'}</span></div>
                </div>

                <div className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-900 rounded-lg text-emerald-500"><Percent className="w-4 h-4"/></div>
                        <div>
                            <div className="text-sm text-slate-400">Runnability</div>
                            <div className="text-xs text-slate-600 font-mono">Under 4% grade</div>
                        </div>
                    </div>
                    <div className="text-xl font-black text-white">{runnability}%</div>
                </div>

                <div className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-900 rounded-lg text-red-500"><TrendingUp className="w-4 h-4"/></div>
                        <div>
                            <div className="text-sm text-slate-400">Steepness</div>
                            <div className="text-xs text-slate-600 font-mono">Over 8% grade</div>
                        </div>
                    </div>
                    <div className="text-xl font-black text-white">{steepness}%</div>
                </div>
            </div>

            {/* COL 2: Landmarks */}
            <div className="space-y-4 lg:px-4 pt-6 lg:pt-0">
                 <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Key Landmarks</div>
                 
                 <div className="space-y-3">
                    {/* Summit */}
                    <div className="flex items-center justify-between bg-slate-900/40 p-3 rounded-xl border border-slate-700/30">
                        <div className="flex items-center gap-3">
                            <Flag className="w-4 h-4 text-blue-400" />
                            <span className="text-sm font-bold text-slate-300">The Summit</span>
                        </div>
                        <div className="text-right">
                             <div className="text-white font-bold">{formatElevation(summitSector.maxEle, units)} {units === 'metric' ? 'm' : 'ft'}</div>
                             <div className="text-[10px] text-slate-500 font-mono">at Km {formatDistance(summitSector.startDist, units)}</div>
                        </div>
                    </div>

                    {/* Crux */}
                    <div className="flex items-center justify-between bg-slate-900/40 p-3 rounded-xl border border-slate-700/30">
                        <div className="flex items-center gap-3">
                            <Zap className="w-4 h-4 text-yellow-400" />
                            <span className="text-sm font-bold text-slate-300">The Crux</span>
                        </div>
                        <div className="text-right">
                             <div className="text-white font-bold">{cruxSector.avgGradient.toFixed(1)}% Grade</div>
                             <div className="text-[10px] text-slate-500 font-mono">at Km {formatDistance(cruxSector.startDist, units)}</div>
                        </div>
                    </div>

                     {/* Grind */}
                     {maxGrindDist > 0 && (
                        <div className="flex items-center justify-between bg-slate-900/40 p-3 rounded-xl border border-slate-700/30">
                            <div className="flex items-center gap-3">
                                <ArrowUpRight className="w-4 h-4 text-orange-400" />
                                <span className="text-sm font-bold text-slate-300">The Grind</span>
                            </div>
                            <div className="text-right">
                                <div className="text-white font-bold">{formatDistance(maxGrindDist, units)} {units === 'metric' ? 'km' : 'mi'}</div>
                                <div className="text-[10px] text-slate-500 font-mono">starts Km {formatDistance(grindStartSector.startDist, units)}</div>
                            </div>
                        </div>
                     )}
                 </div>
            </div>

            {/* COL 3: Strategy */}
            <div className="space-y-4 lg:pl-4 pt-6 lg:pt-0">
                 <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Pacing Strategy</div>
                 
                 <div className="flex flex-col h-full justify-between pb-2">
                     <div>
                         <div className="flex justify-between items-baseline mb-2">
                             <span className="text-sm text-slate-400">Target Split</span>
                             <span className={`text-lg font-bold ${isNegativeSplit ? 'text-emerald-400' : 'text-orange-400'}`}>
                                {isNegativeSplit ? "Negative" : "Positive"}
                             </span>
                         </div>
                         
                         {/* Visual Bar */}
                         <div className="h-2 bg-slate-900 rounded-full flex overflow-hidden mb-4">
                            <div className="bg-blue-600" style={{ width: `${(firstHalfTime / targetTimeSeconds) * 100}%` }}/>
                            <div className="bg-indigo-500" style={{ width: `${(secondHalfTime / targetTimeSeconds) * 100}%` }}/>
                         </div>
                     </div>

                     <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-slate-900/50 rounded-lg text-center">
                            <div className="text-xs text-slate-500 uppercase font-bold mb-1">First Half</div>
                            <div className="text-lg font-mono font-bold text-white">{formatDuration(firstHalfTime)}</div>
                            <div className="text-[10px] text-slate-500">Controlled Effort</div>
                        </div>
                        <div className="p-3 bg-slate-900/50 rounded-lg text-center">
                            <div className="text-xs text-slate-500 uppercase font-bold mb-1">Second Half</div>
                            <div className="text-lg font-mono font-bold text-white">{formatDuration(secondHalfTime)}</div>
                            <div className="text-[10px] text-slate-500">{isNegativeSplit ? 'Push Harder' : 'Fade & Grit'}</div>
                        </div>
                     </div>
                 </div>
            </div>

        </div>
    </div>
  );
};

export default RouteInsights;
