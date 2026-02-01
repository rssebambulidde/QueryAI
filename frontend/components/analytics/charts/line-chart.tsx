'use client';

import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useMobile } from '@/lib/hooks/use-mobile';
import { cn } from '@/lib/utils';

export interface LineChartData {
  name: string;
  [key: string]: string | number;
}

interface LineChartProps {
  data: LineChartData[];
  dataKeys: Array<{ key: string; color: string; name?: string }>;
  xAxisKey?: string;
  height?: number;
  className?: string;
}

export function LineChart({ data, dataKeys, xAxisKey = 'name', height = 300, className }: LineChartProps) {
  const { isMobile } = useMobile();
  const mobileHeight = isMobile ? Math.max(height * 0.8, 250) : height;
  
  return (
    <div className={cn("w-full overflow-x-auto", className)} style={{ height: mobileHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart 
          data={data} 
          margin={isMobile 
            ? { top: 5, right: 5, left: 0, bottom: 40 } 
            : { top: 5, right: 30, left: 20, bottom: 5 }
          }
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey={xAxisKey}
            angle={isMobile ? -45 : 0}
            textAnchor={isMobile ? "end" : "middle"}
            height={isMobile ? 60 : undefined}
            tick={{ fontSize: isMobile ? 10 : 12 }}
          />
          <YAxis 
            width={isMobile ? 40 : 60}
            tick={{ fontSize: isMobile ? 10 : 12 }}
          />
          <Tooltip 
            contentStyle={{
              fontSize: isMobile ? '12px' : '14px',
              padding: isMobile ? '8px' : '10px'
            }}
          />
          {!isMobile && <Legend />}
          {dataKeys.map(({ key, color, name }) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={color}
              name={name || key}
              strokeWidth={isMobile ? 2.5 : 2}
              dot={isMobile ? { r: 3 } : { r: 4 }}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}
