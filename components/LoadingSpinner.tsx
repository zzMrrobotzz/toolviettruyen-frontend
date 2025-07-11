import React from 'react';

interface LoadingSpinnerProps {
  message?: string;
  noMargins?: boolean; // Added prop
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message = "Đang xử lý...", noMargins = false }) => {
  const containerClasses = `flex flex-col items-center justify-center p-4 text-indigo-600 ${noMargins ? '' : 'my-6'}`;
  return (
    <div className={containerClasses}>
      <svg className="animate-spin -ml-1 mr-3 h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <p className="mt-2 text-sm font-medium">{message}</p>
    </div>
  );
};

export default LoadingSpinner;