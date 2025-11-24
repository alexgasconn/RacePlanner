import React, { useState, useCallback } from 'react';
import { Activity, Mountain, TrendingUp, RefreshCw, AlertCircle, Timer, Zap, BarChart3, ArrowUpDown, History, Map } from 'lucide-react';
import FileUpload from './components/FileUpload';
import TimeSelection from './components/TimeSelection';
import SectorList from './components/SectorList';
import { ElevationProfile, CourseDifficultyRibbon, PaceStrategyChart, GradientDistributionChart, PaceVarianceChart, TimeBankChart } from './components/Charts';
import { parseGPX, calculateRacePlan, formatDuration, formatPace } from './utils/geoUtils';
import { analyzeRouteWithGemini } from './services/geminiService';
import { AnalysisResult, AnalysisStatus } from './types';
import ReactMarkdown from 'react-markdown';

const App: React.FC = () => {
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Step 1: Handle File
  const handleFileSelect = useCallback(async (file: File) => {
    setStatus(AnalysisStatus.PARSING);
    setErrorMsg('');
    setAiAnalysis('');
    
    try {
      const text = await file.text();
      const result = await parseGPX(text);
      setData(result);
      setStatus(AnalysisStatus.TIME_SELECTION); // Move to time input
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to parse GPX file. Please ensure it is a valid format.");
      setStatus(AnalysisStatus.ERROR);
    }
  }, []);

  // Step 2: Handle Time Input & Calculation
  const handleTimeConfirm = async (totalSeconds: number) => {
    if (!data) return;

    setStatus(AnalysisStatus.ANALYZING_AI);
    
    // Calculate Plan
    const plannedSectors = calculateRacePlan(data.sectors, totalSeconds);
    const updatedData = { ...data, plan: plannedSectors, targetTimeSeconds: totalSeconds };
    setData(updatedData);

    // Trigger AI
    try {
      const analysis = await analyzeRouteWithGemini(data.stats, plannedSectors, totalSeconds);
      setAiAnalysis(analysis);
      setStatus(AnalysisStatus.COMPLETE);
    } catch (e) {
      setAiAnalysis("Could not fetch AI advice, but here is your mathematical plan.");
      setStatus(AnalysisStatus.COMPLETE);
    }
  };

  const reset = () => {
    setData(null);
    setStatus(AnalysisStatus.IDLE);
    setAiAnalysis('');
    setErrorMsg('');
  };

  const getAvgPaceSeconds = () => {
    if (!data || !data.targetTimeSeconds) return 0;
    return data.targetTimeSeconds / (data.stats.totalDistance / 1000);
  };

  return (
    <div className="min-h-screen pb-20 bg-[#0f172a]">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50 backdrop-blur-md bg-opacity-80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-2 rounded-lg shadow-lg shadow-blue-900/50">
              <Activity className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              Elevate <span className="text-slate-500 font-normal border-l border-slate-700 pl-3 ml-3">Race Planner</span>
            </h1>
          </div>
          {data && status !== AnalysisStatus.TIME_SELECTION && (
            <button 
              onClick={reset}
              className="flex items-center space-x-2 text-sm text-slate-400 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-full"
            >
              <RefreshCw className="w-3 h-3" />
              <span>New Race</span>
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 animate-fade-in">
        
        {/* Error State */}
        {status === AnalysisStatus.ERROR && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-lg flex items-center space-x-3 text-red-200">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{errorMsg}</p>
          </div>
        )}

        {/* 1. Upload State */}
        {!data && (
          <div className="flex flex-col items-center justify-center min-h-[70vh]">
            <div className="text-center mb-10">
              <h2 className="text-4xl font-extrabold text-white mb-6 tracking-tight">Plan Your Perfect Race.</h2>
              <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
                Precision pacing strategies for trail and road running. 
                <br/>Upload GPX. Set Goal. Dominate.
              </p>
            </div>
            <FileUpload 
              onFileSelect={handleFileSelect} 
              isProcessing={status === AnalysisStatus.PARSING} 
            />
          </div>
        )}

        {/* 2. Time Selection State */}
        {data && status === AnalysisStatus.TIME_SELECTION && (
          <TimeSelection 
            defaultDistanceKm={data.stats.totalDistance / 1000}
            onConfirm={handleTimeConfirm}
          />
        )}

        {/* 3. Dashboard State */}
        {data && data.plan && (status === AnalysisStatus.COMPLETE || status === AnalysisStatus.ANALYZING_AI) && (
          <div className="space-y-12">
            
            {/* --- SECTION: HEADLINE STATS --- */}
            <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                   <Map className="w-16 h-16 text-blue-400" />
                </div>
                <div className="text-slate-400 font-medium text-sm mb-1">Total Distance</div>
                <div className="text-3xl font-bold text-white tracking-tight">
                  {(data.stats.totalDistance / 1000).toFixed(2)} <span className="text-lg text-slate-500 font-normal">km</span>
                </div>
              </div>

              <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl">
                <div className="text-slate-400 font-medium text-sm mb-1">Target Time</div>
                <div className="text-3xl font-bold text-white tracking-tight">
                  {formatDuration(data.targetTimeSeconds || 0)}
                </div>
              </div>

              <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl">
                <div className="text-slate-400 font-medium text-sm mb-1">Total Gain</div>
                <div className="text-3xl font-bold text-orange-400 tracking-tight">
                  +{Math.round(data.stats.totalElevationGain)} <span className="text-lg text-orange-500/60 font-normal">m</span>
                </div>
              </div>

              <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl">
                <div className="text-slate-400 font-medium text-sm mb-1">Average Pace</div>
                <div className="text-3xl font-bold text-blue-400 tracking-tight">
                   {formatPace(getAvgPaceSeconds())}
                </div>
              </div>
            </section>

            {/* --- SECTION: AI COACH --- */}
            <section className="bg-gradient-to-r from-slate-800 to-indigo-950/40 border border-indigo-500/20 rounded-2xl p-8 relative overflow-hidden shadow-2xl">
               <div className="absolute top-0 right-0 p-8 opacity-5">
                 <Activity className="w-48 h-48 text-indigo-400" />
               </div>
               <div className="relative z-10">
                 <h3 className="text-xl font-bold text-indigo-100 mb-6 flex items-center">
                   <span className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center mr-3 text-lg">🤖</span> 
                   Race Coach Strategy
                 </h3>
                 {status === AnalysisStatus.ANALYZING_AI ? (
                   <div className="flex items-center space-x-3 text-indigo-300 animate-pulse py-8">
                     <div className="w-3 h-3 bg-indigo-400 rounded-full animate-bounce"></div>
                     <div className="w-3 h-3 bg-indigo-400 rounded-full animate-bounce delay-75"></div>
                     <div className="w-3 h-3 bg-indigo-400 rounded-full animate-bounce delay-150"></div>
                     <span className="font-mono text-sm">Analyzing terrain topology...</span>
                   </div>
                 ) : (
                   <div className="prose prose-invert prose-lg max-w-none text-slate-300 leading-relaxed">
                     <ReactMarkdown>{aiAnalysis}</ReactMarkdown>
                   </div>
                 )}
               </div>
            </section>

            {/* --- SECTION: TERRAIN ANALYSIS --- */}
            <section>
              <div className="flex items-center gap-2 mb-6">
                <Mountain className="w-6 h-6 text-slate-400" />
                <h2 className="text-2xl font-bold text-white">Terrain Profile</h2>
              </div>
              
              <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl shadow-xl">
                <div className="h-80 w-full mb-4">
                  <ElevationProfile rawData={data.rawPoints} />
                </div>
                <div className="h-16 w-full">
                  <CourseDifficultyRibbon sectors={data.plan} />
                </div>
                <div className="flex justify-between text-xs text-slate-500 mt-2 px-1">
                   <span>Start</span>
                   <span className="flex items-center gap-2">
                     Gradient Intensity: 
                     <span className="w-2 h-2 rounded-full bg-green-500"></span> Easy
                     <span className="w-2 h-2 rounded-full bg-yellow-500"></span> Mod
                     <span className="w-2 h-2 rounded-full bg-red-500"></span> Hard
                   </span>
                   <span>Finish</span>
                </div>
              </div>
              
              <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl">
                   <h4 className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-4">Gradient Distribution</h4>
                   <GradientDistributionChart sectors={data.plan} />
                </div>
                 <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl">
                   <h4 className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-4">Crux Sectors (Hardest 4)</h4>
                   <div className="grid grid-cols-2 gap-3 h-[256px]">
                        {data.plan.sort((a,b) => b.elevationGain - a.elevationGain).slice(0, 4).map((s, idx) => (
                        <div key={s.id} className="flex flex-col p-4 bg-slate-700/30 rounded-lg border border-slate-700/50 hover:bg-slate-700/50 transition-colors">
                          <div className="flex justify-between items-start mb-1">
                             <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider bg-orange-400/10 px-1.5 py-0.5 rounded">#{idx + 1}</span>
                             <span className="text-slate-400 text-xs font-mono">Km {(s.startDist/1000).toFixed(1)}</span>
                          </div>
                          <div className="text-white font-bold mb-auto">Sector {s.id}</div>
                          <div className="mt-2">
                             <div className="text-2xl font-bold text-white mb-[-4px]">+{Math.round(s.elevationGain)}m</div>
                             <div className="text-xs text-slate-500">in 500m</div>
                          </div>
                        </div>
                      ))}
                   </div>
                </div>
              </div>
            </section>

            {/* --- SECTION: STRATEGY --- */}
            <section>
              <div className="flex items-center gap-2 mb-6">
                <Zap className="w-6 h-6 text-slate-400" />
                <h2 className="text-2xl font-bold text-white">Pacing Strategy</h2>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 <div className="lg:col-span-2 bg-slate-800 border border-slate-700 p-6 rounded-2xl shadow-lg">
                    <h4 className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-4">Pace vs Gradient</h4>
                    <PaceStrategyChart sectors={data.plan} />
                 </div>
                 <div className="lg:col-span-1 flex flex-col gap-6">
                    <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl flex-1">
                       <h4 className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-4">Time Bank</h4>
                       <TimeBankChart sectors={data.plan} avgPaceSeconds={getAvgPaceSeconds()} />
                       <p className="text-xs text-slate-500 mt-2">Positive = Ahead of avg pace (Banked time)</p>
                    </div>
                    <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl flex-1">
                       <h4 className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-4">Pace Variance</h4>
                       <PaceVarianceChart sectors={data.plan} avgPaceSeconds={getAvgPaceSeconds()} />
                    </div>
                 </div>
              </div>
            </section>

            {/* --- SECTION: DATA TABLE --- */}
            <section className="pb-20">
              <div className="flex items-center justify-between mb-6">
                 <div className="flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-slate-400" />
                  <h2 className="text-2xl font-bold text-white">Sector Breakdown</h2>
                 </div>
                 <div className="hidden sm:flex gap-6 text-sm">
                    <span className="flex items-center text-orange-400"><div className="w-2 h-2 bg-orange-400 rounded-full mr-2"></div> Uphill</span>
                    <span className="flex items-center text-yellow-400"><div className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></div> Flat/Mild</span>
                    <span className="flex items-center text-emerald-400"><div className="w-2 h-2 bg-emerald-400 rounded-full mr-2"></div> Downhill</span>
                 </div>
              </div>
              <SectorList sectors={data.plan} />
            </section>
            
          </div>
        )}
      </main>
    </div>
  );
};

export default App;