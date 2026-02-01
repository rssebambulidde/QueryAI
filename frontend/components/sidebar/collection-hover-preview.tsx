'use client';

import React from 'react';
import { Collection } from '@/lib/api';
import { cn } from '@/lib/utils';
import { FolderOpen, Plus } from 'lucide-react';

interface CollectionHoverPreviewProps {
  collections: Collection[];
  onSelect: (collectionId: string) => void;
  onCreateNew: () => void;
}

export const CollectionHoverPreview: React.FC<CollectionHoverPreviewProps> = ({
  collections,
  onSelect,
  onCreateNew,
}) => {
  return (
    <div 
      className="absolute left-full top-0 ml-2 w-80 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-[500px] overflow-y-auto"
      onMouseEnter={(e) => e.stopPropagation()}
      onMouseLeave={(e) => e.stopPropagation()}
    >
      <div className="p-2">
        <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 mb-1 flex items-center justify-between">
          <span>All Collections ({collections.length})</span>
          <button
            onClick={onCreateNew}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            title="New Collection"
          >
            <Plus className="w-3.5 h-3.5 text-gray-500" />
          </button>
        </div>
        <div className="space-y-0.5">
          {collections.map((collection) => (
            <button
              key={collection.id}
              onClick={() => onSelect(collection.id)}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors hover:bg-gray-50"
            >
              <FolderOpen className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {collection.name || 'Unnamed Collection'}
                </div>
                {collection.description && (
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {collection.description}
                  </p>
                )}
                {collection.conversation_count !== undefined && collection.conversation_count > 0 && (
                  <span className="text-xs text-gray-400 mt-0.5">
                    {collection.conversation_count} conversations
                  </span>
                )}
              </div>
            </button>
          ))}
          {collections.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-gray-500">
              No collections yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
