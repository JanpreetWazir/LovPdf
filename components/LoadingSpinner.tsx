import React from 'react';

const LoadingSpinner: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center space-y-3 py-10">
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-red-600"></div>
      <p className="text-gray-700 text-lg">Processing with love, please wait...</p>
    </div>
  );
};

export default LoadingSpinner;