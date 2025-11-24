
import React, { useState, useCallback } from 'react';
import { Activity, Mountain, TrendingUp, RefreshCw, AlertCircle, Map as MapIcon, Zap, CloudSun, Layers } from 'lucide-react';
import FileUpload from './components/FileUpload';
import TimeSelection from './components/TimeSelection';
import SectorList from './components/SectorList';
import { ElevationProfile, CourseDifficultyRibbon, PaceStrategyChart, GradientDistributionChart, PaceVarianceChart, TimeBankChart } from './components/Charts';
import MapVisualizer from './components/MapVisualizer';
import { parseGPXRaw, generateSectors, calculateRacePlan, formatDuration } from './utils/geoUtils';
import { formatDistance, formatElevation, formatPace } from './utils/unitUtils';
import { fetchRaceWeather, getWeatherDescription, getWeatherIcon } from './services/weatherService';
import { AnalysisResult, AnalysisStatus, GPXPoint, TrackStats, UnitSystem, AidStation, MapMetric } from './types';

const App: React.FC = () => {
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  
  // Store raw parsed data separately so we can re-generate sectors if needed
  const [rawPoints, setRawPoints] = useState<GPXPoint[]>([]);
  const [stats, setStats] = useState<TrackStats | null>(null);

  const [data, setData] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Visualization State
  const [hoveredDist, setHoveredDist] = useState<number | null>(null);
  const [mapMetric, setMapMetric] = useState<MapMetric>('gradient');

  // Step 1: Handle File
  const handleFileSelect = useCallback(async (file: File) => {
    setStatus(AnalysisStatus.PARSING);
    setErrorMsg('');
    
    try {
      const text = await file.text();
      // Only parse raw data first
      const { points, stats } = await parseGPXRaw(text);
      setRawPoints(points);
      setStats(stats);
      
      // Temporary state to show we have file but need config
      setData({ rawPoints: points, stats, sectors: [], units: 'metric' }); 
      
      setStatus(AnalysisStatus.TIME_SELECTION);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to parse GPX file. Please ensure it is a valid format.");
      setStatus(AnalysisStatus.ERROR);
    }
  }, []);

  // Step 2: Handle Configuration (Time & Size) & Calculation
  const handleConfigConfirm = async (
    totalSeconds: number, 
    sectorSize: number, 
    units: UnitSystem,
    date: string,
    aidStations: AidStation[]
  ) => {
    if (!rawPoints.length || !stats) return;

    setStatus(AnalysisStatus.ANALYZING_AI); // Keep status name for loading state, though AI is gone
    
    // 1. Generate Sectors based on selected size
    const sectors = generateSectors(rawPoints, sectorSize);

    // 2. Calculate Plan
    const plannedSectors = calculateRacePlan(sectors, totalSeconds, aidStations, units);
    
    // 3. Fetch Weather if date provided
    let weatherData = undefined;
    if (date && rawPoints.length > 0) {
        // Use start point
        weatherData = await fetchRaceWeather(rawPoints[0].lat, rawPoints[0].lon, date);
    }

    const finalData: AnalysisResult = { 
        rawPoints, 
        stats, 
        sectors, 
        plan: plannedSectors, 
        targetTimeSeconds: totalSeconds,
        units,
        weather: weatherData,
        aidStations
    };
    
    setData(finalData);
    setStatus(AnalysisStatus.COMPLETE);
  };

  const reset = () => {
    setData(null);
    setRawPoints([]);
    setStats(null);
    setStatus(AnalysisStatus.IDLE);
    setErrorMsg('');
  };

  const getAvgPaceSeconds = () => {
    if (!data || !data.targetTimeSeconds) return 0;
    return data.targetTimeSeconds / (data.stats.totalDistance / 1000);
  };

  return (
    <div className="min-h-screen pb-20 bg-[#0f172a] text-slate-100 font-sans">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50 backdrop-blur-md bg-opacity-90">
        <div className="w-full px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-2 rounded-lg shadow-lg shadow-blue-900/50">
              <Activity className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              Race Planner Pro
            </h1>
          </div>
          {data && status !== AnalysisStatus.TIME_SELECTION && (
            <button 
              onClick={reset}
              className="flex items-center space-x-2 text-sm text-slate-400 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-full border border-slate-700 hover:border-slate-500"
            >
              <RefreshCw className="w-3 h-3" />
              <span>New Race</span>
            </button>
          )}
        </div>
      </header>

      <main className="w-full px-6 mt-8 animate-fade-in">
        
        {/* Error State */}
        {status === AnalysisStatus.ERROR && (
          <div className="mb-6 p-4 max-w-4xl mx-auto bg-red-900/20 border border-red-800 rounded-lg flex items-center space-x-3 text-red-200">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{errorMsg}</p>
          </div>
        )}

        {/* 1. Upload State */}
        {!data && (
          <div className="flex flex-col items-center justify-center min-h-[80vh]">
            <div className="text-center mb-10 px-4">
              <h2 className="text-5xl md:text-7xl font-extrabold text-white mb-6 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                Plan Your Race.
              </h2>
              <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
                Advanced terrain analysis and pacing strategies for endurance athletes.
              </p>
            </div>
            <FileUpload 
              onFileSelect={handleFileSelect} 
              isProcessing={status === AnalysisStatus.PARSING} 
            />
          </div>
        )}

        {/* 2. Config State */}
        {data && status === AnalysisStatus.TIME_SELECTION && stats && (
          <TimeSelection 
            defaultDistanceKm={stats.totalDistance / 1000}
            onConfirm={handleConfigConfirm}
          />
        )}

        {/* 3. Dashboard State */}
        {data && data.plan && (status === AnalysisStatus.COMPLETE || status === AnalysisStatus.ANALYZING_AI) && (
          <div className="space-y-8">
            
            {/* --- SECTION: HEADLINE STATS --- */}
            <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-slate-800/60 border border-slate-700/60 p-6 rounded-2xl relative overflow-hidden group hover:border-slate-600 transition-colors">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                   <MapIcon className="w-16 h-16 text-blue-400" />
                </div>
                <div className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-2">Total Distance</div>
                <div className="text-3xl lg:text-4xl font-black text-white tracking-tight">
                  {formatDistance(data.stats.totalDistance, data.units)} <span className="text-lg text-slate-500 font-medium">{data.units === 'metric' ? 'km' : 'mi'}</span>
                </div>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/60 p-6 rounded-2xl">
                <div className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-2">Target Time</div>
                <div className="text-3xl lg:text-4xl font-black text-white tracking-tight">
                  {formatDuration(data.targetTimeSeconds || 0)}
                </div>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/60 p-6 rounded-2xl">
                <div className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-2">Total Gain</div>
                <div className="text-3xl lg:text-4xl font-black text-orange-400 tracking-tight">
                  +{formatElevation(data.stats.totalElevationGain, data.units)} <span className="text-lg text-orange-500/60 font-medium">{data.units === 'metric' ? 'm' : 'ft'}</span>
                </div>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/60 p-6 rounded-2xl">
                <div className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-2">Average Pace</div>
                <div className="text-3xl lg:text-4xl font-black text-blue-400 tracking-tight">
                   {formatPace(getAvgPaceSeconds(), data.units)}
                </div>
              </div>
              
              {/* Weather Card */}
              {data.weather ? (
                  <div className="bg-gradient-to-br from-indigo-900/50 to-slate-800 border border-indigo-500/30 p-6 rounded-2xl relative overflow-hidden">
                     <div className="text-indigo-300 font-bold text-xs uppercase tracking-wider mb-2 flex items-center gap-2">
                        <CloudSun className="w-4 h-4"/> Conditions
                     </div>
                     <div className="flex items-center gap-4">
                        <span className="text-4xl">{getWeatherIcon(data.weather.conditionCode)}</span>
                        <div>
                            <div className="text-2xl font-bold text-white">{data.weather.temperatureMax}°C</div>
                            <div className="text-xs text-indigo-200">{getWeatherDescription(data.weather.conditionCode)}</div>
                        </div>
                     </div>
                     <div className="mt-2 text-xs text-slate-400 flex justify-between">
                        <span>💨 {data.weather.windSpeed} km/h</span>
                        <span>💧 {data.weather.precipitationProb}%</span>
                     </div>
                  </div>
              ) : (
                 <div className="bg-slate-800/60 border border-slate-700/60 p-6 rounded-2xl flex items-center justify-center text-slate-500 text-sm italic">
                    No weather data
                 </div>
              )}

            </section>

            {/* --- SECTION: TERRAIN & STRATEGY GRID --- */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              
              {/* Left Column: Elevation + Ribbon */}
              <div className="xl:col-span-2 bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl shadow-xl flex flex-col">
                 <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <Mountain className="w-5 h-5 text-slate-400" />
                        <h2 className="text-lg font-bold text-white uppercase tracking-wider">Terrain Profile</h2>
                    </div>
                  </div>
                <div className="flex-1 w-full mb-4 min-h-[300px]">
                  <ElevationProfile 
                    rawData={data.rawPoints} 
                    units={data.units} 
                    onHover={setHoveredDist}
                    hoveredDist={hoveredDist}
                  />
                </div>
                <div className="h-16 w-full">
                  <CourseDifficultyRibbon sectors={data.plan} units={data.units} />
                </div>
              </div>

               {/* Right Column: Map Visualizer (Tall) */}
               <div className="xl:col-span-1 bg-slate-800/50 border border-slate-700/50 rounded-2xl shadow-xl overflow-hidden relative min-h-[400px]">
                   <div className="absolute top-4 right-4 z-[400] bg-slate-900/90 border border-slate-700 rounded-lg p-1 shadow-lg">
                      <div className="flex items-center space-x-2 px-2 py-1 border-b border-slate-800 mb-1">
                          <Layers className="w-3 h-3 text-slate-400" />
                          <span className="text-xs font-bold text-slate-300 uppercase">Overlay</span>
                      </div>
                      <select 
                        className="bg-slate-900 text-xs text-white p-1 outline-none w-full cursor-pointer rounded border-none focus:ring-0"
                        value={mapMetric}
                        onChange={(e) => setMapMetric(e.target.value as MapMetric)}
                      >
                          <option className="bg-slate-900 text-white" value="gradient">Gradient</option>
                          <option className="bg-slate-900 text-white" value="pace">Target Pace</option>
                          <option className="bg-slate-900 text-white" value="bank">Time Bank</option>
                          <option className="bg-slate-900 text-white" value="fatigue">Fatigue (Physio)</option>
                      </select>
                   </div>
                   <MapVisualizer 
                      sectors={data.plan} 
                      activeMetric={mapMetric} 
                      avgPaceSeconds={getAvgPaceSeconds()}
                      units={data.units}
                      hoveredDist={hoveredDist}
                      onHover={setHoveredDist}
                   />
               </div>

              {/* 2x2 Grid for Strategy Charts */}
              <div className="xl:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* Chart 1 */}
                 <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl h-[400px] flex flex-col">
                    <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Zap className="w-4 h-4" /> Pace Strategy
                    </h4>
                    <div className="flex-1 min-h-0">
                      <PaceStrategyChart sectors={data.plan} units={data.units} />
                    </div>
                 </div>

                 {/* Chart 2 */}
                 <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl h-[400px] flex flex-col">
                    <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" /> Gradient Distribution
                    </h4>
                    <div className="flex-1 min-h-0">
                      {/* We pass rawData now to allow dynamic sampling */}
                      <GradientDistributionChart rawData={data.rawPoints} units={data.units} />
                    </div>
                 </div>

                 {/* Chart 3 */}
                 <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl h-[400px] flex flex-col">
                    <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                       <Activity className="w-4 h-4" /> Pace Variance
                    </h4>
                    <div className="flex-1 min-h-0">
                       <PaceVarianceChart sectors={data.plan} avgPaceSeconds={getAvgPaceSeconds()} units={data.units} />
                    </div>
                 </div>

                 {/* Chart 4 */}
                 <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl h-[400px] flex flex-col">
                    <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                       <RefreshCw className="w-4 h-4" /> Time Bank
                    </h4>
                    <div className="flex-1 min-h-0">
                       <TimeBankChart sectors={data.plan} avgPaceSeconds={getAvgPaceSeconds()} units={data.units} />
                    </div>
                 </div>

              </div>
            </div>

            {/* --- SECTION: DATA TABLE --- */}
            <section className="pb-20">
              <div className="flex items-center justify-between mb-6 pt-8 border-t border-slate-800">
                 <div className="flex items-center gap-2">
                  <MapIcon className="w-6 h-6 text-slate-400" />
                  <h2 className="text-2xl font-bold text-white">Sector Breakdown</h2>
                 </div>
                 <div className="hidden sm:flex gap-6 text-sm font-medium">
                    <span className="flex items-center text-orange-400"><div className="w-2 h-2 bg-orange-400 rounded-full mr-2"></div> Uphill</span>
                    <span className="flex items-center text-yellow-400"><div className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></div> Flat/Mild</span>
                    <span className="flex items-center text-emerald-400"><div className="w-2 h-2 bg-emerald-400 rounded-full mr-2"></div> Downhill</span>
                 </div>
              </div>
              <SectorList sectors={data.plan} units={data.units} />
            </section>
            
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
