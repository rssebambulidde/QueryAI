import React from 'react';

export const DocumentListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <div className="space-y-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 animate-pulse p-4 border rounded-md bg-gray-50">
        <div className="w-8 h-8 bg-gray-200 rounded" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="h-3 bg-gray-100 rounded w-1/3" />
        </div>
        <div className="w-16 h-4 bg-gray-100 rounded" />
      </div>
    ))}
  </div>
);
