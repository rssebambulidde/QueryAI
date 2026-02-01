'use client';

import { LineChart } from './line-chart';
import { LineChartData } from './line-chart';

export interface TimeSeriesDataPoint {
  date: string;
  [key: string]: string | number;
}

interface TimeSeriesChartProps {
  data: TimeSeriesDataPoint[];
  dataKeys: Array<{ key: string; color: string; name?: string }>;
  height?: number;
  className?: string;
  dateFormat?: (date: string) => string;
}

export function TimeSeriesChart({
  data,
  dataKeys,
  height = 300,
  className,
  dateFormat = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },
}: TimeSeriesChartProps) {
  const formattedData: LineChartData[] = data.map((point) => ({
    name: dateFormat(point.date),
    ...point,
  }));

  return (
    <LineChart
      data={formattedData}
      dataKeys={dataKeys}
      xAxisKey="name"
      height={height}
      className={className}
    />
  );
}
