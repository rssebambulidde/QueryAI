'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Filter, X, Calendar, MapPin, Hash, Tag, Plus, Sparkles, Info, Check } from 'lucide-react';
import { TimeRange, Topic, topicApi } from '@/lib/api';
import { useToast } from '@/lib/hooks/use-toast';
import { cn } from '@/lib/utils';

export interface UnifiedFilters {
  // Persistent (Topic)
  topicId?: string | null;
  topic?: Topic | null;
  
  // Temporary (Quick Filters)
  keyword?: string;
  timeRange?: TimeRange;
  startDate?: string;
  endDate?: string;
  country?: string;
}

interface UnifiedFilterPanelProps {
  filters: UnifiedFilters;
  topics: Topic[];
  selectedTopic: Topic | null;
  onChange: (filters: UnifiedFilters) => void;
  onTopicSelect: (topic: Topic | null) => void;
  onClose: () => void;
  disabled?: boolean;
  onLoadTopics?: () => void;
}

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: 'day', label: 'Last 24 hours' },
  { value: 'week', label: 'Last week' },
  { value: 'month', label: 'Last month' },
  { value: 'year', label: 'Last year' },
];

// Complete list of all countries with ISO 3166-1 alpha-2 codes
const COUNTRIES: { code: string; name: string }[] = [
  { code: 'AF', name: 'Afghanistan' },
  { code: 'AL', name: 'Albania' },
  { code: 'DZ', name: 'Algeria' },
  { code: 'AS', name: 'American Samoa' },
  { code: 'AD', name: 'Andorra' },
  { code: 'AO', name: 'Angola' },
  { code: 'AI', name: 'Anguilla' },
  { code: 'AQ', name: 'Antarctica' },
  { code: 'AG', name: 'Antigua and Barbuda' },
  { code: 'AR', name: 'Argentina' },
  { code: 'AM', name: 'Armenia' },
  { code: 'AW', name: 'Aruba' },
  { code: 'AU', name: 'Australia' },
  { code: 'AT', name: 'Austria' },
  { code: 'AZ', name: 'Azerbaijan' },
  { code: 'BS', name: 'Bahamas' },
  { code: 'BH', name: 'Bahrain' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'BB', name: 'Barbados' },
  { code: 'BY', name: 'Belarus' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BZ', name: 'Belize' },
  { code: 'BJ', name: 'Benin' },
  { code: 'BM', name: 'Bermuda' },
  { code: 'BT', name: 'Bhutan' },
  { code: 'BO', name: 'Bolivia' },
  { code: 'BA', name: 'Bosnia and Herzegovina' },
  { code: 'BW', name: 'Botswana' },
  { code: 'BV', name: 'Bouvet Island' },
  { code: 'BR', name: 'Brazil' },
  { code: 'IO', name: 'British Indian Ocean Territory' },
  { code: 'BN', name: 'Brunei Darussalam' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'BF', name: 'Burkina Faso' },
  { code: 'BI', name: 'Burundi' },
  { code: 'KH', name: 'Cambodia' },
  { code: 'CM', name: 'Cameroon' },
  { code: 'CA', name: 'Canada' },
  { code: 'CV', name: 'Cape Verde' },
  { code: 'KY', name: 'Cayman Islands' },
  { code: 'CF', name: 'Central African Republic' },
  { code: 'TD', name: 'Chad' },
  { code: 'CL', name: 'Chile' },
  { code: 'CN', name: 'China' },
  { code: 'CX', name: 'Christmas Island' },
  { code: 'CC', name: 'Cocos (Keeling) Islands' },
  { code: 'CO', name: 'Colombia' },
  { code: 'KM', name: 'Comoros' },
  { code: 'CG', name: 'Congo' },
  { code: 'CD', name: 'Congo, Democratic Republic' },
  { code: 'CK', name: 'Cook Islands' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'CI', name: 'Côte d\'Ivoire' },
  { code: 'HR', name: 'Croatia' },
  { code: 'CU', name: 'Cuba' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'DK', name: 'Denmark' },
  { code: 'DJ', name: 'Djibouti' },
  { code: 'DM', name: 'Dominica' },
  { code: 'DO', name: 'Dominican Republic' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'EG', name: 'Egypt' },
  { code: 'SV', name: 'El Salvador' },
  { code: 'GQ', name: 'Equatorial Guinea' },
  { code: 'ER', name: 'Eritrea' },
  { code: 'EE', name: 'Estonia' },
  { code: 'ET', name: 'Ethiopia' },
  { code: 'FK', name: 'Falkland Islands' },
  { code: 'FO', name: 'Faroe Islands' },
  { code: 'FJ', name: 'Fiji' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'GF', name: 'French Guiana' },
  { code: 'PF', name: 'French Polynesia' },
  { code: 'TF', name: 'French Southern Territories' },
  { code: 'GA', name: 'Gabon' },
  { code: 'GM', name: 'Gambia' },
  { code: 'GE', name: 'Georgia' },
  { code: 'DE', name: 'Germany' },
  { code: 'GH', name: 'Ghana' },
  { code: 'GI', name: 'Gibraltar' },
  { code: 'GR', name: 'Greece' },
  { code: 'GL', name: 'Greenland' },
  { code: 'GD', name: 'Grenada' },
  { code: 'GP', name: 'Guadeloupe' },
  { code: 'GU', name: 'Guam' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'GG', name: 'Guernsey' },
  { code: 'GN', name: 'Guinea' },
  { code: 'GW', name: 'Guinea-Bissau' },
  { code: 'GY', name: 'Guyana' },
  { code: 'HT', name: 'Haiti' },
  { code: 'HM', name: 'Heard Island and McDonald Islands' },
  { code: 'VA', name: 'Holy See (Vatican City)' },
  { code: 'HN', name: 'Honduras' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IS', name: 'Iceland' },
  { code: 'IN', name: 'India' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'IR', name: 'Iran' },
  { code: 'IQ', name: 'Iraq' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IM', name: 'Isle of Man' },
  { code: 'IL', name: 'Israel' },
  { code: 'IT', name: 'Italy' },
  { code: 'JM', name: 'Jamaica' },
  { code: 'JP', name: 'Japan' },
  { code: 'JE', name: 'Jersey' },
  { code: 'JO', name: 'Jordan' },
  { code: 'KZ', name: 'Kazakhstan' },
  { code: 'KE', name: 'Kenya' },
  { code: 'KI', name: 'Kiribati' },
  { code: 'KP', name: 'Korea, North' },
  { code: 'KR', name: 'Korea, South' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'KG', name: 'Kyrgyzstan' },
  { code: 'LA', name: 'Laos' },
  { code: 'LV', name: 'Latvia' },
  { code: 'LB', name: 'Lebanon' },
  { code: 'LS', name: 'Lesotho' },
  { code: 'LR', name: 'Liberia' },
  { code: 'LY', name: 'Libya' },
  { code: 'LI', name: 'Liechtenstein' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MO', name: 'Macao' },
  { code: 'MK', name: 'North Macedonia' },
  { code: 'MG', name: 'Madagascar' },
  { code: 'MW', name: 'Malawi' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'MV', name: 'Maldives' },
  { code: 'ML', name: 'Mali' },
  { code: 'MT', name: 'Malta' },
  { code: 'MH', name: 'Marshall Islands' },
  { code: 'MQ', name: 'Martinique' },
  { code: 'MR', name: 'Mauritania' },
  { code: 'MU', name: 'Mauritius' },
  { code: 'YT', name: 'Mayotte' },
  { code: 'MX', name: 'Mexico' },
  { code: 'FM', name: 'Micronesia' },
  { code: 'MD', name: 'Moldova' },
  { code: 'MC', name: 'Monaco' },
  { code: 'MN', name: 'Mongolia' },
  { code: 'ME', name: 'Montenegro' },
  { code: 'MS', name: 'Montserrat' },
  { code: 'MA', name: 'Morocco' },
  { code: 'MZ', name: 'Mozambique' },
  { code: 'MM', name: 'Myanmar' },
  { code: 'NA', name: 'Namibia' },
  { code: 'NR', name: 'Nauru' },
  { code: 'NP', name: 'Nepal' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NC', name: 'New Caledonia' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'NI', name: 'Nicaragua' },
  { code: 'NE', name: 'Niger' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'NU', name: 'Niue' },
  { code: 'NF', name: 'Norfolk Island' },
  { code: 'MP', name: 'Northern Mariana Islands' },
  { code: 'NO', name: 'Norway' },
  { code: 'OM', name: 'Oman' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'PW', name: 'Palau' },
  { code: 'PS', name: 'Palestine' },
  { code: 'PA', name: 'Panama' },
  { code: 'PG', name: 'Papua New Guinea' },
  { code: 'PY', name: 'Paraguay' },
  { code: 'PE', name: 'Peru' },
  { code: 'PH', name: 'Philippines' },
  { code: 'PN', name: 'Pitcairn' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'PR', name: 'Puerto Rico' },
  { code: 'QA', name: 'Qatar' },
  { code: 'RE', name: 'Réunion' },
  { code: 'RO', name: 'Romania' },
  { code: 'RU', name: 'Russia' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'SH', name: 'Saint Helena' },
  { code: 'KN', name: 'Saint Kitts and Nevis' },
  { code: 'LC', name: 'Saint Lucia' },
  { code: 'PM', name: 'Saint Pierre and Miquelon' },
  { code: 'VC', name: 'Saint Vincent and the Grenadines' },
  { code: 'WS', name: 'Samoa' },
  { code: 'SM', name: 'San Marino' },
  { code: 'ST', name: 'São Tomé and Príncipe' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'SN', name: 'Senegal' },
  { code: 'RS', name: 'Serbia' },
  { code: 'SC', name: 'Seychelles' },
  { code: 'SL', name: 'Sierra Leone' },
  { code: 'SG', name: 'Singapore' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'SB', name: 'Solomon Islands' },
  { code: 'SO', name: 'Somalia' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'GS', name: 'South Georgia and South Sandwich Islands' },
  { code: 'SS', name: 'South Sudan' },
  { code: 'ES', name: 'Spain' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'SD', name: 'Sudan' },
  { code: 'SR', name: 'Suriname' },
  { code: 'SJ', name: 'Svalbard and Jan Mayen' },
  { code: 'SZ', name: 'Eswatini' },
  { code: 'SE', name: 'Sweden' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'SY', name: 'Syria' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'TJ', name: 'Tajikistan' },
  { code: 'TH', name: 'Thailand' },
  { code: 'TL', name: 'Timor-Leste' },
  { code: 'TG', name: 'Togo' },
  { code: 'TK', name: 'Tokelau' },
  { code: 'TO', name: 'Tonga' },
  { code: 'TT', name: 'Trinidad and Tobago' },
  { code: 'TN', name: 'Tunisia' },
  { code: 'TR', name: 'Turkey' },
  { code: 'TM', name: 'Turkmenistan' },
  { code: 'TC', name: 'Turks and Caicos Islands' },
  { code: 'TV', name: 'Tuvalu' },
  { code: 'UG', name: 'Uganda' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'UM', name: 'United States Minor Outlying Islands' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'UZ', name: 'Uzbekistan' },
  { code: 'VU', name: 'Vanuatu' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'VG', name: 'Virgin Islands, British' },
  { code: 'VI', name: 'Virgin Islands, U.S.' },
  { code: 'WF', name: 'Wallis and Futuna' },
  { code: 'EH', name: 'Western Sahara' },
  { code: 'YE', name: 'Yemen' },
  { code: 'ZM', name: 'Zambia' },
  { code: 'ZW', name: 'Zimbabwe' },
];

export const UnifiedFilterPanel: React.FC<UnifiedFilterPanelProps> = ({
  filters,
  topics,
  selectedTopic,
  onChange,
  onTopicSelect,
  onClose,
  disabled = false,
  onLoadTopics,
}) => {
  const { toast } = useToast();
  const [showTopicDropdown, setShowTopicDropdown] = useState(false);
  const [showCreateTopic, setShowCreateTopic] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicDescription, setNewTopicDescription] = useState('');
  const [useCustomDates, setUseCustomDates] = useState(false);
  const [showKeywordSuggestion, setShowKeywordSuggestion] = useState(false);
  const topicDropdownRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Check if keyword should suggest creating a topic
  useEffect(() => {
    if (filters.keyword && filters.keyword.trim().length > 2 && !selectedTopic) {
      setShowKeywordSuggestion(true);
    } else {
      setShowKeywordSuggestion(false);
    }
  }, [filters.keyword, selectedTopic]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (topicDropdownRef.current && !topicDropdownRef.current.contains(event.target as Node)) {
        setShowTopicDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTopicSelect = (topic: Topic | null) => {
    onTopicSelect(topic);
    setShowTopicDropdown(false);
    onChange({
      ...filters,
      topicId: topic?.id || null,
      topic: topic || null,
      // Clear keyword if topic is selected (topic takes precedence)
      keyword: topic ? undefined : filters.keyword,
    });
  };

  const handleCreateTopic = async () => {
    if (!newTopicName.trim()) {
      toast.error('Topic name is required');
      return;
    }

    try {
      const response = await topicApi.create({
        name: newTopicName.trim(),
        description: newTopicDescription.trim() || undefined,
      });

      if (response.success && response.data) {
        toast.success('Topic created successfully');
        const newTopic = response.data;
        setNewTopicName('');
        setNewTopicDescription('');
        setShowCreateTopic(false);
        
        // Auto-select the new topic
        handleTopicSelect(newTopic);
        
        // Reload topics list
        if (onLoadTopics) {
          onLoadTopics();
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create topic');
    }
  };

  const handleSaveKeywordAsTopic = async () => {
    if (!filters.keyword || !filters.keyword.trim()) return;
    
    setNewTopicName(filters.keyword.trim());
    setShowCreateTopic(true);
    setShowKeywordSuggestion(false);
  };

  const handleKeywordChange = (value: string) => {
    onChange({
      ...filters,
      keyword: value,
    });
  };

  const handleTimeRangeChange = (value: TimeRange | 'custom') => {
    if (value === 'custom') {
      setUseCustomDates(true);
      onChange({ ...filters, timeRange: undefined });
    } else {
      setUseCustomDates(false);
      onChange({ ...filters, timeRange: value, startDate: undefined, endDate: undefined });
    }
  };

  const handleClear = () => {
    onChange({
      topicId: null,
      topic: null,
      keyword: undefined,
      timeRange: undefined,
      startDate: undefined,
      endDate: undefined,
      country: undefined,
    });
    onTopicSelect(null);
  };

  const hasFilters = selectedTopic || filters.keyword || filters.timeRange || filters.startDate || filters.endDate || filters.country;

  // Find matching topics for keyword suggestion
  const matchingTopics = filters.keyword && filters.keyword.trim().length > 2
    ? topics.filter(t => 
        t.name.toLowerCase().includes(filters.keyword!.toLowerCase()) ||
        (t.description && t.description.toLowerCase().includes(filters.keyword!.toLowerCase()))
      )
    : [];

  return (
    <div 
      ref={panelRef}
      className="bg-white border border-gray-200 rounded-xl shadow-xl animate-in fade-in slide-in-from-bottom-2 max-h-[80vh] overflow-y-auto relative z-[100]"
    >
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 z-[60] shadow-sm overflow-visible">
        <div className="flex items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-shrink">
            <Filter className="w-4 h-4 text-gray-600 flex-shrink-0" />
            <h3 className="text-sm font-semibold text-gray-900 truncate">Unified Filters</h3>
          </div>
          <div className="flex items-center gap-2 relative z-[70] flex-shrink-0">
            {hasFilters && (
              <button
                onClick={handleClear}
                disabled={disabled}
                className="text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap border border-gray-300 hover:border-gray-400"
                title="Clear all filters"
              >
                Clear All
              </button>
            )}
            <button
              onClick={onClose}
              disabled={disabled}
              className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors relative z-[70] flex items-center justify-center min-w-[32px] min-h-[32px] flex-shrink-0"
              title="Close filters"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Topic Scope Section (Persistent) */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-orange-600" />
            <label className="text-xs font-semibold text-gray-900">Topic Scope</label>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Info className="w-3 h-3" />
              <span className="hidden sm:inline">Persistent - organizes conversations & documents</span>
            </div>
          </div>
          
          {selectedTopic ? (
            <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex-1">
                <div className="font-medium text-sm text-orange-900">{selectedTopic.name}</div>
                {selectedTopic.description && (
                  <div className="text-xs text-orange-700 mt-1">{selectedTopic.description}</div>
                )}
              </div>
              <button
                onClick={() => handleTopicSelect(null)}
                disabled={disabled}
                className="p-1 text-orange-600 hover:text-orange-700 hover:bg-orange-100 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="relative" ref={topicDropdownRef}>
              <button
                onClick={() => setShowTopicDropdown(!showTopicDropdown)}
                disabled={disabled}
                className="w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900"
              >
                <span className="text-gray-500">Select a topic...</span>
                <Plus className="w-4 h-4 text-gray-400" />
              </button>
              
              {showTopicDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto">
                  {topics.length === 0 ? (
                    <div className="p-3 text-xs text-gray-500 text-center">
                      <p>No topics yet.</p>
                      <button
                        onClick={() => {
                          setShowTopicDropdown(false);
                          setShowCreateTopic(true);
                        }}
                        className="mt-2 text-orange-600 hover:text-orange-700 font-medium"
                      >
                        Create your first topic
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="p-2 border-b border-gray-100">
                        <button
                          onClick={() => {
                            setShowTopicDropdown(false);
                            setShowCreateTopic(true);
                          }}
                          className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-orange-600 hover:bg-orange-50 rounded transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          Create New Topic
                        </button>
                      </div>
                      {topics.map((topic) => (
                        <button
                          key={topic.id}
                          onClick={() => handleTopicSelect(topic)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50 border-b border-gray-100 last:border-b-0 transition-colors"
                        >
                          <div className="font-medium text-gray-900">{topic.name}</div>
                          {topic.description && (
                            <div className="text-xs text-gray-500 mt-1">{topic.description}</div>
                          )}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Create Topic Modal */}
          {showCreateTopic && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-900">Create New Topic</span>
                <button
                  onClick={() => {
                    setShowCreateTopic(false);
                    setNewTopicName('');
                    setNewTopicDescription('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <input
                type="text"
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
                placeholder="Topic name (e.g., Bank of Uganda)"
                disabled={disabled}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900 placeholder-gray-400"
              />
              <textarea
                value={newTopicDescription}
                onChange={(e) => setNewTopicDescription(e.target.value)}
                placeholder="Description (optional)"
                disabled={disabled}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900 placeholder-gray-400 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreateTopic}
                  disabled={disabled || !newTopicName.trim()}
                  className="flex-1 px-3 py-1.5 text-xs bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setShowCreateTopic(false);
                    setNewTopicName('');
                    setNewTopicDescription('');
                  }}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200"></div>

        {/* Quick Filters Section (Temporary) */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <label className="text-xs font-semibold text-gray-900">Quick Filters</label>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Info className="w-3 h-3" />
              <span className="hidden sm:inline">Temporary - refines web search only</span>
            </div>
          </div>

          {/* Keyword Filter */}
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 mb-1">
              <Hash className="w-3 h-3" />
              Keyword
            </label>
            <div className="relative">
              <input
                type="text"
                value={filters.keyword || ''}
                onChange={(e) => handleKeywordChange(e.target.value)}
                placeholder={selectedTopic ? "Additional keyword (optional)" : "e.g., technology, education, AI..."}
                disabled={disabled || !!selectedTopic}
                className={cn(
                  "w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400",
                  selectedTopic && "bg-gray-100 cursor-not-allowed"
                )}
              />
              {selectedTopic && (
                <div className="absolute inset-0 flex items-center justify-end pr-3 pointer-events-none">
                  <span className="text-xs text-gray-500">Using topic instead</span>
                </div>
              )}
            </div>
            
            {/* Smart Suggestions */}
            {showKeywordSuggestion && (
              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-amber-900">Save as Topic?</p>
                    <p className="text-xs text-amber-700 mt-1">
                      Create a topic "{filters.keyword}" to organize conversations and filter documents.
                    </p>
                    <button
                      onClick={handleSaveKeywordAsTopic}
                      className="mt-2 text-xs text-amber-700 hover:text-amber-900 font-medium underline"
                    >
                      Create topic →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Matching Topics Suggestion */}
            {matchingTopics.length > 0 && !selectedTopic && (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-gray-600">Did you mean:</p>
                {matchingTopics.slice(0, 3).map((topic) => (
                  <button
                    key={topic.id}
                    onClick={() => handleTopicSelect(topic)}
                    className="w-full text-left px-2 py-1.5 text-xs bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors"
                  >
                    <div className="font-medium text-blue-900">{topic.name}</div>
                    {topic.description && (
                      <div className="text-blue-700 mt-0.5">{topic.description}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Time Range Filter */}
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 mb-1">
              <Calendar className="w-3 h-3" />
              Time Range
            </label>
            <div className="space-y-2">
              <select
                value={useCustomDates ? 'custom' : filters.timeRange || ''}
                onChange={(e) => handleTimeRangeChange(e.target.value as TimeRange | 'custom')}
                disabled={disabled}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              >
                <option value="">All time</option>
                {TIME_RANGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
                <option value="custom">Custom date range</option>
              </select>

              {useCustomDates && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">Start Date</label>
                    <input
                      type="date"
                      value={filters.startDate || ''}
                      onChange={(e) => onChange({ ...filters, startDate: e.target.value })}
                      disabled={disabled}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">End Date</label>
                    <input
                      type="date"
                      value={filters.endDate || ''}
                      onChange={(e) => onChange({ ...filters, endDate: e.target.value })}
                      disabled={disabled}
                      min={filters.startDate}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Location/Country Filter */}
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 mb-1">
              <MapPin className="w-3 h-3" />
              Location
            </label>
            <select
              value={filters.country || ''}
              onChange={(e) => onChange({ ...filters, country: e.target.value || undefined })}
              disabled={disabled}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            >
              <option value="">All countries</option>
              {COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">{COUNTRIES.length} countries available</p>
          </div>
        </div>
      </div>
    </div>
  );
};
