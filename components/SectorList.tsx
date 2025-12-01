
import React, { useState, useMemo, useRef } from 'react';
import { PlannedSector, UnitSystem } from '../types';
import { ArrowUpRight, ArrowDownRight, Minus, ArrowRight, ChevronUp, ChevronDown, ChevronsUpDown, Droplets, LayoutList, Table2, Download, FileSpreadsheet, Image as ImageIcon } from 'lucide-react';
import { formatDuration } from '../utils/geoUtils';
import { formatDistance, formatElevation, formatPace } from '../utils/unitUtils';
import html2canvas from 'html2canvas';

interface SectorListProps {
  sectors: PlannedSector[];
  units: UnitSystem;
}

type SortKey = 'id' | 'dist' | 'gain' | 'loss' | 'grade' | 'time' | 'pace' | 'accum' | 'combined';

const SectorList: React.FC<SectorListProps> = ({ sectors, units }) => {
  const [sortKey, setSortKey] = useState<SortKey>('id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [simpleMode, setSimpleMode] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const getGradientStyle = (grad: number) => {
    // New Palette Specification:
    // > 10%: #dc2626
    // 5-10%: #fb923c
    // 1-5%: #fcd34d
    // -1 to 1%: #60a5fa
    // -5 to -1%: #34d399
    // -10 to -5%: #2dd4bf
    // < -10%: #0d9488

    if (grad > 10) return { color: '#dc2626', fontWeight: 900 };
    if (grad > 5)  return { color: '#fb923c', fontWeight: 800 };
    if (grad > 1)  return { color: '#fcd34d', fontWeight: 700 };
    if (grad >= -1) return { color: '#60a5fa', fontWeight: 600 };
    if (grad >= -5) return { color: '#34d399', fontWeight: 600 };
    if (grad >= -10) return { color: '#2dd4bf', fontWeight: 700 };
    return { color: '#0d9488', fontWeight: 800 };
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

  const handleDownloadImage = async () => {
      if (!tableContainerRef.current) return;
      setIsExporting(true);

      const originalMaxHeight = tableContainerRef.current.style.maxHeight;
      const originalOverflow = tableContainerRef.current.style.overflow;

      tableContainerRef.current.style.maxHeight = 'none';
      tableContainerRef.current.style.overflow = 'visible';

      try {
          const canvas = await html2canvas(tableContainerRef.current, {
              backgroundColor: '#0f172a', 
              scale: 2, 
              logging: false,
              useCORS: true
          });

          const link = document.createElement('a');
          link.download = 'race-plan-cheat-sheet.png';
          link.href = canvas.toDataURL('image/png');
          link.click();

      } catch (err) {
          console.error("Export failed", err);
          alert("Failed to create image");
      } finally {
          if (tableContainerRef.current) {
              tableContainerRef.current.style.maxHeight = originalMaxHeight;
              tableContainerRef.current.style.overflow = originalOverflow;
          }
          setIsExporting(false);
      }
  };

  const handleDownloadCSV = () => {
      const headers = simpleMode 
        ? ['ID', 'Start', 'End', 'Net Elevation', 'Pace', 'Accumulated Time']
        : ['ID', 'Start', 'End', 'Gain', 'Loss', 'Grade', 'Duration', 'Pace', 'Accumulated Time'];
      
      const rows = sortedSectors.map(s => {
          const start = formatDistance(s.startDist, units);
          const end = formatDistance(s.endDist, units);
          const pace = formatPace(s.targetPaceSeconds, units);
          const accum = formatDuration(s.accumulatedTimeSeconds);

          if (simpleMode) {
              const net = formatElevation(s.elevationGain - s.elevationLoss, units);
              return [s.id, start, end, net, pace, accum];
          } else {
              const gain = formatElevation(s.elevationGain, units);
              const loss = formatElevation(s.elevationLoss, units);
              const grade = s.avgGradient.toFixed(1);
              const dur = formatDuration(s.targetDurationSeconds);
              return [s.id, start, end, gain, loss, grade, dur, pace, accum];
          }
      });

      const csvContent = [
          headers.join(','),
          ...rows.map(row => row.join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'race_plan_data.csv';
      link.click();
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
        case 'grade': valA = a.avgGradient; valB = b.avgGradient; break;
        case 'time': valA = a.targetDurationSeconds; valB = b.targetDurationSeconds; break;
        case 'pace': valA = a.targetPaceSeconds; valB = b.targetPaceSeconds; break;
        case 'accum': valA = a.accumulatedTimeSeconds; valB = b.accumulatedTimeSeconds; break;
        case 'combined': 
            valA = a.elevationGain - a.elevationLoss; 
            valB = b.elevationGain - b.elevationLoss; 
            break;
        default: valA = a.id; valB = b.id;
      }

      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });
  }, [sectors, sortKey, sortDirection]);

  const SortHeader: React.FC<{ label: string; id: SortKey; align?: 'left' | 'center' | 'right' }> = ({ label, id, align = 'right' }) => (
    <th 
      className={`px-6 py-5 bg-slate-900/90 backdrop-blur cursor-pointer hover:bg-slate-800 transition-colors select-none ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}`}
      onClick={() => handleSort(id)}
    >
      <div className={`flex items-center gap-2 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
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
    <div className="flex flex-col gap-4">
      {/* View Toggle & Export */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
            <button
                onClick={handleDownloadImage}
                disabled={isExporting}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors text-sm font-bold shadow-lg shadow-blue-900/20 disabled:opacity-50"
            >
                {isExporting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <ImageIcon className="w-4 h-4" />}
                <span>Cheat Sheet (Image)</span>
            </button>
             <button
                onClick={handleDownloadCSV}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg border border-slate-700 transition-colors text-sm font-medium"
            >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Excel/CSV</span>
            </button>
        </div>

        <button
          onClick={() => setSimpleMode(!simpleMode)}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg border border-slate-700 transition-colors text-sm font-medium"
        >
          {simpleMode ? <Table2 className="w-4 h-4" /> : <LayoutList className="w-4 h-4" />}
          <span>{simpleMode ? 'Show Detailed Columns' : 'Simplify View'}</span>
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800/40 shadow-2xl">
        <div 
            ref={tableContainerRef}
            className="overflow-x-auto max-h-[800px] scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-900 bg-[#0f172a]"
        >
          <table className="min-w-full text-left whitespace-nowrap relative">
            <thead className="sticky top-0 z-20 shadow-xl border-b border-slate-600">
              <tr>
                <SortHeader label="#" id="id" align="left" />
                <SortHeader label={units === 'metric' ? "Km Range" : "Mile Range"} id="dist" align="left" />
                
                {simpleMode ? (
                  // Simplified Columns
                  <SortHeader label="Net Elev" id="combined" />
                ) : (
                  // Detailed Columns
                  <>
                    <SortHeader label="Gain" id="gain" />
                    <SortHeader label="Loss" id="loss" />
                    <SortHeader label="Grade" id="grade" />
                    <SortHeader label="Time" id="time" />
                  </>
                )}

                <SortHeader label="Pace" id="pace" />
                <SortHeader label="Accum" id="accum" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {sortedSectors.map((sector) => {
                const netChange = sector.elevationGain - sector.elevationLoss;
                const gradientStyle = getGradientStyle(sector.avgGradient);
                
                return (
                <tr 
                  key={sector.id} 
                  className={`transition-colors group ${sector.hasAidStation ? 'bg-blue-900/20 hover:bg-blue-900/30' : 'hover:bg-slate-700/60'}`}
                >
                  <td className="px-6 py-5 font-mono text-slate-500 group-hover:text-white transition-colors text-lg font-bold">
                    {sector.hasAidStation ? (
                      <div className="flex items-center gap-2 text-blue-400">
                           <span>{sector.id}</span>
                           <div className="bg-blue-600 rounded-full p-1" title="Aid Station">
                              <Droplets className="w-3 h-3 text-white" />
                           </div>
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

                  {simpleMode ? (
                     <td className="px-6 py-5 text-right font-mono text-lg font-medium">
                        {netChange > 0 ? (
                            <span style={{ color: '#fb923c', backgroundColor: 'rgba(251, 146, 60, 0.1)' }} className="px-2 py-1 rounded">+{formatElevation(netChange, units)} {units === 'metric' ? 'm' : 'ft'}</span>
                        ) : netChange < 0 ? (
                            <span style={{ color: '#34d399', backgroundColor: 'rgba(52, 211, 153, 0.1)' }} className="px-2 py-1 rounded">{formatElevation(netChange, units)} {units === 'metric' ? 'm' : 'ft'}</span>
                        ) : (
                            <span className="text-blue-400">-</span>
                        )}
                     </td>
                  ) : (
                    <>
                      <td className="px-6 py-5 text-right font-mono text-lg font-medium">
                        {sector.elevationGain > 0 ? (
                          <span style={{ color: '#fb923c', backgroundColor: 'rgba(251, 146, 60, 0.1)' }} className="px-2 py-1 rounded">+{formatElevation(sector.elevationGain, units)}{units === 'metric' ? 'm' : 'ft'}</span>
                        ) : <span className="text-slate-600">-</span>}
                      </td>

                      <td className="px-6 py-5 text-right font-mono text-lg font-medium">
                         {sector.elevationLoss > 0 ? (
                           <span style={{ color: '#34d399', backgroundColor: 'rgba(52, 211, 153, 0.1)' }} className="px-2 py-1 rounded">-{formatElevation(sector.elevationLoss, units)}{units === 'metric' ? 'm' : 'ft'}</span>
                         ) : <span className="text-slate-600">-</span>}
                      </td>

                      <td className="px-6 py-5 text-right font-mono text-xl" style={gradientStyle}>
                        <div className="flex items-center justify-end">
                          {getGradientIcon(sector.avgGradient)}
                          {Math.abs(sector.avgGradient).toFixed(1)}%
                        </div>
                      </td>

                      <td className="px-6 py-5 text-right font-mono text-blue-100 text-xl font-medium">
                        {formatDuration(sector.targetDurationSeconds)}
                        {sector.hasAidStation && <div className="text-xs text-blue-400 mt-1 font-bold">+Stop</div>}
                      </td>
                    </>
                  )}

                  <td className="px-6 py-5 text-right font-mono text-blue-300 text-xl font-bold">
                    {formatPace(sector.targetPaceSeconds, units)}
                  </td>

                  <td className="px-6 py-5 text-right font-mono text-white text-lg font-bold border-l border-slate-700/50 bg-slate-900/30">
                    {formatDuration(sector.accumulatedTimeSeconds)}
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SectorList;
