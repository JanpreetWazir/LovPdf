import React, { useCallback, useState } from 'react';

interface FileUploadProps {
  onFileChange: (file: File | null) => void;
  accept: string; // e.g., '.pdf', '.docx, .doc'
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileChange, accept }) => {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent<HTMLDivElement | HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileChange(e.dataTransfer.files[0]);
    }
  }, [onFileChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      onFileChange(e.target.files[0]);
    } else {
      onFileChange(null);
    }
  };

  return (
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
        id="file-upload"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />
      <label
        htmlFor="file-upload"
        className="flex flex-col items-center justify-center cursor-pointer text-gray-600 space-y-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className={`w-16 h-16 ${dragActive ? 'text-red-600 animate-pulse' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className={`text-xl font-semibold ${dragActive ? 'text-red-700' : 'text-gray-700'}`}>
          Drag & Drop your file here
        </p>
        <p className={`text-md ${dragActive ? 'text-red-500' : 'text-gray-500'}`}>or click to browse</p>
        <p className="mt-3 text-sm text-gray-500">Accepted: {accept}</p>
      </label>
    </div>
  );
};

export default FileUpload;