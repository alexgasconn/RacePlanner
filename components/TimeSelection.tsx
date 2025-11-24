import React, { useState } from 'react';
import { Timer, Play } from 'lucide-react';

interface TimeSelectionProps {
  onConfirm: (totalSeconds: number) => void;
  defaultDistanceKm: number;
}

const TimeSelection: React.FC<TimeSelectionProps> = ({ onConfirm, defaultDistanceKm }) => {
  const [hours, setHours] = useState('0');
  const [minutes, setMinutes] = useState('00');
  const [seconds, setSeconds] = useState('00');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const h = parseInt(hours) || 0;
    const m = parseInt(minutes) || 0;
    const s = parseInt(seconds) || 0;
    
    if (h === 0 && m === 0 && s === 0) return;

    const totalSec = (h * 3600) + (m * 60) + s;
    onConfirm(totalSec);
  };

  return (
    <div className="max-w-md mx-auto mt-12 p-8 bg-slate-800 rounded-2xl border border-slate-700 shadow-xl animate-fade-in">
      <div className="flex flex-col items-center mb-6">
        <div className="p-3 bg-blue-600/20 rounded-full mb-4">
          <Timer className="w-8 h-8 text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold text-white">Set Your Target Time</h2>
        <p className="text-slate-400 text-sm mt-1">
          For {defaultDistanceKm.toFixed(2)} km course
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="flex items-end justify-center gap-2 mb-8">
          <div className="flex flex-col items-center">
             <label className="text-xs text-slate-500 mb-1">Hours</label>
             <input 
               type="number" 
               min="0" max="99" 
               value={hours} 
               onChange={(e) => setHours(e.target.value)}
               className="w-20 h-16 bg-slate-900 border border-slate-600 rounded-lg text-3xl font-mono text-center text-white focus:ring-2 focus:ring-blue-500 outline-none"
             />
          </div>
          <span className="text-4xl text-slate-600 pb-2">:</span>
          <div className="flex flex-col items-center">
             <label className="text-xs text-slate-500 mb-1">Mins</label>
             <input 
               type="number" 
               min="0" max="59" 
               value={minutes} 
               onChange={(e) => setMinutes(e.target.value)}
               className="w-20 h-16 bg-slate-900 border border-slate-600 rounded-lg text-3xl font-mono text-center text-white focus:ring-2 focus:ring-blue-500 outline-none"
             />
          </div>
          <span className="text-4xl text-slate-600 pb-2">:</span>
          <div className="flex flex-col items-center">
             <label className="text-xs text-slate-500 mb-1">Secs</label>
             <input 
               type="number" 
               min="0" max="59" 
               value={seconds} 
               onChange={(e) => setSeconds(e.target.value)}
               className="w-20 h-16 bg-slate-900 border border-slate-600 rounded-lg text-3xl font-mono text-center text-white focus:ring-2 focus:ring-blue-500 outline-none"
             />
          </div>
        </div>

        <button 
          type="submit"
          className="w-full flex items-center justify-center py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all transform hover:scale-[1.02] shadow-lg shadow-blue-900/20"
        >
          <Play className="w-5 h-5 mr-2" fill="currentColor" />
          Generate Race Plan
        </button>
      </form>
    </div>
  );
};

export default TimeSelection;