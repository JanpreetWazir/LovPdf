import React, { useCallback, useState } from 'react';

interface MultiFileUploadProps {
  onFilesChange: (files: File[]) => void;
  accept: string; // e.g., '.pdf'
}

const MultiFileUpload: React.FC<MultiFileUploadProps> = ({ onFilesChange, accept }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleDrag = useCallback((e: React.DragEvent<HTMLDivElement | HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const processFiles = (fileList: FileList | null) => {
    if (fileList && fileList.length > 0) {
      const newFilesArray = Array.from(fileList);
      const updatedFiles = [...selectedFiles, ...newFilesArray.filter(f => !selectedFiles.find(sf => sf.name === f.name && sf.size === f.size))]; // Avoid duplicates
      setSelectedFiles(updatedFiles);
      onFilesChange(updatedFiles);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    processFiles(e.dataTransfer.files);
  }, [onFilesChange, selectedFiles]); // Added selectedFiles to dep array for processFiles

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    processFiles(e.target.files);
  };

  const clearFiles = () => {
    setSelectedFiles([]);
    onFilesChange([]);
    const fileInput = document.getElementById('multi-file-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = "";
  };

  return (
    <div className="space-y-4">
      <div 
        className={`p-8 border-2 border-dashed rounded-xl transition-all duration-200
                    ${dragActive ? 'border-red-500 bg-red-50 ring-2 ring-red-300' : 'border-gray-300 hover:border-gray-400 bg-gray-50'}`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="multi-file-upload"
          accept={accept}
          onChange={handleChange}
          className="hidden"
          multiple
        />
        <label
          htmlFor="multi-file-upload"
          className="flex flex-col items-center justify-center cursor-pointer text-gray-600 space-y-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className={`w-16 h-16 ${dragActive ? 'text-red-600 animate-pulse' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className={`text-xl font-semibold ${dragActive ? 'text-red-700' : 'text-gray-700'}`}>
            Drag & Drop your files here
          </p>
          <p className={`text-md ${dragActive ? 'text-red-500' : 'text-gray-500'}`}>or click to browse (select multiple)</p>
          <p className="mt-3 text-sm text-gray-500">Accepted: {accept}</p>
        </label>
      </div>
      {selectedFiles.length > 0 && (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg shadow">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-medium text-gray-800">Selected files ({selectedFiles.length}):</h4>
            <button 
              onClick={clearFiles} 
              className="text-xs text-red-500 hover:text-red-700 hover:underline"
              aria-label="Clear selected files"
            >
              Clear all
            </button>
          </div>
          <ul className="list-disc list-inside max-h-40 overflow-y-auto bg-white p-3 rounded border border-gray-200 text-sm">
            {selectedFiles.map((file, index) => (
              <li key={index} className="text-gray-700 truncate py-0.5">{file.name} <span className="text-gray-400 text-xs">({(file.size / 1024).toFixed(1)} KB)</span></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default MultiFileUpload;