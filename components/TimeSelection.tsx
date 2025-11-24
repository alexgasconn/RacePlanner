import React, { useState } from 'react';
import { Timer, Play, Settings2, Calendar, Droplets, Trash2, PlusCircle, Map } from 'lucide-react';
import { UnitSystem, AidStation } from '../types';
import { getUnitLabel } from '../utils/unitUtils';

interface TimeSelectionProps {
  onConfirm: (totalSeconds: number, sectorSize: number, units: UnitSystem, date: string, aidStations: AidStation[]) => void;
  defaultDistanceKm: number;
}

const SECTOR_OPTIONS_METRIC = [
  { label: '100m', value: 100 },
  { label: '250m', value: 250 },
  { label: '500m', value: 500 },
  { label: '1 km', value: 1000 },
  { label: '2 km', value: 2000 },
  { label: '5 km', value: 5000 },
];

// Values in meters for calculation
const SECTOR_OPTIONS_IMPERIAL = [
  { label: '0.1 mi', value: 160.934 },
  { label: '0.25 mi', value: 402.336 },
  { label: '0.5 mi', value: 804.672 },
  { label: '1 mi', value: 1609.34 },
  { label: '2 mi', value: 3218.69 },
  { label: '3 mi', value: 4828.03 },
];

const TimeSelection: React.FC<TimeSelectionProps> = ({ onConfirm, defaultDistanceKm }) => {
  const [hours, setHours] = useState('0');
  const [minutes, setMinutes] = useState('00');
  const [seconds, setSeconds] = useState('00');
  const [units, setUnits] = useState<UnitSystem>('metric');
  const [sectorSize, setSectorSize] = useState<number>(500);
  const [raceDate, setRaceDate] = useState<string>('');
  
  // Aid Stations
  const [aidStations, setAidStations] = useState<AidStation[]>([]);
  const [newAidDist, setNewAidDist] = useState<string>('');
  const [newAidPenalty, setNewAidPenalty] = useState<string>('30'); // default 30s

  const handleAddAidStation = () => {
      const dist = parseFloat(newAidDist);
      const penalty = parseInt(newAidPenalty);
      
      if (isNaN(dist) || isNaN(penalty)) return;

      const maxDist = units === 'metric' ? defaultDistanceKm : defaultDistanceKm * 0.621371;
      if (dist > maxDist || dist < 0) return;

      const newStation: AidStation = {
          id: Date.now().toString(),
          distanceFromStart: dist,
          penaltySeconds: penalty
      };
      
      setAidStations([...aidStations, newStation].sort((a,b) => a.distanceFromStart - b.distanceFromStart));
      setNewAidDist('');
  };

  const removeAidStation = (id: string) => {
      setAidStations(aidStations.filter(s => s.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const h = parseInt(hours) || 0;
    const m = parseInt(minutes) || 0;
    const s = parseInt(seconds) || 0;
    
    if (h === 0 && m === 0 && s === 0) return;

    const totalSec = (h * 3600) + (m * 60) + s;
    onConfirm(totalSec, sectorSize, units, raceDate, aidStations);
  };

  const displayDist = units === 'metric' ? defaultDistanceKm : defaultDistanceKm * 0.621371;
  const unitLabel = getUnitLabel('dist', units);

  return (
    <div className="max-w-4xl mx-auto mt-12 p-8 bg-slate-800 rounded-2xl border border-slate-700 shadow-xl animate-fade-in">
      <div className="flex flex-col items-center mb-8">
        <div className="p-3 bg-blue-600/20 rounded-full mb-4">
          <Settings2 className="w-8 h-8 text-blue-400" />
        </div>
        <h2 className="text-3xl font-bold text-white">Race Configuration</h2>
        <p className="text-slate-400 mt-2">
          Setup plan for {displayDist.toFixed(2)} {unitLabel}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* Top Row: Unit, Date */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Unit Toggle */}
            <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700/50 flex flex-col justify-between">
                <label className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Measurement Units</label>
                <div className="flex bg-slate-800 p-1 rounded-lg">
                    <button
                        type="button"
                        onClick={() => { setUnits('metric'); setSectorSize(500); }}
                        className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${units === 'metric' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                        Metric (km/m)
                    </button>
                    <button
                        type="button"
                        onClick={() => { setUnits('imperial'); setSectorSize(1609.34); }}
                        className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${units === 'imperial' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                        Imperial (mi/ft)
                    </button>
                </div>
            </div>

            {/* Date Selection */}
            <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700/50 flex flex-col justify-between">
                <div className="flex items-center gap-2 mb-4">
                    <Calendar className="w-4 h-4 text-blue-400" />
                    <label className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Race Date</label>
                </div>
                <input 
                    type="date" 
                    value={raceDate}
                    onChange={(e) => setRaceDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <p className="text-xs text-slate-500 mt-2">Used for weather forecast conditions.</p>
            </div>
        </div>

        {/* Time Input */}
        <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700/50">
          <div className="flex items-center gap-2 mb-4">
            <Timer className="w-4 h-4 text-blue-400" />
            <label className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Target Time</label>
          </div>
          
          <div className="flex items-end justify-center gap-2">
            <div className="flex flex-col items-center">
              <label className="text-xs text-slate-500 mb-1">Hours</label>
              <input 
                type="number" 
                min="0" max="99" 
                value={hours} 
                onChange={(e) => setHours(e.target.value)}
                className="w-24 h-20 bg-slate-800 border border-slate-600 rounded-lg text-4xl font-mono text-center text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <span className="text-4xl text-slate-600 pb-4">:</span>
            <div className="flex flex-col items-center">
              <label className="text-xs text-slate-500 mb-1">Mins</label>
              <input 
                type="number" 
                min="0" max="59" 
                value={minutes} 
                onChange={(e) => setMinutes(e.target.value)}
                className="w-24 h-20 bg-slate-800 border border-slate-600 rounded-lg text-4xl font-mono text-center text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <span className="text-4xl text-slate-600 pb-4">:</span>
            <div className="flex flex-col items-center">
              <label className="text-xs text-slate-500 mb-1">Secs</label>
              <input 
                type="number" 
                min="0" max="59" 
                value={seconds} 
                onChange={(e) => setSeconds(e.target.value)}
                className="w-24 h-20 bg-slate-800 border border-slate-600 rounded-lg text-4xl font-mono text-center text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Aid Stations */}
        <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700/50">
             <div className="flex items-center gap-2 mb-4">
                <Droplets className="w-4 h-4 text-blue-400" />
                <label className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Aid Stations & Stops</label>
            </div>
            
            <div className="flex gap-4 mb-4">
                <div className="flex-1">
                    <label className="text-xs text-slate-500 mb-1">Distance ({unitLabel})</label>
                    <input 
                        type="number" 
                        step="0.1"
                        value={newAidDist}
                        onChange={(e) => setNewAidDist(e.target.value)}
                        placeholder="e.g. 10.5"
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 text-white"
                    />
                </div>
                <div className="flex-1">
                    <label className="text-xs text-slate-500 mb-1">Stop Time (sec)</label>
                    <input 
                        type="number" 
                        value={newAidPenalty}
                        onChange={(e) => setNewAidPenalty(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 text-white"
                    />
                </div>
                <div className="flex items-end">
                    <button 
                        type="button" 
                        onClick={handleAddAidStation}
                        className="bg-blue-600 hover:bg-blue-500 p-2 rounded-lg text-white transition-colors"
                    >
                        <PlusCircle className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {aidStations.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-4">
                    {aidStations.map(station => (
                        <div key={station.id} className="bg-slate-800 px-3 py-2 rounded border border-slate-600 flex justify-between items-center">
                            <div>
                                <span className="font-bold text-white mr-1">{station.distanceFromStart} {unitLabel}</span>
                                <span className="text-slate-400 text-xs">({station.penaltySeconds}s)</span>
                            </div>
                            <button type="button" onClick={() => removeAidStation(station.id)} className="text-slate-500 hover:text-red-400">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* Sector Size Input */}
        <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700/50">
          <div className="flex items-center gap-2 mb-4">
            <Map className="w-4 h-4 text-orange-400" />
            <label className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Sector Split Size</label>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {(units === 'metric' ? SECTOR_OPTIONS_METRIC : SECTOR_OPTIONS_IMPERIAL).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSectorSize(opt.value)}
                className={`py-3 px-2 rounded-lg text-sm font-bold transition-all ${
                  Math.abs(sectorSize - opt.value) < 1 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 ring-2 ring-blue-400 ring-offset-2 ring-offset-slate-900' 
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <button 
          type="submit"
          className="w-full flex items-center justify-center py-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-lg font-bold rounded-xl transition-all transform hover:scale-[1.01] shadow-xl shadow-blue-900/20"
        >
          <Play className="w-6 h-6 mr-2" fill="currentColor" />
          Generate Race Plan
        </button>
      </form>
    </div>
  );
};

export default TimeSelection;