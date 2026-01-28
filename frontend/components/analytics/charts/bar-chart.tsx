'use client';

import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export interface BarChartData {
  name: string;
  [key: string]: string | number;
}

interface BarChartProps {
  data: BarChartData[];
  dataKeys: Array<{ key: string; color: string; name?: string }>;
  xAxisKey?: string;
  height?: number;
  className?: string;
}

export function BarChart({ data, dataKeys, xAxisKey = 'name', height = 300, className }: BarChartProps) {
  return (
    <div className={className} style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <RechartsBarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xAxisKey} />
          <YAxis />
          <Tooltip />
          <Legend />
          {dataKeys.map(({ key, color, name }) => (
            <Bar key={key} dataKey={key} fill={color} name={name || key} />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
