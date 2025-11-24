import React, { useState, useMemo } from 'react';
import { PlannedSector, UnitSystem } from '../types';
import { ArrowUpRight, ArrowDownRight, Minus, ArrowRight, ChevronUp, ChevronDown, ChevronsUpDown, Droplets } from 'lucide-react';
import { formatDuration } from '../utils/geoUtils';
import { formatDistance, formatElevation, formatPace } from '../utils/unitUtils';

interface SectorListProps {
  sectors: PlannedSector[];
  units: UnitSystem;
}

type SortKey = 'id' | 'dist' | 'gain' | 'loss' | 'combined' | 'grade' | 'time' | 'pace' | 'accum';

const SectorList: React.FC<SectorListProps> = ({ sectors, units }) => {
  const [sortKey, setSortKey] = useState<SortKey>('id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const getGradientColor = (grad: number) => {
    if (grad > 8) return 'text-red-500 font-black';
    if (grad > 4) return 'text-orange-400 font-extrabold';
    if (grad > 1) return 'text-yellow-400 font-bold';
    if (grad < -2) return 'text-emerald-400 font-bold';
    return 'text-slate-400 font-medium';
  };

  const getGradientIcon = (grad: number) => {
    if (grad > 1) return <ArrowUpRight className="w-5 h-5 mr-1" />;
    if (grad < -1) return <ArrowDownRight className="w-5 h-5 mr-1" />;
    return <Minus className="w-5 h-5 mr-1" />;
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const sortedSectors = useMemo(() => {
    return [...sectors].sort((a, b) => {
      let valA: number;
      let valB: number;

      switch (sortKey) {
        case 'id': valA = a.id; valB = b.id; break;
        case 'dist': valA = a.startDist; valB = b.startDist; break;
        case 'gain': valA = a.elevationGain; valB = b.elevationGain; break;
        case 'loss': valA = a.elevationLoss; valB = b.elevationLoss; break;
        case 'combined': valA = a.combinedElevationChange; valB = b.combinedElevationChange; break;
        case 'grade': valA = a.avgGradient; valB = b.avgGradient; break;
        case 'time': valA = a.targetDurationSeconds; valB = b.targetDurationSeconds; break;
        case 'pace': valA = a.targetPaceSeconds; valB = b.targetPaceSeconds; break;
        case 'accum': valA = a.accumulatedTimeSeconds; valB = b.accumulatedTimeSeconds; break;
        default: valA = a.id; valB = b.id;
      }

      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });
  }, [sectors, sortKey, sortDirection]);

  const SortHeader: React.FC<{ label: string; id: SortKey; align?: 'left' | 'right' }> = ({ label, id, align = 'right' }) => (
    <th 
      className={`px-6 py-5 bg-slate-900/90 backdrop-blur cursor-pointer hover:bg-slate-800 transition-colors select-none ${align === 'right' ? 'text-right' : 'text-left'}`}
      onClick={() => handleSort(id)}
    >
      <div className={`flex items-center gap-2 ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
        <span className="text-slate-200 font-bold text-base tracking-wide uppercase">{label}</span>
        <span className="text-blue-500">
          {sortKey === id ? (
            sortDirection === 'asc' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />
          ) : (
            <ChevronsUpDown className="w-5 h-5 opacity-30 hover:opacity-100" />
          )}
        </span>
      </div>
    </th>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800/40 shadow-2xl">
      <div className="overflow-x-auto max-h-[800px] scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-900">
        <table className="min-w-full text-left whitespace-nowrap relative">
          <thead className="sticky top-0 z-20 shadow-xl border-b border-slate-600">
            <tr>
              <SortHeader label="#" id="id" align="left" />
              <SortHeader label={units === 'metric' ? "Km Range" : "Mile Range"} id="dist" align="left" />
              <SortHeader label="Gain" id="gain" />
              <SortHeader label="Loss" id="loss" />
              <SortHeader label="Grade" id="grade" />
              <SortHeader label="Time" id="time" />
              <SortHeader label="Pace" id="pace" />
              <SortHeader label="Accum" id="accum" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {sortedSectors.map((sector) => (
              <tr key={sector.id} className="hover:bg-slate-700/60 transition-colors group">
                <td className="px-6 py-5 font-mono text-slate-500 group-hover:text-white transition-colors text-lg font-bold">
                  {sector.hasAidStation ? (
                    <div className="flex items-center gap-2">
                         <span>{sector.id}</span>
                         <Droplets className="w-4 h-4 text-blue-400" />
                    </div>
                  ) : sector.id}
                </td>
                
                <td className="px-6 py-5 text-slate-300 font-mono text-lg">
                  <div className="flex items-center gap-3">
                    <span className="opacity-60">{formatDistance(sector.startDist, units)}</span>
                    <ArrowRight className="w-4 h-4 text-slate-600"/>
                    <span className="font-bold text-white">{formatDistance(sector.endDist, units)}</span>
                  </div>
                </td>

                <td className="px-6 py-5 text-right font-mono text-lg font-medium">
                  {sector.elevationGain > 0 ? (
                    <span className="text-orange-400 bg-orange-400/10 px-2 py-1 rounded">+{formatElevation(sector.elevationGain, units)}{units === 'metric' ? 'm' : 'ft'}</span>
                  ) : <span className="text-slate-600">-</span>}
                </td>

                <td className="px-6 py-5 text-right font-mono text-lg font-medium">
                   {sector.elevationLoss > 0 ? (
                     <span className="text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">-{formatElevation(sector.elevationLoss, units)}{units === 'metric' ? 'm' : 'ft'}</span>
                   ) : <span className="text-slate-600">-</span>}
                </td>

                <td className={`px-6 py-5 text-right font-mono text-xl ${getGradientColor(sector.avgGradient)}`}>
                  <div className="flex items-center justify-end">
                    {getGradientIcon(sector.avgGradient)}
                    {Math.abs(sector.avgGradient).toFixed(1)}%
                  </div>
                </td>

                <td className="px-6 py-5 text-right font-mono text-blue-100 text-xl font-medium">
                  {formatDuration(sector.targetDurationSeconds)}
                </td>

                <td className="px-6 py-5 text-right font-mono text-blue-300 text-xl font-bold">
                  {formatPace(sector.targetPaceSeconds, units)}
                </td>

                <td className="px-6 py-5 text-right font-mono text-white text-lg font-bold border-l border-slate-700/50 bg-slate-900/30">
                  {formatDuration(sector.accumulatedTimeSeconds)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SectorList;