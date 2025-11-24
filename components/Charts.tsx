import React from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, ComposedChart, Line, ReferenceLine
} from 'recharts';
import { GPXPoint, PlannedSector } from '../types';
import { formatPace, formatDuration } from '../utils/geoUtils';

// Helper to determine color based on gradient
const getGradientColor = (val: number) => {
    if (val > 10) return '#b91c1c'; // Dark Red (Extreme)
    if (val > 6) return '#ef4444'; // Red (Hard)
    if (val > 3) return '#f97316'; // Orange (Mod)
    if (val > 1) return '#eab308'; // Yellow (Mild)
    if (val > -2) return '#94a3b8'; // Gray (Flat)
    if (val > -5) return '#4ade80'; // Green (Downhill)
    return '#15803d'; // Dark Green (Steep Downhill)
};

export const ElevationProfile: React.FC<{ rawData: GPXPoint[] }> = ({ rawData }) => {
  // We downsample raw data for performance but keep shape
  const chartData = rawData.filter((_, i) => i % 5 === 0).map(p => ({
    dist: (p.distFromStart / 1000).toFixed(2),
    ele: Math.round(p.ele),
    distNum: p.distFromStart
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="eleFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          
          <XAxis 
            dataKey="dist" 
            type="category"
            allowDuplicatedCategory={false}
            tick={{fontSize: 12, fill: '#94a3b8'}} 
            interval="preserveStartEnd"
            minTickGap={50}
            tickLine={false}
            axisLine={false}
          />
          
          <YAxis 
            stroke="#94a3b8" 
            tick={{fontSize: 12}} 
            domain={['dataMin - 10', 'dataMax + 10']} 
            tickLine={false}
            axisLine={false}
          />
          
          <Tooltip 
            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#475569', color: '#f8fafc' }}
            formatter={(value: any, name: string) => {
               if (name === 'Elevation') return [`${value}m`, name];
               return [value, name];
            }}
            labelFormatter={(label) => `${label} km`}
          />

          <Area 
            dataKey="ele" 
            name="Elevation"
            type="monotone" 
            stroke="#3b82f6" 
            strokeWidth={3}
            fill="url(#eleFill)" 
            animationDuration={1500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export const CourseDifficultyRibbon: React.FC<{ sectors: PlannedSector[] }> = ({ sectors }) => {
  // This chart visualizes the "Hardness" as a continuous bar strip
  // Sorted by distance to ensure order
  const data = [...sectors].sort((a,b) => a.id - b.id).map(s => ({
    id: s.id,
    km: (s.endDist / 1000).toFixed(1),
    grad: s.avgGradient,
    intensity: 1 // Fixed height for ribbon effect
  }));

  return (
    <div className="w-full h-16 mt-2 relative group">
       <ResponsiveContainer width="100%" height="100%">
         <BarChart data={data} barGap={0} barCategoryGap={0}>
           <Tooltip 
             cursor={{fill: 'transparent'}}
             content={({ active, payload }) => {
               if (active && payload && payload.length) {
                 const d = payload[0].payload;
                 return (
                   <div className="bg-slate-900 border border-slate-700 p-2 rounded shadow-xl text-xs">
                     <div className="font-bold text-white">Sector {d.id}</div>
                     <div style={{ color: getGradientColor(d.grad) }}>
                       Avg Grade: {d.grad.toFixed(1)}%
                     </div>
                   </div>
                 );
               }
               return null;
             }}
           />
           <Bar dataKey="intensity" isAnimationActive={false}>
             {data.map((entry, index) => (
               <Cell key={`cell-${index}`} fill={getGradientColor(entry.grad)} />
             ))}
           </Bar>
         </BarChart>
       </ResponsiveContainer>
       <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="bg-black/50 px-2 py-1 rounded text-xs text-white backdrop-blur-sm">Gradient Intensity Ribbon</span>
       </div>
    </div>
  );
};

export const SectorGainChart: React.FC<{ sectors: PlannedSector[] }> = ({ sectors }) => {
  const data = [...sectors].sort((a,b) => a.id - b.id).map(s => ({
    name: `#${s.id}`,
    gain: Math.round(s.elevationGain),
  }));

  return (
    <div className="h-48 w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis dataKey="name" stroke="#94a3b8" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
          <Tooltip 
            cursor={{fill: '#334155', opacity: 0.4}}
            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#f8fafc' }}
          />
          <Bar dataKey="gain" fill="#f97316" radius={[4, 4, 0, 0]}>
             {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.gain > 30 ? '#ef4444' : '#f97316'} />
              ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const PaceStrategyChart: React.FC<{ sectors: PlannedSector[] }> = ({ sectors }) => {
  // STRICT SORTING BY ID/DISTANCE
  const data = [...sectors].sort((a, b) => a.id - b.id).map(s => ({
    km: (s.endDist/1000).toFixed(1),
    pace: s.targetPaceSeconds, 
    gradient: s.avgGradient
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis 
             dataKey="km" 
             stroke="#94a3b8" 
             tick={{fontSize: 12}} 
             tickLine={false}
             axisLine={false}
          />
          <YAxis 
             yAxisId="left"
             stroke="#60a5fa" 
             tick={{fontSize: 12, fill: '#60a5fa'}}
             domain={['auto', 'auto']}
             tickFormatter={(val) => formatPace(val).replace('/km','')}
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
            labelFormatter={(label) => `Km ${label}`}
            formatter={(value: any, name: string) => {
              if (name === 'pace') return [formatPace(value), 'Target Pace'];
              if (name === 'gradient') return [`${parseFloat(value).toFixed(1)}%`, 'Gradient'];
              return [value, name];
            }}
          />
          <Bar yAxisId="right" dataKey="gradient" fill="#94a3b8" opacity={0.1} barSize={20} />
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

export const GradientDistributionChart: React.FC<{ sectors: PlannedSector[] }> = ({ sectors }) => {
  const gradients = sectors.map(s => s.avgGradient);
  const minG = Math.floor(Math.min(...gradients));
  const maxG = Math.ceil(Math.max(...gradients));
  
  let binSize = 1;
  const range = maxG - minG;
  if (range < 5) binSize = 0.5;
  if (range > 20) binSize = 2;

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

  sectors.forEach(s => {
      const binStart = Math.floor(s.avgGradient / binSize) * binSize;
      const label = `${binStart.toFixed(1)}%`;
      if (bins[label]) bins[label].count++;
  });

  const data = Object.values(bins)
    .filter(b => b.count > 0)
    .sort((a, b) => a.min - b.min);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} interval={0} tickLine={false} axisLine={false} />
          <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false}/>
          <Tooltip 
            cursor={{fill: '#334155', opacity: 0.2}}
            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#f8fafc' }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
             {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const PaceVarianceChart: React.FC<{ sectors: PlannedSector[], avgPaceSeconds: number }> = ({ sectors, avgPaceSeconds }) => {
  const sortedSectors = [...sectors].sort((a,b) => a.id - b.id);
  
  const data = sortedSectors.map(s => ({
    km: (s.endDist/1000).toFixed(1),
    variance: s.targetPaceSeconds - avgPaceSeconds, 
    distNum: s.endDist
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 0, left: -10, bottom: 0 }}>
           <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
           <XAxis 
            dataKey="km" 
            stroke="#94a3b8" 
            tick={{fontSize: 10}} 
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
           <Bar dataKey="variance">
             {data.map((entry, index) => (
               <Cell key={`cell-${index}`} fill={entry.variance > 0 ? '#f87171' : '#4ade80'} />
             ))}
           </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const TimeBankChart: React.FC<{ sectors: PlannedSector[], avgPaceSeconds: number }> = ({ sectors, avgPaceSeconds }) => {
    // Sort to ensure line is correct
    const sorted = [...sectors].sort((a,b) => a.id - b.id);
    let cumulativeDelta = 0;
    
    const data = sorted.map(s => {
        const distKm = s.endDist / 1000;
        const linearTime = distKm * avgPaceSeconds;
        const plannedTime = s.accumulatedTimeSeconds;
        const delta = linearTime - plannedTime; 
        
        return {
            km: distKm.toFixed(1),
            delta: delta,
            formattedDelta: formatDuration(Math.abs(delta))
        };
    });

    return (
        <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 0, left: -10, bottom: 0 }}>
                    <defs>
                        <linearGradient id="bankGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="km" stroke="#94a3b8" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
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