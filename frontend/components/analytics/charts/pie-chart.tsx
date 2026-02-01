'use client';

import { PieChart as RechartsPieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useMobile } from '@/lib/hooks/use-mobile';
import { cn } from '@/lib/utils';

export interface PieChartData {
  name: string;
  value: number;
}

interface PieChartProps {
  data: PieChartData[];
  colors?: string[];
  height?: number;
  className?: string;
}

const DEFAULT_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
];

export function PieChart({ data, colors = DEFAULT_COLORS, height = 300, className }: PieChartProps) {
  const { isMobile } = useMobile();
  const mobileHeight = isMobile ? Math.max(height * 0.9, 280) : height;
  
  return (
    <div className={cn("w-full", className)} style={{ height: mobileHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsPieChart>
          <Pie
            data={data}
            cx="50%"
            cy={isMobile ? "45%" : "50%"}
            labelLine={false}
            label={isMobile 
              ? false 
              : ({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''}: ${((percent ?? 0) * 100).toFixed(0)}%`
            }
            outerRadius={isMobile ? 70 : 80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{
              fontSize: isMobile ? '12px' : '14px',
              padding: isMobile ? '8px' : '10px'
            }}
          />
          <Legend 
            verticalAlign={isMobile ? "bottom" : "middle"}
            align={isMobile ? "center" : "right"}
            wrapperStyle={{
              fontSize: isMobile ? '11px' : '14px',
              paddingTop: isMobile ? '10px' : '0'
            }}
          />
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  );
}
