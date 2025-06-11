import React from 'react';

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

const ActionButton: React.FC<ActionButtonProps> = ({ children, className, ...props }) => {
  return (
    <button
      {...props}
      className={`
        px-5 py-2.5 border border-transparent text-base font-medium rounded-lg shadow-md text-white 
        bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500
        disabled:bg-gray-400 disabled:cursor-not-allowed disabled:hover:bg-gray-400
        transition-all duration-150 ease-in-out transform hover:scale-105
        ${className}
      `}
    >
      {children}
    </button>
  );
};

export default ActionButton;