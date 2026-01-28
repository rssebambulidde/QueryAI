'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface DateRange {
  startDate: string;
  endDate: string;
}

// Re-export for convenience
export type { DateRange };

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

const PRESET_RANGES = {
  today: () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return {
      startDate: today.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0],
    };
  },
  week: () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  },
  month: () => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  },
  year: () => {
    const end = new Date();
    const start = new Date();
    start.setFullYear(start.getFullYear() - 1);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  },
};

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [isCustom, setIsCustom] = useState(false);
  const [customStart, setCustomStart] = useState(value.startDate);
  const [customEnd, setCustomEnd] = useState(value.endDate);

  useEffect(() => {
    setCustomStart(value.startDate);
    setCustomEnd(value.endDate);
  }, [value]);

  const handlePreset = (preset: keyof typeof PRESET_RANGES) => {
    const range = PRESET_RANGES[preset]();
    onChange(range);
    setIsCustom(false);
  };

  const handleCustomApply = () => {
    if (customStart && customEnd && customStart <= customEnd) {
      onChange({
        startDate: customStart,
        endDate: customEnd,
      });
      setIsCustom(false);
    }
  };

  const isPresetActive = (preset: keyof typeof PRESET_RANGES) => {
    const range = PRESET_RANGES[preset]();
    return value.startDate === range.startDate && value.endDate === range.endDate;
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <div className="flex gap-2">
        <Button
          variant={isPresetActive('today') ? 'default' : 'outline'}
          size="sm"
          onClick={() => handlePreset('today')}
        >
          Today
        </Button>
        <Button
          variant={isPresetActive('week') ? 'default' : 'outline'}
          size="sm"
          onClick={() => handlePreset('week')}
        >
          Last 7 Days
        </Button>
        <Button
          variant={isPresetActive('month') ? 'default' : 'outline'}
          size="sm"
          onClick={() => handlePreset('month')}
        >
          Last 30 Days
        </Button>
        <Button
          variant={isPresetActive('year') ? 'default' : 'outline'}
          size="sm"
          onClick={() => handlePreset('year')}
        >
          Last Year
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant={isCustom ? 'default' : 'outline'}
          size="sm"
          onClick={() => setIsCustom(!isCustom)}
        >
          Custom Range
        </Button>

        {isCustom && (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="w-auto"
            />
            <span className="text-gray-500">to</span>
            <Input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="w-auto"
            />
            <Button size="sm" onClick={handleCustomApply}>
              Apply
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
