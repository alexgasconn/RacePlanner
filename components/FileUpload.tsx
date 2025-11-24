import React, { ChangeEvent, useState, useEffect } from 'react';
import { UploadCloud, FolderOpen, ChevronDown, CheckCircle2 } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
}

// NOTE: Since this is a client-side app, we cannot dynamically read the filesystem.
// This list acts as the manifest for files located in the/data/ folder.
const SAMPLE_ROUTES = [
  { name: 'Marathon Course (Road)', file: 'marathon.gpx' },
  { name: 'Mountain Trail 25k', file: 'trail.gpx' },
  { name: 'City Half Marathon', file: 'half.gpx' },
  { name: 'Technical Skyrace', file: 'skyrace.gpx' },
  { name: 'Ultra Distance 100k', file: 'ultra.gpx' },
  { name: 'Local 10k Loop', file: '10k.gpx' }
];

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, isProcessing }) => {
  const [selectedSample, setSelectedSample] = useState('');
  const [loadingSample, setLoadingSample] = useState(false);

  // --- NEW: auto-load first existing file from /data/ on mount ---
  useEffect(() => {
    if (isProcessing) return;
    let cancelled = false;

    (async () => {
      for (const route of SAMPLE_ROUTES) {
        const filename = route.file;
        const candidates = [
          `/data/${encodeURIComponent(filename)}`,
          `${window.location.origin}/data/${encodeURIComponent(filename)}`,
          `${process.env.PUBLIC_URL || ''}/data/${encodeURIComponent(filename)}`,
          `./data/${encodeURIComponent(filename)}`
        ];
        for (const url of candidates) {
          try {
            // use HEAD first to quickly check existence (some hosts may not allow HEAD)
            const headResp = await fetch(url, { method: 'HEAD' });
            if (!headResp.ok) {
              // try GET directly if HEAD not allowed or not ok
              const getResp = await fetch(url);
              if (!getResp.ok) continue;
              const blob = await getResp.blob();
              if (cancelled) return;
              const mime = blob.type || 'application/gpx+xml';
              const file = new File([blob], filename, { type: mime });
              setSelectedSample(filename);
              onFileSelect(file);
              return;
            } else {
              // HEAD ok -> fetch the blob
              const resp = await fetch(url);
              if (!resp.ok) continue;
              const blob = await resp.blob();
              if (cancelled) return;
              const mime = blob.type || 'application/gpx+xml';
              const file = new File([blob], filename, { type: mime });
              setSelectedSample(filename);
              onFileSelect(file);
              return;
            }
          } catch (err) {
            // try next candidate
            continue;
          }
        }
      }
    })();

    return () => { cancelled = true; };
  }, [onFileSelect, isProcessing]);
  // --- END NEW ---

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  const handleSampleLoad = async () => {
    if (!selectedSample) return;
    setLoadingSample(true);
    try {
      // existing candidate-fetch logic (kept for manual loads)
      const candidates = [
        `/data/${encodeURIComponent(selectedSample)}`,
        `${window.location.origin}/data/${encodeURIComponent(selectedSample)}`,
        `${process.env.PUBLIC_URL || ''}/data/${encodeURIComponent(selectedSample)}`,
        `./data/${encodeURIComponent(selectedSample)}`
      ];

      let blob = null;
      for (const url of candidates) {
        try {
          const response = await fetch(url);
          if (!response.ok) continue;
          blob = await response.blob();
          break;
        } catch (err) {
          continue;
        }
      }

      if (!blob) throw new Error('File not found in any candidate path');

      const mime = blob.type || 'application/gpx+xml';
      const file = new File([blob], selectedSample, { type: mime });
      onFileSelect(file);
    } catch (e) {
      alert(`Could not load ${selectedSample}. Ensure the file exists in the /data/ folder and is served by your dev server or production hosting.`);
      console.error(e);
    } finally {
      setLoadingSample(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-8 animate-fade-in">
      {/* Drag & Drop Area */}
      <div className="relative border-2 border-dashed border-slate-600 rounded-2xl p-12 text-center hover:border-blue-500 transition-colors bg-slate-800/50 mb-10 group">
        <input
          type="file"
          accept=".gpx"
          onChange={handleFileChange}
          disabled={isProcessing}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
        />
        <div className="flex flex-col items-center justify-center space-y-4 group-hover:scale-105 transition-transform duration-300">
          <div className="p-5 bg-slate-700/50 rounded-full group-hover:bg-blue-600/20 transition-colors">
            <UploadCloud className="w-12 h-12 text-blue-400" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white">
              {isProcessing ? 'Processing GPX...' : 'Upload GPX File'}
            </h3>
            <p className="text-slate-400 mt-2 text-sm">
              Click to browse or drag and drop your track here.
            </p>
          </div>
        </div>
      </div>

      {/* Data Folder Loader */}
      <div className="border-t border-slate-700 pt-8">
        <h4 className="text-slate-400 font-bold uppercase text-xs tracking-wider mb-4 flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-orange-400" /> Load from Project Data Folder
        </h4>

        <div className="bg-slate-800/80 p-6 rounded-2xl border border-slate-700 shadow-xl">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <select
                value={selectedSample}
                onChange={(e) => setSelectedSample(e.target.value)}
                className="w-full appearance-none bg-slate-900 border border-slate-600 rounded-xl px-4 py-3.5 pr-10 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer hover:bg-slate-900/80 transition-colors font-medium"
              >
                <option value="" disabled>Select a route...</option>
                {SAMPLE_ROUTES.map(route => (
                  <option key={route.file} value={route.file}>
                    {route.name}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-slate-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>

            <button
              onClick={handleSampleLoad}
              disabled={!selectedSample || isProcessing || loadingSample}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3.5 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 min-w-[140px]"
            >
              {loadingSample ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Load</span>
                  <CheckCircle2 className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
          <p className="text-[11px] text-slate-500 mt-3 text-center">
            Select a file to load directly from the <code>data/</code> directory.
          </p>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;
