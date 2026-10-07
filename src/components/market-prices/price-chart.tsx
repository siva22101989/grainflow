'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { format } from 'date-fns';

// Dynamically import the chart content component with SSR disabled
const PriceChartContent = dynamic(() => import('./price-chart-content'), { 
  ssr: false,
  loading: () => <div className="h-[300px] w-full flex items-center justify-center bg-muted/20 animate-pulse rounded-md">Loading chart...</div>
});
  
interface PriceHistory {
  date: string;
  price: number;
}

interface PriceTrend {
  current: number | null;
  average: number | null;
  min: number | null;
  max: number | null;
  trend: 'rising' | 'falling' | 'stable';
  change_percent: number | null;
  history: PriceHistory[];
}

interface PriceChartProps {
  commodity: string;
  market: string;
  state: string;
  trend: PriceTrend;
}

type TimeRange = '7d' | '30d' | '90d';

export function PriceChart({ commodity, market, state, trend }: PriceChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

  // Filter data based on time range
  const getFilteredData = () => {
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    return trend.history.slice(0, days).reverse();
  };

  const data = getFilteredData();

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium">
            {format(new Date(payload[0].payload.date), 'dd MMM yyyy')}
          </p>
          <p className="text-lg font-bold text-primary">
            ₹{payload[0].value.toLocaleString('en-IN')}/qtl
          </p>
        </div>
      );
    }
    return null;
  };

  const getTrendIcon = () => {
    if (trend.trend === 'rising') {
      return <TrendingUp className="h-5 w-5 text-emerald-500" />;
    }
    if (trend.trend === 'falling') {
      return <TrendingDown className="h-5 w-5 text-rose-500" />;
    }
    return <Minus className="h-5 w-5 text-slate-400" />;
  };

  const getTrendColor = () => {
    if (trend.trend === 'rising') return 'text-emerald-600';
    if (trend.trend === 'falling') return 'text-rose-600';
    return 'text-slate-600';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{commodity}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {market}, {state}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {getTrendIcon()}
            <div className="text-right">
              <p className="text-2xl font-bold tabular-nums">
                ₹{trend.current?.toLocaleString('en-IN') || 'N/A'}
              </p>
              {trend.change_percent !== null && (
                <p className={`text-sm font-medium tabular-nums ${getTrendColor()}`}>
                  {trend.change_percent > 0 ? '+' : ''}
                  {trend.change_percent.toFixed(1)}%
                </p>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Time Range Selector */}
        <div className="flex items-center gap-2">
          <Button
            variant={timeRange === '7d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange('7d')}
          >
            7 Days
          </Button>
          <Button
            variant={timeRange === '30d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange('30d')}
          >
            30 Days
          </Button>
          <Button
            variant={timeRange === '90d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange('90d')}
          >
            90 Days
          </Button>
        </div>

        {/* Chart */}
        {data.length > 0 ? (
          <PriceChartContent data={data} CustomTooltip={CustomTooltip} />
        ) : (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            <p>No price data available</p>
          </div>
        )}

        {/* Statistics */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t">
          <div>
            <p className="text-xs text-muted-foreground">Average</p>
            <p className="text-lg font-semibold tabular-nums">
              ₹{trend.average?.toLocaleString('en-IN') || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Min</p>
            <p className="text-lg font-semibold tabular-nums text-rose-600">
              ₹{trend.min?.toLocaleString('en-IN') || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Max</p>
            <p className="text-lg font-semibold tabular-nums text-emerald-600">
              ₹{trend.max?.toLocaleString('en-IN') || 'N/A'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
