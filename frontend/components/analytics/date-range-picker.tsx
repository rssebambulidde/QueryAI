'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMobile } from '@/lib/hooks/use-mobile';
import { cn } from '@/lib/utils';

export interface DateRange {
  startDate: string;
  endDate: string;
}

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
  const { isMobile } = useMobile();
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
    <div className={cn(
      "flex items-center gap-2",
      isMobile ? "flex-col" : "flex-wrap",
      className
    )}>
      {/* Preset Buttons */}
      <div className={cn(
        "flex gap-2",
        isMobile ? "w-full flex-wrap" : ""
      )}>
        <Button
          variant={isPresetActive('today') ? 'default' : 'outline'}
          size={isMobile ? "md" : "sm"}
          onClick={() => handlePreset('today')}
          className={cn(
            "touch-manipulation min-h-[44px]",
            isMobile ? "flex-1 min-w-[80px]" : ""
          )}
        >
          Today
        </Button>
        <Button
          variant={isPresetActive('week') ? 'default' : 'outline'}
          size={isMobile ? "md" : "sm"}
          onClick={() => handlePreset('week')}
          className={cn(
            "touch-manipulation min-h-[44px]",
            isMobile ? "flex-1 min-w-[100px]" : ""
          )}
        >
          {isMobile ? "7 Days" : "Last 7 Days"}
        </Button>
        <Button
          variant={isPresetActive('month') ? 'default' : 'outline'}
          size={isMobile ? "md" : "sm"}
          onClick={() => handlePreset('month')}
          className={cn(
            "touch-manipulation min-h-[44px]",
            isMobile ? "flex-1 min-w-[100px]" : ""
          )}
        >
          {isMobile ? "30 Days" : "Last 30 Days"}
        </Button>
        <Button
          variant={isPresetActive('year') ? 'default' : 'outline'}
          size={isMobile ? "md" : "sm"}
          onClick={() => handlePreset('year')}
          className={cn(
            "touch-manipulation min-h-[44px]",
            isMobile ? "flex-1 min-w-[100px]" : ""
          )}
        >
          {isMobile ? "Year" : "Last Year"}
        </Button>
      </div>

      {/* Custom Range */}
      <div className={cn(
        "flex items-center gap-2",
        isMobile ? "w-full flex-col" : ""
      )}>
        <Button
          variant={isCustom ? 'default' : 'outline'}
          size={isMobile ? "md" : "sm"}
          onClick={() => setIsCustom(!isCustom)}
          className={cn(
            "touch-manipulation min-h-[44px]",
            isMobile ? "w-full" : ""
          )}
        >
          Custom Range
        </Button>

        {isCustom && (
          <div className={cn(
            "flex items-center gap-2",
            isMobile ? "w-full flex-col" : ""
          )}>
            <Input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className={cn(
                "min-h-[44px] text-base sm:text-sm",
                isMobile ? "w-full" : "w-auto"
              )}
            />
            <span className={cn(
              "text-gray-500",
              isMobile ? "hidden" : ""
            )}>
              to
            </span>
            <Input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className={cn(
                "min-h-[44px] text-base sm:text-sm",
                isMobile ? "w-full" : "w-auto"
              )}
            />
            <Button 
              size={isMobile ? "md" : "sm"} 
              onClick={handleCustomApply}
              className={cn(
                "touch-manipulation min-h-[44px]",
                isMobile ? "w-full" : ""
              )}
            >
              Apply
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
