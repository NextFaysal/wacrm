'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  DollarSign,
  Package,
  Truck,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ShoppingBag,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  Calendar,
  Watch,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from 'recharts';

interface AnalyticsData {
  summary: {
    totalOrders: number;
    totalRevenue: number;
    deliveredRevenue: number;
    totalCost: number;
    totalProfit: number;
    deliveredProfit: number;
    profitMarginPct: number;
    averageOrderValue: number;
    deliveredCount: number;
    returnedCount: number;
    cancelledCount: number;
    inTransitCount: number;
    pendingCount: number;
    deliverySuccessRatio: number;
    returnRatePct: number;
  };
  topProducts: Array<{
    id: string;
    name: string;
    unitsSold: number;
    revenue: number;
    cost: number;
    profit: number;
    profitMarginPct: number;
    imageUrl: string;
    stock: number;
  }>;
  dailyTrend: Array<{
    date: string;
    revenue: number;
    profit: number;
    orders: number;
  }>;
  courierStats: {
    steadfast: { total: 0; delivered: 0; returned: 0; cancelled: 0; successRatio: number };
    pathao: { total: 0; delivered: 0; returned: 0; cancelled: 0; successRatio: number };
  };
  statusDonut: Array<{ name: string; count: number; color: string }>;
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<'7' | '30' | '90' | 'all'>('30');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/analytics/sales?range=${range}`);
      const json = await res.json();
      if (res.ok) {
        setData(json);
      }
    } catch (e) {
      console.error('Failed to load analytics', e);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const summary = data?.summary;
  const topProducts = data?.topProducts || [];
  const dailyTrend = data?.dailyTrend || [];
  const courierStats = data?.courierStats;
  const statusDonut = (data?.statusDonut || []).filter((s) => s.count > 0);

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header & Range Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Sales, Profit & Courier Analytics
            </h1>
            <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-xs">
              <TrendingUp className="mr-1 h-3 w-3" /> Live Report
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            কোন ঘড়ি সবচেয়ে বেশি বিক্রি হচ্ছে, মোট নিট মুনাফা ও ডেলিভারি সাকসেস রেশিও পর্যবেক্ষণ করুন।
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Timeframe pills */}
          <div className="flex rounded-lg border border-border bg-card p-1">
            {[
              { id: '7', label: '7 Days' },
              { id: '30', label: '30 Days' },
              { id: '90', label: '90 Days' },
              { id: 'all', label: 'All Time' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setRange(tab.id as '7' | '30' | '90' | 'all')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  range === tab.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={fetchAnalytics} disabled={loading} className="h-8">
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Link href="/orders">
            <Button size="sm" variant="secondary" className="h-8 text-xs gap-1.5">
              <ShoppingBag className="h-3.5 w-3.5" /> View Orders
            </Button>
          </Link>
        </div>
      </div>

      {/* Primary KPI Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Total Sales Revenue */}
        <Card className="border border-border/80 bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">মোট বিক্রি (Revenue)</p>
              <h3 className="text-2xl font-black text-foreground">
                ৳{(summary?.totalRevenue || 0).toLocaleString('en-BD')}
              </h3>
              <p className="text-[11px] text-emerald-500 font-medium">
                ডেলিভার্ড: ৳{(summary?.deliveredRevenue || 0).toLocaleString('en-BD')}
              </p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <DollarSign className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Total Net Profit */}
        <Card className="border border-border/80 bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">নিট লাভ (Net Profit)</p>
              <h3 className="text-2xl font-black text-emerald-500">
                ৳{(summary?.totalProfit || 0).toLocaleString('en-BD')}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                প্রফিট মার্জিন: <strong className="text-foreground">{summary?.profitMarginPct || 0}%</strong>
              </p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Delivery Success Ratio */}
        <Card className="border border-border/80 bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">ডেলিভারি সাকসেস রেট</p>
              <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {summary?.deliverySuccessRatio || 0}%
              </h3>
              <p className="text-[11px] text-muted-foreground">
                সফল: {summary?.deliveredCount || 0} | রিটার্ন: {summary?.returnedCount || 0}
              </p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Return Rate (RTO) */}
        <Card className="border border-border/80 bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">রিটার্ন রেট (RTO)</p>
              <h3 className="text-2xl font-black text-red-500">
                {summary?.returnRatePct || 0}%
              </h3>
              <p className="text-[11px] text-muted-foreground">
                রিটার্ন পার্সেল: {summary?.returnedCount || 0} টি
              </p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center">
              <RotateCcw className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Average Order Value */}
        <Card className="border border-border/80 bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">গড় অর্ডার মূল্য (AOV)</p>
              <h3 className="text-2xl font-black text-foreground">
                ৳{(summary?.averageOrderValue || 0).toLocaleString('en-BD')}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                মোট অর্ডার: {summary?.totalOrders || 0} টি
              </p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Package className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid: Revenue & Profit Trend (Left 8) + Courier Comparison (Right 4) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Daily Sales & Profit Trend */}
        <Card className="lg:col-span-8 border border-border">
          <CardHeader className="p-5 pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-foreground">
                  বিক্রি ও লাভের ট্রেন্ড (Sales & Profit Trend)
                </CardTitle>
                <CardDescription className="text-xs">
                  দৈনিক মোট বিক্রি ও নিট মুনাফার তুলনামূলক চার্ট
                </CardDescription>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                  <span className="text-muted-foreground">বিক্রি (Revenue)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span className="text-muted-foreground">লাভ (Profit)</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-2">
            {dailyTrend.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
                <TrendingUp className="h-10 w-10 stroke-[1] mb-2 opacity-50" />
                <p className="text-xs">এই সময়ের মধ্যে কোনো সেলস রেকর্ড পাওয়া যায়নি।</p>
              </div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis
                      dataKey="date"
                      stroke="#888888"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(d) => d.slice(5)}
                    />
                    <YAxis
                      stroke="#888888"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(val) => `৳${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#18181b',
                        borderColor: '#27272a',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      formatter={(value: any, name: any) => [
                        `৳${Number(value || 0).toLocaleString('en-BD')}`,
                        name === 'revenue' ? 'বিক্রি (Revenue)' : 'লাভ (Profit)',
                      ]}
                      labelFormatter={(label) => `তারিখ: ${label}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorRevenue)"
                    />
                    <Area
                      type="monotone"
                      dataKey="profit"
                      stroke="#10B981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorProfit)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Courier Performance Comparison */}
        <Card className="lg:col-span-4 border border-border">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" />
              কুরিয়ার পারফরম্যান্স (Courier Matrix)
            </CardTitle>
            <CardDescription className="text-xs">
              Steadfast বনাম Pathao ডেলিভারি রেশিও
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-4">
            {/* Steadfast Card */}
            <div className="rounded-xl border border-border p-3.5 bg-muted/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs uppercase text-foreground">Steadfast Courier</span>
                <Badge
                  className={`text-[10px] font-bold ${
                    (courierStats?.steadfast.successRatio || 0) >= 80
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  }`}
                  variant="outline"
                >
                  {courierStats?.steadfast.successRatio || 0}% Success
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
                <div className="p-1.5 rounded bg-background border border-border/50">
                  <span className="text-muted-foreground text-[10px] block">মোট পার্সেল</span>
                  <strong className="text-foreground">{courierStats?.steadfast.total || 0}</strong>
                </div>
                <div className="p-1.5 rounded bg-background border border-border/50">
                  <span className="text-emerald-500 text-[10px] block">ডেলিভার্ড</span>
                  <strong className="text-emerald-500">{courierStats?.steadfast.delivered || 0}</strong>
                </div>
                <div className="p-1.5 rounded bg-background border border-border/50">
                  <span className="text-red-500 text-[10px] block">রিটার্ন</span>
                  <strong className="text-red-500">{courierStats?.steadfast.returned || 0}</strong>
                </div>
              </div>
            </div>

            {/* Pathao Card */}
            <div className="rounded-xl border border-border p-3.5 bg-muted/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs uppercase text-foreground">Pathao Courier</span>
                <Badge
                  className={`text-[10px] font-bold ${
                    (courierStats?.pathao.successRatio || 0) >= 80
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  }`}
                  variant="outline"
                >
                  {courierStats?.pathao.successRatio || 0}% Success
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
                <div className="p-1.5 rounded bg-background border border-border/50">
                  <span className="text-muted-foreground text-[10px] block">মোট পার্সেল</span>
                  <strong className="text-foreground">{courierStats?.pathao.total || 0}</strong>
                </div>
                <div className="p-1.5 rounded bg-background border border-border/50">
                  <span className="text-emerald-500 text-[10px] block">ডেলিভার্ড</span>
                  <strong className="text-emerald-500">{courierStats?.pathao.delivered || 0}</strong>
                </div>
                <div className="p-1.5 rounded bg-background border border-border/50">
                  <span className="text-red-500 text-[10px] block">রিটার্ন</span>
                  <strong className="text-red-500">{courierStats?.pathao.returned || 0}</strong>
                </div>
              </div>
            </div>

            {/* Status Breakdown Bar */}
            <div className="pt-2">
              <span className="text-xs font-semibold text-muted-foreground block mb-2">
                অর্ডার স্ট্যাটাস বিভাজন:
              </span>
              <div className="space-y-1.5">
                {statusDonut.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-muted-foreground text-[11px]">{item.name}</span>
                    </div>
                    <span className="font-bold text-foreground text-xs">{item.count} টি</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Best Selling Watches Section */}
      <Card className="border border-border">
        <CardHeader className="p-5 pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Watch className="h-4 w-4 text-amber-500" />
              কোন ঘড়ি সবচেয়ে বেশি বিক্রি হচ্ছে (Top Selling Watches Ranking)
            </CardTitle>
            <CardDescription className="text-xs">
              সর্বোচ্চ বিক্রিত ঘড়িসমূহের তালিকা, বিক্রির পরিমাণ ও নিট মুনাফা
            </CardDescription>
          </div>
          <Link href="/products">
            <Button variant="ghost" size="sm" className="text-xs gap-1">
              Manage Products <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          {topProducts.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Watch className="mx-auto h-12 w-12 opacity-40 mb-2" />
              <p className="text-xs">এখনো কোনো ঘড়ি বিক্রির ডেটা নেই।</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-muted-foreground">
                    <th className="py-2.5 px-3 font-semibold">র‌্যাংক</th>
                    <th className="py-2.5 px-3 font-semibold">ঘড়ির মডেল ও ছবি</th>
                    <th className="py-2.5 px-3 font-semibold text-center">বিক্রিত সংখ্যা</th>
                    <th className="py-2.5 px-3 font-semibold text-right">মোট বিক্রি</th>
                    <th className="py-2.5 px-3 font-semibold text-right">নিট লাভ (Profit)</th>
                    <th className="py-2.5 px-3 font-semibold text-center">মার্জিন</th>
                    <th className="py-2.5 px-3 font-semibold text-right">বর্তমান স্টক</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {topProducts.map((p, idx) => (
                    <tr key={p.name} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold ${
                            idx === 0
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                              : idx === 1
                              ? 'bg-slate-300/20 text-slate-300 border border-slate-300/40'
                              : idx === 2
                              ? 'bg-amber-700/20 text-amber-600 border border-amber-700/40'
                              : 'text-muted-foreground'
                          }`}
                        >
                          #{idx + 1}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3">
                          {p.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              className="h-10 w-10 rounded-lg object-cover border border-border"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                              <Watch className="h-5 w-5" />
                            </div>
                          )}
                          <div>
                            <span className="font-bold text-foreground text-sm block">
                              {p.name}
                            </span>
                            <span className="text-[11px] text-muted-foreground font-mono">
                              ID: {p.id ? p.id.slice(0, 8) : 'Direct'}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className="font-black text-sm text-foreground bg-primary/10 text-primary px-2.5 py-1 rounded-md">
                          {p.unitsSold} টি
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right font-bold text-foreground font-mono text-sm">
                        ৳{p.revenue.toLocaleString('en-BD')}
                      </td>

                      <td className="py-3 px-3 text-right font-black text-emerald-500 font-mono text-sm">
                        ৳{p.profit.toLocaleString('en-BD')}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <Badge
                          variant="outline"
                          className="border-emerald-500/40 text-emerald-400 font-bold text-[11px]"
                        >
                          {p.profitMarginPct}%
                        </Badge>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <span
                          className={`font-semibold text-xs ${
                            p.stock <= 3
                              ? 'text-red-500 font-bold'
                              : p.stock <= 10
                              ? 'text-amber-500'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {p.stock} pcs বাকি
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
