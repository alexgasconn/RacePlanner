import React, { ChangeEvent } from 'react';
import { UploadCloud } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, isProcessing }) => {
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-8">
      <div className="relative border-2 border-dashed border-slate-600 rounded-2xl p-12 text-center hover:border-blue-500 transition-colors bg-slate-800/50">
        <input
          type="file"
          accept=".gpx"
          onChange={handleFileChange}
          disabled={isProcessing}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="p-4 bg-slate-700/50 rounded-full">
            <UploadCloud className="w-10 h-10 text-blue-400" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white">
              {isProcessing ? 'Processing GPX...' : 'Upload GPX File'}
            </h3>
            <p className="text-slate-400 mt-2 text-sm">
              Click or drag and drop your track here to analyze 500m sectors.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;