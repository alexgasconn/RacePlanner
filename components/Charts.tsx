
import React, { useMemo } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, ComposedChart, Line, ReferenceLine, ReferenceDot
} from 'recharts';
import { GPXPoint, PlannedSector, UnitSystem, SmoothingLevel, AidStation } from '../types';
import { formatPace, formatDistance, formatElevation, KM_TO_MILES } from '../utils/unitUtils';
import { formatDuration } from '../utils/geoUtils';
import { Droplets } from 'lucide-react';

// --- PROFESSIONAL COLOR PALETTE & CLASSIFICATION ---

const getTerrainClass = (grad: number) => {
    // New Palette Specification:
    // Steep Climb (> 10%)       – Rich Red #dc2626
    // Moderate Climb (5% to 10%)– Orange #fb923c
    // Light Climb (1% to 5%)    – Warm Yellow #fcd34d
    // Flat (-1% to 1%)          – Soft Blue #60a5fa
    // Light Descent (-5% to -1%)– Mint #34d399
    // Moderate Descent (-10% to -5%) – Turquoise #2dd4bf
    // Steep Descent (< -10%)    – Deep Teal #0d9488

    if (grad > 10) return { label: 'Steep Climb', color: '#dc2626' };
    if (grad > 5)  return { label: 'Mod Climb', color: '#fb923c' };
    if (grad > 1)  return { label: 'Light Climb', color: '#fcd34d' };
    if (grad >= -1) return { label: 'Flat', color: '#60a5fa' };
    if (grad >= -5) return { label: 'Light Desc', color: '#34d399' };
    if (grad >= -10) return { label: 'Mod Desc', color: '#2dd4bf' };
    return { label: 'Steep Desc', color: '#0d9488' };
};

const getGradientColor = (val: number) => getTerrainClass(val).color;

interface ChartProps {
  sectors?: PlannedSector[];
  units: UnitSystem;
  rawData?: GPXPoint[];
  avgPaceSeconds?: number;
  onHover?: (distance: number | null) => void;
  hoveredDist?: number | null;
  smoothing?: SmoothingLevel;
  aidStations?: AidStation[];
}

