'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Brain,
  AlertTriangle,
  Flame,
  CheckCircle2,
  TrendingUp,
  Clock,
  RefreshCw,
  Package,
  Search,
  ArrowRight,
  Sparkles,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ProductForecastItem } from '@/app/api/products/forecasting/route';

interface InventoryForecastModalProps {
  isOpen: boolean;
  onClose: () => void;
  onQuickRestock: (product: { id: string; name: string; stock_quantity: number }) => void;
}

export function InventoryForecastModal({
  isOpen,
  onClose,
  onQuickRestock,
}: InventoryForecastModalProps) {
  const [loading, setLoading] = useState(false);
  const [forecasts, setForecasts] = useState<ProductForecastItem[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [filter, setFilter] = useState<'all' | 'urgent' | 'healthy' | 'slow'>('all');
  const [search, setSearch] = useState('');

  const fetchForecasts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/products/forecasting');
      const data = await res.json();
      if (res.ok) {
        setForecasts(data.forecasts || []);
        setSummary(data.summary || null);
      } else {
        toast.error(data.error || 'Failed to fetch inventory forecast');
      }
    } catch {
      toast.error('Network error loading forecast');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void fetchForecasts();
    }
  }, [isOpen, fetchForecasts]);

  const filteredForecasts = forecasts.filter((item) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      item.name.toLowerCase().includes(q) ||
      (item.sku && item.sku.toLowerCase().includes(q));

    let matchesFilter = true;
    if (filter === 'urgent') {
      matchesFilter = item.urgency === 'CRITICAL' || item.urgency === 'WARNING';
    } else if (filter === 'healthy') {
      matchesFilter = item.urgency === 'HEALTHY';
    } else if (filter === 'slow') {
      matchesFilter = item.urgency === 'SLOW_MOVING' || item.urgency === 'IDLE';
    }

    return matchesSearch && matchesFilter;
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[88vh] overflow-y-auto bg-card border text-card-foreground p-4 sm:p-6 rounded-2xl shadow-2xl">
        <DialogHeader className="border-b pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-500 flex items-center justify-center shrink-0">
                <Brain className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <span>AI ইনভেন্টরি ডিমান্ড ফোরকাস্টিং</span>
                  <Badge className="bg-purple-600 text-white text-[10px] font-black uppercase">
                    AI Predict
                  </Badge>
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  বিগত ৩০ দিনের সেলস স্পিড অ্যানালাইসিস করে কবে স্টক শেষ হবে ও কত রিস্টক লাগবে তার স্বয়ংক্রিয় হিসাব
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchForecasts}
              disabled={loading}
              className="h-8 text-xs self-start sm:self-auto"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              রিলোড প্রেডিকশন
            </Button>
          </div>
        </DialogHeader>

        {/* Forecast KPI Highlights */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 space-y-1">
              <span className="text-[10px] text-red-600 dark:text-red-400 uppercase font-semibold flex items-center gap-1">
                <Flame className="h-3.5 w-3.5" />
                জরুরি স্টক আউট (৩ দিনে)
              </span>
              <p className="text-2xl font-black text-red-600 dark:text-red-400 font-mono">
                {summary.criticalCount}{' '}
                <span className="text-xs font-normal text-muted-foreground">টি পণ্য</span>
              </p>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-1">
              <span className="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-semibold flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                সতর্কতা (৪-৭ দিন বাকি)
              </span>
              <p className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
                {summary.warningCount}{' '}
                <span className="text-xs font-normal text-muted-foreground">টি পণ্য</span>
              </p>
            </div>

            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-1">
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-semibold flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                পর্যাপ্ত স্টক (সেফ জোন)
              </span>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                {summary.healthyCount}{' '}
                <span className="text-xs font-normal text-muted-foreground">টি পণ্য</span>
              </p>
            </div>

            <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-3 space-y-1">
              <span className="text-[10px] text-blue-600 dark:text-blue-400 uppercase font-semibold flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5" />
                সম্ভাব্য মাসিক বিক্রয়
              </span>
              <p className="text-lg font-black text-blue-600 dark:text-blue-400 font-mono">
                ৳{summary.totalProjectedMonthlyRevenue?.toLocaleString('en-BD')}
              </p>
            </div>
          </div>
        )}

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                filter === 'all'
                  ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                  : 'bg-muted/60 border text-muted-foreground hover:text-foreground'
              }`}
            >
              সব পূর্বাভাস ({forecasts.length})
            </button>
            <button
              onClick={() => setFilter('urgent')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1 transition-all ${
                filter === 'urgent'
                  ? 'bg-red-600 text-white font-bold shadow-xs'
                  : 'bg-muted/60 border text-red-600 dark:text-red-400 hover:bg-red-500/10'
              }`}
            >
              <Flame className="h-3.5 w-3.5" />
              জরুরি রিস্টক প্রয়োজন ({(summary?.criticalCount || 0) + (summary?.warningCount || 0)})
            </button>
            <button
              onClick={() => setFilter('healthy')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                filter === 'healthy'
                  ? 'bg-emerald-600 text-white font-bold shadow-xs'
                  : 'bg-muted/60 border text-muted-foreground hover:text-foreground'
              }`}
            >
              সেফ জোন ({summary?.healthyCount || 0})
            </button>
            <button
              onClick={() => setFilter('slow')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                filter === 'slow'
                  ? 'bg-amber-600 text-white font-bold shadow-xs'
                  : 'bg-muted/60 border text-muted-foreground hover:text-foreground'
              }`}
            >
              স্লো মুভিং ({summary?.slowMovingCount || 0})
            </button>
          </div>

          <div className="relative w-full sm:w-60">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
            <Input
              placeholder="পণ্য বা SKU দিয়ে খুঁজুন..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs bg-neutral-900 border-neutral-800 text-neutral-100"
            />
          </div>
        </div>

        {/* Forecast Items Table / List */}
        <div className="space-y-3 pt-2">
          {loading ? (
            <div className="py-16 text-center text-xs text-neutral-400 flex flex-col items-center gap-2">
              <RefreshCw className="h-7 w-7 animate-spin text-purple-400" />
              <span>AI ইনভেন্টরি অ্যানালিটিক্স হিসাব করা হচ্ছে...</span>
            </div>
          ) : filteredForecasts.length === 0 ? (
            <div className="py-12 text-center text-neutral-500 text-xs border border-dashed border-neutral-800 rounded-2xl">
              কোনো পূর্বাভাস ডেটা পাওয়া যায়নি।
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredForecasts.map((item) => {
                const isCritical = item.urgency === 'CRITICAL';
                const isWarning = item.urgency === 'WARNING';

                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-4 transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
                      isCritical
                        ? 'border-red-500/40 bg-red-500/5 shadow-xs'
                        : isWarning
                        ? 'border-amber-500/40 bg-amber-500/5 shadow-xs'
                        : 'border-border bg-card'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {item.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="h-12 w-12 rounded-xl object-cover border shrink-0"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-xl bg-muted border flex items-center justify-center shrink-0 text-muted-foreground">
                          <Package className="h-6 w-6" />
                        </div>
                      )}

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-sm text-foreground truncate">
                            {item.name}
                          </h4>
                          {item.sku && (
                            <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                              {item.sku}
                            </span>
                          )}
                          {isCritical ? (
                            <Badge className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 animate-pulse">
                              🔥 স্টক শেষ বা অতি সন্নিকটে
                            </Badge>
                          ) : isWarning ? (
                            <Badge className="bg-amber-600 text-white text-[10px] font-bold px-2 py-0.5">
                              ⚠️ সতর্কবার্তা
                            </Badge>
                          ) : item.urgency === 'HEALTHY' ? (
                            <Badge className="bg-emerald-600 text-white text-[10px] font-semibold px-2 py-0.5">
                              ✓ নিরাপদ স্টক
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              স্লো মুভিং
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span>
                            বর্তমান স্টক:{' '}
                            <strong className="text-foreground font-mono font-bold">
                              {item.stock_quantity} পিস
                            </strong>
                          </span>
                          <span>•</span>
                          <span>
                            দৈনিক সেলস রেট:{' '}
                            <strong className="text-amber-600 dark:text-amber-400 font-mono">
                              {item.daily_velocity} পিস/দিন
                            </strong>
                          </span>
                          <span>•</span>
                          <span>
                            বিগত ৩০ দিনে সেলস:{' '}
                            <strong className="text-foreground font-mono">
                              {item.sales_last_30d} টি
                            </strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0">
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] text-muted-foreground block uppercase tracking-wider font-semibold">
                          স্টক চলবে আনুমানিক
                        </span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span
                            className={`text-sm font-black font-mono ${
                              item.days_remaining === null
                                ? 'text-muted-foreground'
                                : item.days_remaining <= 3
                                ? 'text-red-600 dark:text-red-400'
                                : item.days_remaining <= 7
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {item.days_remaining === null
                              ? 'বিক্রয়হীন / আনলিমিটেড'
                              : item.days_remaining === 0
                              ? 'আজই শেষ!'
                              : `আর মাত্র ${item.days_remaining} দিন`}
                          </span>
                        </div>

                        {item.suggested_reorder_qty > 0 && (
                          <span className="text-[10px] text-purple-600 dark:text-purple-400 block mt-0.5 font-medium">
                            পরামর্শ: +{item.suggested_reorder_qty} পিস অর্ডার
                          </span>
                        )}
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          onQuickRestock({
                            id: item.id,
                            name: item.name,
                            stock_quantity: item.stock_quantity,
                          });
                        }}
                        className={`h-9 text-xs font-bold gap-1.5 shadow-xs ${
                          isCritical
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : isWarning
                            ? 'bg-amber-600 hover:bg-amber-700 text-white'
                            : 'bg-primary text-primary-foreground'
                        }`}
                      >
                        <Zap className="h-3.5 w-3.5" />
                        <span>রিস্টক করুন</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
