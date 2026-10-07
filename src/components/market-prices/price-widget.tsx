'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, Plus, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

interface WatchlistItem {
  id: string;
  commodity: string;
  variety: string | null;
  preferred_market: string | null;
  preferred_state: string | null;
  alert_threshold: number | null;
}

interface PriceData {
  commodity: string;
  modal_price: number | null;
  price_date: string;
  market: string;
  state: string;
  change_percent: number | null;
  trend: 'rising' | 'falling' | 'stable';
}

interface MarketPricesWidgetProps {
  watchlist: WatchlistItem[];
  priceData: PriceData[];
}

export function MarketPricesWidget({ watchlist, priceData }: MarketPricesWidgetProps) {
  const [expanded, setExpanded] = useState(false);

  // Show top 3 commodities by default
  const displayItems = expanded ? priceData : priceData.slice(0, 3);

  if (watchlist.length === 0) {
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <span className="text-xl">📊</span>
            Market Prices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-4">
              Track commodity prices to make better sell/hold decisions
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href="/market-prices">
                <Plus className="h-4 w-4 mr-2" />
                Add Commodities
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <span className="text-xl">📊</span>
            Market Prices
            <Badge variant="secondary" className="ml-2 text-xs">
              {format(new Date(), 'dd MMM yyyy')}
            </Badge>
          </CardTitle>
          <Button asChild variant="ghost" size="sm" className="h-8 text-xs">
            <Link href="/market-prices">
              View All
              <ExternalLink className="h-3 w-3 ml-1" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {displayItems.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">
              Loading prices...
            </p>
          </div>
        ) : (
          <>
            {displayItems.map((item, index) => (
              <PriceItem key={index} data={item} />
            ))}
            
            {priceData.length > 3 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? 'Show Less' : `Show ${priceData.length - 3} More`}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PriceItem({ data }: { data: PriceData }) {
  const getTrendIcon = () => {
    if (data.trend === 'rising') {
      return <TrendingUp className="h-4 w-4 text-emerald-500" />;
    }
    if (data.trend === 'falling') {
      return <TrendingDown className="h-4 w-4 text-rose-500" />;
    }
    return <Minus className="h-4 w-4 text-slate-400" />;
  };

  const getTrendColor = () => {
    if (data.trend === 'rising') return 'text-emerald-600 dark:text-emerald-400';
    if (data.trend === 'falling') return 'text-rose-600 dark:text-rose-400';
    return 'text-slate-600 dark:text-slate-400';
  };

  const formatPrice = (price: number | null) => {
    if (price === null) return 'N/A';
    return `₹${price.toLocaleString('en-IN')}/qtl`;
  };

  const formatChange = (change: number | null) => {
    if (change === null) return '';
    const sign = change > 0 ? '+' : '';
    return `${sign}${change.toFixed(1)}%`;
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate">{data.commodity}</p>
          {getTrendIcon()}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {data.market}, {data.state}
        </p>
      </div>
      <div className="text-right ml-3">
        <p className="font-bold text-sm tabular-nums">
          {formatPrice(data.modal_price)}
        </p>
        {data.change_percent !== null && (
          <p className={`text-xs font-medium tabular-nums ${getTrendColor()}`}>
            {formatChange(data.change_percent)}
          </p>
        )}
      </div>
    </div>
  );
}