export const ElevationProfile: React.FC<ChartProps> = ({ rawData, units, onHover, hoveredDist, smoothing = 'soft', aidStations = [] }) => {
  if (!rawData || rawData.length === 0) return null;

  // 1. Process Data & Calculate Gradients
  const chartData = useMemo(() => {
    // A. Downsample first for performance
    const downsampled = rawData.filter((_, i) => i === 0 || i % 5 === 0 || i === rawData.length - 1);
    
    // B. Apply Smoothing (Moving Average)
    const windowSize = smoothing === 'strong' ? 12 : smoothing === 'soft' ? 5 : 0;
    
    const smoothedPoints = downsampled.map((p, i, arr) => {
        if (windowSize === 0) return p;

        let sumEle = 0;
        let count = 0;
        
        // Simple windowed average
        for (let j = i - windowSize; j <= i + windowSize; j++) {
            if (arr[j]) {
                sumEle += arr[j].ele;
                count++;
            }
        }
        
        return {
            ...p,
            ele: sumEle / count
        };
    });

    // C. Map to Chart Format & Calculate Gradient on Smoothed Data
    return smoothedPoints.map((p, i, arr) => {
      let grad = 0;
      if (i > 0) {
        const prev = arr[i-1];
        const dDist = p.distFromStart - prev.distFromStart;
        const dEle = p.ele - prev.ele;
        if (dDist > 0) grad = (dEle / dDist) * 100;
      }

      return {
        dist: parseFloat(formatDistance(p.distFromStart, units)),
        ele: parseInt(formatElevation(p.ele, units)),
        rawDist: p.distFromStart,
        gradient: grad
      };
    });
  }, [rawData, units, smoothing]);

  // 2. Find closest active point
  let activePoint = null;
  if (hoveredDist !== null && hoveredDist !== undefined) {
      const unitDist = parseFloat(formatDistance(hoveredDist, units));
      activePoint = chartData.reduce((prev, curr) => {
        return (Math.abs(curr.dist - unitDist) < Math.abs(prev.dist - unitDist) ? curr : prev);
      });
  }

  // 3. Process Aid Stations for Chart
  const chartAidStations = useMemo(() => {
      if (!aidStations.length) return [];
      return aidStations.map(station => {
          const displayDist = station.distanceFromStart; // Already in user units (km or mi)
          
          // Find the elevation at this distance for positioning
          const closestPoint = chartData.reduce((prev, curr) => {
             return (Math.abs(curr.dist - displayDist) < Math.abs(prev.dist - displayDist) ? curr : prev);
          });
          
          return {
              x: displayDist,
              y: closestPoint.ele,
              label: `Aid: ${station.distanceFromStart} ${units === 'metric' ? 'km' : 'mi'}`
          };
      });
  }, [aidStations, chartData, units]);

  // 4. Construct Dynamic SVG Gradient
  // Use Distance-Based Sampling for pixel-perfect accuracy
  const gradientStops = useMemo(() => {
     if (chartData.length < 2) return [];

     const numStops = 100; 
     const stops = [];
     const maxDist = chartData[chartData.length - 1].dist; // Max distance in user units
     
     // Helper to find gradient at specific distance
     let searchIdx = 0;
     const getGradientAtDist = (d: number) => {
         // Determine which segment [i, i+1] covers distance d
         for (let i = searchIdx; i < chartData.length - 1; i++) {
             if (chartData[i].dist <= d && chartData[i+1].dist >= d) {
                 searchIdx = i;
                 return chartData[i+1].gradient;
             }
         }
         return chartData[chartData.length-1].gradient;
     };

     for (let i = 0; i <= numStops; i++) {
         const pct = i / numStops;
         const currentDist = pct * maxDist;
         const grad = getGradientAtDist(currentDist);
         
         stops.push(
             <stop 
                key={i} 
                offset={`${i}%`} 
                stopColor={getTerrainClass(grad).color} 
                stopOpacity={0.7} 
             />
         );
     }
     return stops;
  }, [chartData]);

  return (
    <div className="h-full w-full min-h-[350px]" onMouseLeave={() => onHover && onHover(null)}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart 
          data={chartData} 
          margin={{ top: 20, right: 10, left: -10, bottom: 0 }}
          onMouseMove={(e) => {
            if (e.activePayload && e.activePayload[0] && onHover) {
              const d = e.activePayload[0].payload.rawDist;
              onHover(d);
            }
          }}
        >
          <defs>
            <linearGradient id="slopeGradient" x1="0" y1="0" x2="1" y2="0">
                {gradientStops}
            </linearGradient>
            <filter id="shadow" height="200%">
                <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000" floodOpacity="0.4"/>
            </filter>
          </defs>
          
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          
          <XAxis 
            dataKey="dist" 
            type="number"
            domain={['dataMin', 'dataMax']}
            tick={{fontSize: 11, fill: '#64748b', fontWeight: 500}} 
            interval="preserveStartEnd"
            tickCount={8}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) => `${val} ${units === 'metric' ? 'km' : 'mi'}`}
          />
          
          <YAxis 
            stroke="#64748b" 
            tick={{fontSize: 11, fontWeight: 500}} 
            // Clamp min value to 0 unless data goes negative
            domain={[dataMin => Math.max(0, Math.floor(dataMin - 20)), 'dataMax + 20']} 
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) => `${val}`}
            width={40}
          />
          
          <Tooltip 
            cursor={{ stroke: '#fff', strokeWidth: 1, strokeDasharray: '4 4' }}
            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
            labelStyle={{ color: '#94a3b8', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', display: 'block' }}
            labelFormatter={(label) => `${label} ${units === 'metric' ? 'km' : 'mi'}`}
            formatter={(value: any, name: string, props: any) => {
               if (name === 'Elevation') {
                   const grad = props.payload.gradient;
                   const terrain = getTerrainClass(grad);
                   return [
                       <div key="tool" className="flex flex-col gap-1 min-w-[120px]">
                           <span className="text-2xl font-bold text-white">{value} <span className="text-sm text-slate-500 font-normal">{units === 'metric' ? 'm' : 'ft'}</span></span>
                           <div className="flex items-center gap-2 mt-1 pt-2 border-t border-slate-700">
                               <div className="w-2 h-2 rounded-full" style={{ background: terrain.color }}></div>
                               <span className="text-xs font-bold uppercase tracking-wider" style={{ color: terrain.color }}>
                                   {terrain.label}
                               </span>
                               <span className="text-xs text-slate-400 ml-auto">
                                   {grad > 0 ? '+' : ''}{grad.toFixed(1)}%
                               </span>
                           </div>
                       </div>, 
                       '' 
                   ];
               }
               return [value, name];
            }}
          />

          <Area 
            dataKey="ele" 
            name="Elevation"
            type="monotone" 
            stroke="#fff" 
            strokeWidth={2}
            fill="url(#slopeGradient)" 
            animationDuration={1500}
            isAnimationActive={true}
            filter="url(#shadow)"
          />
          
          {/* Aid Station Markers */}
          {chartAidStations.map((station, i) => (
             <ReferenceDot 
                key={`aid-${i}`}
                x={station.x} 
                y={station.y} 
                r={4} 
                fill="#3b82f6" 
                stroke="#fff" 
                strokeWidth={2}
                label={{ 
                    position: 'top', 
                    value: '💧', 
                    fontSize: 16,
                    fill: '#3b82f6',
                    dy: -10 
                }}
             />
          ))}

          {activePoint && (
             <ReferenceDot 
                x={activePoint.dist} 
                y={activePoint.ele} 
                r={6} 
                fill={getTerrainClass(activePoint.gradient).color} 
                stroke="#fff" 
                strokeWidth={2}
             />
          )}

        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export const PaceStrategyChart: React.FC<ChartProps> = ({ sectors, units }) => {
  if (!sectors) return null;
  const data = [...sectors].sort((a, b) => a.id - b.id).map(s => ({
    km: parseFloat(formatDistance(s.endDist, units)),
    pace: s.targetPaceSeconds, 
    gradient: s.avgGradient
  }));

  return (
    <div className="h-full w-full min-h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart 
          data={data} 
          margin={{ top: 10, right: 0, left: -20, bottom: 0 }}
          barCategoryGap={0} 
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis 
             dataKey="km" 
             type="number"
             domain={['dataMin', 'dataMax']}
             stroke="#94a3b8" 
             tick={{fontSize: 10}} 
             tickCount={8} 
             interval="preserveStartEnd"
             tickLine={false}
             axisLine={false}
          />
          <YAxis 
             yAxisId="left"
             stroke="#60a5fa" 
             tick={{fontSize: 10, fill: '#60a5fa'}}
             domain={['auto', 'auto']}
             tickFormatter={(val) => formatPace(val, units).split('/')[0]}
             reversed={true} 
             tickLine={false}
             axisLine={false}
          />
          <YAxis 
            yAxisId="right" 
            orientation="right" 
            stroke="#94a3b8" 
            tick={{fontSize: 10}}
            unit="%"
            hide={true}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#f8fafc' }}
            labelFormatter={(label) => `${units === 'metric' ? 'Km' : 'Mi'} ${label}`}
            formatter={(value: any, name: string) => {
              if (name === 'pace') return [formatPace(value, units), 'Target Pace'];
              if (name === 'gradient') return [`${parseFloat(value).toFixed(1)}%`, 'Gradient'];
              return [value, name];
            }}
          />
          <Bar yAxisId="right" dataKey="gradient" fill="#94a3b8" opacity={0.1} barSize={undefined} />
          <Line 
            yAxisId="left"
            type="monotone" 
            dataKey="pace" 
            stroke="#60a5fa" 
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 6, fill: '#60a5fa' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export const GradientDistributionChart: React.FC<ChartProps> = ({ rawData }) => {
  const data = useMemo(() => {
    if (!rawData || rawData.length < 2) return [];

    const SAMPLE_DIST_METERS = 100; 
    const gradients: number[] = [];
    const totalDist = rawData[rawData.length - 1].distFromStart;
    
    let lastIdx = 0;
    const findEleAt = (targetDist: number): number | null => {
        for(let i = lastIdx; i < rawData.length - 1; i++) {
            if (rawData[i].distFromStart <= targetDist && rawData[i+1].distFromStart >= targetDist) {
                const p1 = rawData[i];
                const p2 = rawData[i+1];
                const segmentLen = p2.distFromStart - p1.distFromStart;
                if (segmentLen === 0) return p1.ele;
                const ratio = (targetDist - p1.distFromStart) / segmentLen;
                lastIdx = i; 
                return p1.ele + (p2.ele - p1.ele) * ratio;
            }
        }
        return null;
    };

    for(let d = 0; d < totalDist - SAMPLE_DIST_METERS; d += SAMPLE_DIST_METERS) {
        const ele1 = findEleAt(d);
        const ele2 = findEleAt(d + SAMPLE_DIST_METERS);
        
        if (ele1 !== null && ele2 !== null) {
            const gain = ele2 - ele1;
            const grad = (gain / SAMPLE_DIST_METERS) * 100;
            gradients.push(grad);
        }
    }

    if (gradients.length === 0) return [];

    const minG = Math.floor(Math.min(...gradients));
    const maxG = Math.ceil(Math.max(...gradients));
    
    let binSize = 1;
    const range = maxG - minG;
    if (range < 5) binSize = 0.5;
    if (range > 25) binSize = 2;

    const bins: Record<string, { label: string, count: number, min: number, color: string }> = {};
    
    for (let i = Math.floor(minG / binSize) * binSize; i < maxG; i += binSize) {
        const label = `${i.toFixed(1)}%`;
        bins[label] = { 
            label, 
            count: 0, 
            min: i,
            color: getGradientColor(i + binSize/2)
        };
    }

    gradients.forEach(g => {
        const binStart = Math.floor(g / binSize) * binSize;
        const label = `${binStart.toFixed(1)}%`;
        if (bins[label]) bins[label].count++;
    });

    return Object.values(bins)
      .filter(b => b.count > 0)
      .sort((a, b) => a.min - b.min);
  }, [rawData]);

  if (data.length === 0) return null;

  return (
    <div className="h-full w-full min-h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barCategoryGap="10%">
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} interval={0} tickLine={false} axisLine={false} height={20} />
          <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false}/>
          <Tooltip 
            cursor={{fill: '#334155', opacity: 0.2}}
            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#f8fafc' }}
          />
          <Bar dataKey="count" radius={[2, 2, 0, 0]}>
             {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const PaceVarianceChart: React.FC<ChartProps> = ({ sectors, avgPaceSeconds, units }) => {
  if (!sectors || !avgPaceSeconds) return null;
  const sortedSectors = [...sectors].sort((a,b) => a.id - b.id);
  
  const data = sortedSectors.map(s => ({
    km: parseFloat(formatDistance(s.endDist, units)),
    variance: s.targetPaceSeconds - avgPaceSeconds, 
    distNum: s.endDist
  }));

  return (
    <div className="h-full w-full min-h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart 
          data={data} 
          margin={{ top: 5, right: 0, left: -10, bottom: 0 }}
          barCategoryGap={0} 
          barGap={0}
        >
           <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
           <XAxis 
            dataKey="km" 
            type="number"
            domain={['dataMin', 'dataMax']}
            stroke="#94a3b8" 
            tick={{fontSize: 10}} 
            tickCount={8} 
            interval="preserveStartEnd"
            tickLine={false}
            axisLine={false}
           />
           <YAxis 
             stroke="#94a3b8" 
             tick={{fontSize: 10}} 
             tickLine={false}
             axisLine={false}
            />
           <Tooltip 
              cursor={{fill: '#334155', opacity: 0.2}}
              contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#f8fafc' }}
              formatter={(val: number) => [`${Math.abs(Math.round(val))}s ${val > 0 ? 'slower' : 'faster'}`, 'Vs Avg']}
           />
           <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={1} />
           <Bar dataKey="variance" isAnimationActive={false}>
             {data.map((entry, index) => {
               const color = entry.variance > 0 ? '#f87171' : '#4ade80';
               return (
                 <Cell 
                   key={`cell-${index}`} 
                   fill={color} 
                   stroke={color} 
                   strokeWidth={1}
                 />
               );
             })}
           </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const TimeBankChart: React.FC<ChartProps> = ({ sectors, avgPaceSeconds, units }) => {
    if (!sectors || !avgPaceSeconds) return null;
    const sorted = [...sectors].sort((a,b) => a.id - b.id);
    
    const data = sorted.map(s => {
        const distKm = s.endDist / 1000;
        const linearTime = distKm * avgPaceSeconds;
        const plannedTime = s.accumulatedTimeSeconds;
        const delta = linearTime - plannedTime; 
        
        return {
            km: parseFloat(formatDistance(s.endDist, units)),
            delta: delta,
            formattedDelta: formatDuration(Math.abs(delta))
        };
    });

    return (
        <div className="h-full w-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 0, left: -10, bottom: 0 }}>
                    <defs>
                        <linearGradient id="bankGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis 
                      dataKey="km" 
                      type="number" 
                      domain={['dataMin', 'dataMax']} 
                      stroke="#94a3b8" 
                      tick={{fontSize: 10}} 
                      tickCount={8}
                      interval="preserveStartEnd"
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <YAxis stroke="#94a3b8" tick={{fontSize: 10}} tickLine={false} axisLine={false}/>
                    <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#f8fafc' }}
                        formatter={(val: number) => [
                            `${val > 0 ? '+' : '-'}${formatDuration(Math.abs(val))}`, 
                            val > 0 ? 'Banked (Ahead)' : 'Debt (Behind)'
                        ]}
                    />
                    <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3"/>
                    <Area 
                        type="monotone" 
                        dataKey="delta" 
                        stroke="#22c55e" 
                        strokeWidth={2}
                        fill="url(#bankGradient)" 
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
