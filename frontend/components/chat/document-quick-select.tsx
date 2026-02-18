'use client';

import React, { useState, useRef, useEffect } from 'react';
import { FileText, ChevronDown, Search, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DocumentItem } from '@/lib/api';

interface DocumentQuickSelectProps {
  documents: DocumentItem[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  disabled?: boolean;
  className?: string;
}

export const DocumentQuickSelect: React.FC<DocumentQuickSelectProps> = ({
  documents,
  selectedIds,
  onSelectionChange,
  disabled = false,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter documents by search query
  const filteredDocs = documents.filter((doc) =>
    (doc.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggleDocument = (docId: string) => {
    if (selectedIds.includes(docId)) {
      onSelectionChange(selectedIds.filter((id) => id !== docId));
    } else {
      onSelectionChange([...selectedIds, docId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === documents.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(documents.map((d) => d.id || d.path));
    }
  };

  const getButtonLabel = () => {
    if (selectedIds.length === 0) return 'All documents';
    if (selectedIds.length === 1) {
      const doc = documents.find((d) => (d.id || d.path) === selectedIds[0]);
      return doc?.name || '1 document';
    }
    return `${selectedIds.length} documents`;
  };

  if (documents.length === 0) {
    return null;
  }

  return (
    <div className={cn('relative', className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border transition-colors',
          'min-h-[32px] max-w-[180px]',
          isOpen
            ? 'border-orange-300 bg-orange-50 text-orange-700'
            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <FileText className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate">{getButtonLabel()}</span>
        <ChevronDown className={cn('w-3.5 h-3.5 flex-shrink-0 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden"
          role="listbox"
        >
          {/* Search */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents..."
                className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Select All */}
          <button
            type="button"
            onClick={handleSelectAll}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 border-b border-gray-100"
          >
            <div className={cn(
              'w-4 h-4 rounded border flex items-center justify-center',
              selectedIds.length === documents.length
                ? 'bg-orange-500 border-orange-500 text-white'
                : selectedIds.length > 0
                ? 'bg-orange-100 border-orange-300'
                : 'border-gray-300'
            )}>
              {selectedIds.length === documents.length && <Check className="w-3 h-3" />}
            </div>
            <span>
              {selectedIds.length === documents.length ? 'Deselect all' : 'Select all'}
            </span>
          </button>

          {/* Document List */}
          <div className="max-h-48 overflow-y-auto">
            {filteredDocs.length === 0 ? (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">
                No documents found
              </div>
            ) : (
              filteredDocs.map((doc) => {
                const docId = doc.id || doc.path;
                const isSelected = selectedIds.includes(docId);
                return (
                  <button
                    key={docId}
                    type="button"
                    onClick={() => handleToggleDocument(docId)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors',
                      isSelected ? 'bg-orange-50 text-orange-700' : 'text-gray-700 hover:bg-gray-50'
                    )}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div className={cn(
                      'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0',
                      isSelected
                        ? 'bg-orange-500 border-orange-500 text-white'
                        : 'border-gray-300'
                    )}>
                      {isSelected && <Check className="w-3 h-3" />}
                    </div>
                    <FileText className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                    <span className="truncate flex-1">{doc.name || 'Untitled'}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
