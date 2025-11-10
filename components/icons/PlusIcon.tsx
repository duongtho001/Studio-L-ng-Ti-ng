
import React from 'react';

export const PlusIcon: React.FC<{className?: string}> = ({ className }) => (
  <svg className={className} aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 18 18">
    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 1v16M1 9h16"/>
  </svg>
);
