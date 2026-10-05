'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Truck,
  RotateCcw,
  RefreshCw,
  Sparkles,
  Zap,
  Target,
  MessageSquare,
  ArrowUpRight,
  ShieldAlert,
  ShieldCheck,
  Send,
  HelpCircle,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  FileText,
  Share2,
  Radio,
  Sliders,
  FlaskConical,
  Activity,
  Users,
  MapPin,
  Package,
  CalendarDays,
  ArrowDownRight,
  BellRing,
  X,
  MessageCircle,
  Download,
  Award,
  Search,
  CreditCard,
} from 'lucide-react';
import { toast } from 'sonner';
import { CustomerJourneyModal } from '@/components/growth/customer-journey-modal';
import { ExperimentCreatorDialog } from '@/components/growth/experiment-creator-dialog';
import { PixelSetupDialog } from '@/components/growth/pixel-setup-dialog';
import { CatalogAdStudioDialog } from '@/components/growth/catalog-ad-studio-dialog';

export default function GrowthIntelligencePage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'weekly' | 'monthly' | 'conversations' | 'geo' | 'products' | 'rules' | 'billing' | 'experiments'>('overview');
  const [loading, setLoading] = useState(true);

  // Data states
  const [overview, setOverview] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [liveData, setLiveData] = useState<any>(null);
  const [geoData, setGeoData] = useState<any>(null);
  const [productData, setProductData] = useState<any>(null);
  const [weeklyData, setWeeklyData] = useState<any>(null);
  const [monthlyData, setMonthlyData] = useState<any>(null);
  const [convData, setConvData] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [billingData, setBillingData] = useState<any>(null);
  const [experimentsData, setExperimentsData] = useState<any[]>([]);
  const [creativeHealthData, setCreativeHealthData] = useState<any>(null);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [pixelModalOpen, setPixelModalOpen] = useState(false);
  const [catalogStudioOpen, setCatalogStudioOpen] = useState(false);
  const [selectedStudioProduct, setSelectedStudioProduct] = useState<any>(null);

  // Action states
  const [sendingBriefing, setSendingBriefing] = useState(false);
  const [runningRules, setRunningRules] = useState(false);
  const [syncingAds, setSyncingAds] = useState(false);

  // Customer Journey Modal state
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [journeyContactId, setJourneyContactId] = useState<string | null>(null);
  const [journeySearchInput, setJourneySearchInput] = useState('');

  // Command Center state
  const [question, setQuestion] = useState('');
  const [askingAi, setAskingAi] = useState(false);
  const [aiResponse, setAiResponse] = useState<{ answer: string; category: string } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [overviewRes, reportRes, liveRes, geoRes, prodRes, weeklyRes, monthlyRes, convRes, alertsRes, billingRes, expRes, healthRes] = await Promise.all([
        fetch('/api/marketing/overview'),
        fetch('/api/ai/growth-report'),
        fetch('/api/analytics/live-visitors'),
        fetch('/api/analytics/geographic'),
        fetch('/api/analytics/product-matrix'),
        fetch('/api/ai/weekly-consultant'),
        fetch('/api/ai/monthly-report'),
        fetch('/api/ai/conversations/analytics'),
        fetch('/api/ai/alerts'),
        fetch('/api/billing'),
        fetch('/api/marketing/experiments'),
        fetch('/api/marketing/creative-health'),
      ]);

      if (overviewRes.ok) setOverview(await overviewRes.json());
      if (reportRes.ok) setReport(await reportRes.json());
      if (liveRes.ok) setLiveData(await liveRes.json());
      if (geoRes.ok) setGeoData(await geoRes.json());
      if (prodRes.ok) setProductData(await prodRes.json());
      if (weeklyRes.ok) setWeeklyData(await weeklyRes.json());
      if (monthlyRes.ok) setMonthlyData(await monthlyRes.json());
      if (convRes.ok) setConvData(await convRes.json());
      if (alertsRes.ok) {
        const alData = await alertsRes.json();
        setAlerts(alData.alerts || []);
      }
      if (billingRes.ok) setBillingData(await billingRes.json());
      if (expRes.ok) {
        const expData = await expRes.json();
        setExperimentsData(expData.experiments || []);
      }
      if (healthRes.ok) {
        setCreativeHealthData(await healthRes.json());
      }
    } catch (err) {
      console.error('Failed to load growth intelligence:', err);
      toast.error('ডেটা লোড করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();

    // Auto-refresh live visitors stream every 20 seconds
    const interval = setInterval(async () => {
      try {
        const liveRes = await fetch('/api/analytics/live-visitors');
        if (liveRes.ok) {
          const freshLive = await liveRes.json();
          setLiveData(freshLive);
        }
      } catch {}
    }, 20000);

    return () => clearInterval(interval);
  }, [fetchData]);

  const handleDismissAlert = async (alertId: string) => {
    try {
      await fetch('/api/ai/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId }),
      });
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      toast.success('অ্যালার্ট ডিসমিস করা হয়েছে');
    } catch (e) {
      // ignore
    }
  };

  const handleAskCommandCenter = async (queryToAsk?: string) => {
    const q = queryToAsk || question;
    if (!q.trim()) return;

    try {
      setAskingAi(true);
      const res = await fetch('/api/ai/command-center', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (res.ok) {
        setAiResponse(data);
      } else {
        toast.error(data.error || 'Failed to process AI query');
      }
    } catch (err) {
      toast.error('AI রেসপন্স পেতে ত্রুটি হয়েছে');
    } finally {
      setAskingAi(false);
    }
  };

  const handleSendWhatsAppBriefing = async () => {
    try {
      setSendingBriefing(true);
      const res = await fetch('/api/ai/briefing/send-whatsapp', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast.success('হোয়াটসঅ্যাপ ব্রিফিং সফলভাবে প্রস্তুত ও পাঠানো হয়েছে!');
      } else {
        toast.error(data.error || 'ব্রিফিং পাঠাতে ব্যর্থ হয়েছে');
      }
    } catch (err) {
      toast.error('হোয়াটসঅ্যাপ ব্রিফিং পাঠাতে সমস্যা হয়েছে');
    } finally {
      setSendingBriefing(false);
    }
  };

  const handleRunAdRules = async () => {
    try {
      setRunningRules(true);
      const res = await fetch('/api/marketing/rules', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast.success(`অটো-রুলস মূল্যায়ন সম্পন্ন! CAPI সিঙ্ক: ${data.syncedDeliveriesToCAPI} টি অর্ডার`);
      } else {
        toast.error(data.error || 'রুলস এক্সিকিউট করতে ব্যর্থ হয়েছে');
      }
    } catch (err) {
      toast.error('অটো-রুলস এক্সিকিউট করতে সমস্যা হয়েছে');
    } finally {
      setRunningRules(false);
    }
  };

  const handleSyncAds = async () => {
    try {
      setSyncingAds(true);
      const res = await fetch('/api/marketing/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast.success('অ্যাড নেটওয়ার্ক ডেটা সিঙ্ক সম্পন্ন হয়েছে (Google & TikTok)');
        void fetchData();
      } else {
        toast.error(data.error || 'সিঙ্ক করতে সমস্যা হয়েছে');
      }
    } catch (err) {
      toast.error('অ্যাড ডেটা সিঙ্ক করতে ব্যর্থ হয়েছে');
    } finally {
      setSyncingAds(false);
    }
  };

  const handleUpgradePlan = async (tier: string) => {
    try {
      const res = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planTier: tier }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`প্ল্যান সফলভাবে ${tier.toUpperCase()} এ আপগ্রেড করা হয়েছে!`);
        void fetchData();
      } else {
        toast.error(data.error || 'প্ল্যান আপডেট করতে ব্যর্থ হয়েছে');
      }
    } catch (err) {
      toast.error('প্ল্যান আপগ্রেড করতে সমস্যা হয়েছে');
    }
  };

  const handleConcludeExperiment = async (expId: string) => {
    try {
      const res = await fetch(`/api/marketing/experiments/${expId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'concluded' }),
      });
      if (res.ok) {
        toast.success('এক্সপেরিমেন্ট সমাপ্ত ঘোষণা করা হয়েছে!');
        void fetchData();
      } else {
        toast.error('সমস্যা হয়েছে');
      }
    } catch (e) {
      toast.error('সমস্যা হয়েছে');
    }
  };

  const totals = overview?.totals || {
    totalSpend: 0,
    totalDeliveredRevenue: 0,
    totalOrders: 0,
    totalDeliveredOrders: 0,
    overallTrueROAS: 0,
    overallTrueCAC: 0,
    deliveryRate: 0,
  };

  return (
    <div className="space-y-6 p-4 md:p-8 max-w-7xl mx-auto">
      {/* Real-Time Anomaly Alert Banner */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((al) => (
            <div
              key={al.id}
              className={`p-3.5 rounded-lg border flex items-center justify-between text-xs transition-all ${
                al.severity === 'critical'
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-500'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <BellRing className="w-4 h-4 shrink-0 animate-bounce" />
                <div>
                  <strong className="font-semibold text-foreground">{al.headline}</strong>
                  <p className="text-muted-foreground mt-0.5">{al.details}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleDismissAlert(al.id)}
                className="h-7 px-2 text-xs"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Header & Executive Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Growth & Marketing Intelligence</h1>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
              <Sparkles className="w-3 h-3 mr-1" /> AI Powered
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            End-to-End First-Party Tracking, Multi-Channel Ad Attribution, and AI Business Consultant
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleSendWhatsAppBriefing()}
            disabled={sendingBriefing}
            className="gap-1.5 border-emerald-500/30 hover:bg-emerald-500/10 text-foreground"
          >
            <MessageSquare className="w-4 h-4 text-emerald-500" />
            {sendingBriefing ? 'Sending...' : 'WhatsApp Briefing'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('/api/ai/briefing/export-report', '_blank')}
            className="gap-1.5 text-foreground"
          >
            <FileText className="w-4 h-4 text-primary" />
            Executive PDF Report
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('/api/analytics/custom-report?format=csv', '_blank')}
            className="gap-1.5 text-foreground"
          >
            <Download className="w-4 h-4 text-emerald-500" />
            Export CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedStudioProduct({ name: 'হট সেলিং প্রোডাক্ট', category: 'General' });
              setCatalogStudioOpen(true);
            }}
            className="gap-1.5 border-violet-500/30 hover:bg-violet-500/10 text-foreground"
          >
            <Sparkles className="w-4 h-4 text-violet-500" />
            Catalog Ad Studio
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setPixelModalOpen(true)}
            className="gap-1.5 border-indigo-500/30 hover:bg-indigo-500/10 text-foreground"
          >
            <Radio className="w-4 h-4 text-indigo-500 animate-pulse" />
            Install Pixel
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleSyncAds()}
            disabled={syncingAds}
            className="gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 text-blue-500 ${syncingAds ? 'animate-spin' : ''}`} />
            {syncingAds ? 'Syncing...' : 'Sync Ad Networks'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleRunAdRules()}
            disabled={runningRules}
            className="gap-1.5"
          >
            <Zap className={`w-4 h-4 text-amber-500 ${runningRules ? 'animate-spin' : ''}`} />
            Auto-Pilot Rules
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => void fetchData()}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-6">
        <TabsList className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 max-w-7xl">
          <TabsTrigger value="overview" className="gap-1.5 text-xs">
            <TrendingUp className="w-3.5 h-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="weekly" className="gap-1.5 text-xs">
            <CalendarDays className="w-3.5 h-3.5" /> Weekly
          </TabsTrigger>
          <TabsTrigger value="monthly" className="gap-1.5 text-xs">
            <Award className="w-3.5 h-3.5" /> Monthly Audit
          </TabsTrigger>
          <TabsTrigger value="conversations" className="gap-1.5 text-xs">
            <MessageCircle className="w-3.5 h-3.5" /> Conversation AI
          </TabsTrigger>
          <TabsTrigger value="geo" className="gap-1.5 text-xs">
            <MapPin className="w-3.5 h-3.5" /> Geographic
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-1.5 text-xs">
            <Package className="w-3.5 h-3.5" /> Product Matrix
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-1.5 text-xs">
            <Zap className="w-3.5 h-3.5" /> Ad Rules
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-1.5 text-xs">
            <CreditCard className="w-3.5 h-3.5" /> Plans & Quota
          </TabsTrigger>
          <TabsTrigger value="experiments" className="gap-1.5 text-xs">
            <FlaskConical className="w-3.5 h-3.5" /> A/B Testing
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: OVERVIEW */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="p-3 pb-1">
                <CardDescription className="text-xs font-medium">Delivered Revenue</CardDescription>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="text-xl font-bold text-foreground">
                  ৳{totals.totalDeliveredRevenue.toLocaleString()}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {totals.totalDeliveredOrders} orders delivered
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-sm">
              <CardHeader className="p-3 pb-1">
                <CardDescription className="text-xs font-medium">Total Ad Spend</CardDescription>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="text-xl font-bold text-foreground">
                  ৳{totals.totalSpend.toLocaleString()}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Meta, Google & TikTok</p>
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-sm">
              <CardHeader className="p-3 pb-1">
                <CardDescription className="text-xs font-medium">True ROAS</CardDescription>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className={`text-xl font-bold ${totals.overallTrueROAS >= 3 ? 'text-emerald-500' : 'text-amber-500'}`}>
                  {totals.overallTrueROAS}x
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Delivered Rev / Spend</p>
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-sm">
              <CardHeader className="p-3 pb-1">
                <CardDescription className="text-xs font-medium">True Delivered CAC</CardDescription>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="text-xl font-bold text-foreground">
                  ৳{totals.overallTrueCAC.toLocaleString()}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Spend / Delivered Order</p>
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-sm">
              <CardHeader className="p-3 pb-1">
                <CardDescription className="text-xs font-medium">Delivery Completion</CardDescription>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className={`text-xl font-bold ${totals.deliveryRate >= 80 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {totals.deliveryRate}%
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Courier success ratio</p>
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-sm">
              <CardHeader className="p-3 pb-1">
                <CardDescription className="text-xs font-medium">WhatsApp Chats</CardDescription>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="text-xl font-bold text-foreground">
                  {report?.summary.messages || 0}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Customer inquiries</p>
              </CardContent>
            </Card>
          </div>

          {/* AI Command Center */}
          <Card className="border-primary/30 bg-primary/[0.02]">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">AI Growth Command Center</CardTitle>
              </div>
              <CardDescription>
                Ask anything about your marketing campaigns, orders, courier returns, or customer conversations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="e.g., Why did sales drop yesterday? Which channel gave best ROAS? What are customers saying on WhatsApp?"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleAskCommandCenter();
                  }}
                  disabled={askingAi}
                />
                <Button
                  onClick={() => void handleAskCommandCenter()}
                  disabled={askingAi || !question.trim()}
                  className="gap-2"
                >
                  <Send className="w-4 h-4" />
                  {askingAi ? 'Analyzing...' : 'Ask AI'}
                </Button>
              </div>

              {aiResponse && (
                <div className="mt-4 p-4 rounded-lg bg-card border border-border space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs">
                      {aiResponse.category}
                    </Badge>
                    <span className="text-xs text-muted-foreground">AI Intelligence Response</span>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                    {aiResponse.answer}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Attribution Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                Multi-Channel Ad Attribution & Discrepancy Reconciliation
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Comparing Advertising Platform Claims vs. True Internal Delivered Sales & Cash-in-Hand ROAS
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-2.5 px-3 font-semibold">Channel</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Ad Spend</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Clicks</th>
                      <th className="py-2.5 px-3 font-semibold text-right">CPC</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Ad Claimed</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Delivered</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Discrepancy (Δ)</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Delivered Rev</th>
                      <th className="py-2.5 px-3 font-semibold text-right">True CAC</th>
                      <th className="py-2.5 px-3 font-semibold text-right">True ROAS</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Delivery %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {(overview?.channels || []).map((ch: any, i: number) => (
                      <tr key={i} className="hover:bg-muted/40 transition-colors">
                        <td className="py-3 px-3 font-medium text-foreground">{ch.channel}</td>
                        <td className="py-3 px-3 text-right">৳{ch.adSpend.toLocaleString()}</td>
                        <td className="py-3 px-3 text-right">{ch.clicks.toLocaleString()}</td>
                        <td className="py-3 px-3 text-right">৳{ch.cpc}</td>
                        <td className="py-3 px-3 text-right text-muted-foreground font-mono">{ch.platformReportedConversions}</td>
                        <td className="py-3 px-3 text-right font-semibold text-foreground font-mono">{ch.internalDeliveredOrders}</td>
                        <td className="py-3 px-3 text-right">
                          {ch.discrepancy > 0 ? (
                            <span className="text-amber-500 font-medium">+{ch.discrepancy} Ghost</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-medium text-foreground">৳{ch.internalDeliveredRevenue.toLocaleString()}</td>
                        <td className="py-3 px-3 text-right font-mono font-medium text-foreground">
                          {ch.trueCAC > 0 ? `৳${ch.trueCAC.toLocaleString()}` : '—'}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <Badge variant="outline" className={`text-xs ${ch.trueROAS >= 3 ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : 'bg-muted text-muted-foreground'}`}>
                            {ch.trueROAS}x
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-right text-foreground">{ch.deliverySuccessRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Live Tracking & Customer Journey Explorer */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1 border-border/60 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-rose-500 animate-pulse" />
                    <CardTitle className="text-base font-semibold">Live Traffic Pulse</CardTitle>
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-rose-500/10 text-rose-500 border-rose-500/30">
                    Active Now
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Real-time storefront visitors in the last 15 minutes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-3 bg-muted/40 rounded-lg">
                    <p className="text-[11px] text-muted-foreground">Visitors</p>
                    <p className="text-lg font-bold text-foreground">{liveData?.activeVisitors || 0}</p>
                  </div>
                  <div className="p-3 bg-muted/40 rounded-lg">
                    <p className="text-[11px] text-muted-foreground">In Cart</p>
                    <p className="text-lg font-bold text-amber-500">{liveData?.activeCarts || 0}</p>
                  </div>
                  <div className="p-3 bg-muted/40 rounded-lg">
                    <p className="text-[11px] text-muted-foreground">Checkout</p>
                    <p className="text-lg font-bold text-emerald-500">{liveData?.activeCheckouts || 0}</p>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <span className="text-xs font-semibold text-foreground">Recent Event Stream</span>
                  <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                    {(liveData?.recentEvents || []).slice(0, 5).map((ev: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/30 text-xs">
                        <span className="font-medium text-foreground">{ev.event_name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {new Date(ev.event_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                    {(!liveData?.recentEvents || liveData.recentEvents.length === 0) && (
                      <p className="text-xs text-muted-foreground text-center py-4">Waiting for first-party events...</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 border-border/60 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  <CardTitle className="text-base font-semibold">Inspect Customer Journey & Attribution</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Search any customer by phone number or contact ID to see their full multi-touch timeline (Ad Click → Web Visits → WhatsApp CRM → Courier Delivery).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter customer phone (e.g., 01712345678) or Contact ID"
                    value={journeySearchInput}
                    onChange={(e) => setJourneySearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && journeySearchInput.trim()) {
                        setJourneyContactId(journeySearchInput.trim());
                        setJourneyOpen(true);
                      }
                    }}
                  />
                  <Button
                    onClick={() => {
                      if (journeySearchInput.trim()) {
                        setJourneyContactId(journeySearchInput.trim());
                        setJourneyOpen(true);
                      }
                    }}
                    disabled={!journeySearchInput.trim()}
                    className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
                  >
                    <Search className="w-4 h-4" />
                    Inspect Journey
                  </Button>
                </div>

                <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent border border-indigo-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-foreground">Multi-Touch Attribution Advantage</p>
                    <p className="text-xs text-muted-foreground max-w-lg">
                      Ad platforms claim credit for the same buyer multiple times. Our first-party tracking links their true ad touchpoint, WhatsApp conversation, and courier delivery to establish authentic cash-in-hand ROAS.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (journeySearchInput.trim()) {
                        setJourneyContactId(journeySearchInput.trim());
                      } else {
                        setJourneyContactId('demo');
                      }
                      setJourneyOpen(true);
                    }}
                    className="shrink-0 text-xs text-indigo-500 border-indigo-500/30 hover:bg-indigo-500/10"
                  >
                    Try Sample Journey
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 2: WEEKLY CONSULTANT */}
        <TabsContent value="weekly" className="space-y-6">
          {weeklyData && (
            <div className="space-y-6">
              <Card className="border-primary/40 bg-primary/[0.02]">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-primary" />
                      <CardTitle className="text-lg">Executive Weekly Business Consultant</CardTitle>
                    </div>
                    <Badge variant="outline">{weeklyData.period.thisWeek}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-foreground leading-relaxed font-medium">
                    {weeklyData.executiveSummary}
                  </p>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-emerald-500/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-emerald-500 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> What Improved
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {weeklyData.whatImproved.map((item: string, i: number) => (
                      <p key={i} className="text-xs text-foreground">✅ {item}</p>
                    ))}
                  </CardContent>
                </Card>

                <Card className="border-rose-500/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-rose-500 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> What Declined
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {weeklyData.whatDeclined.map((item: string, i: number) => (
                      <p key={i} className="text-xs text-foreground">⚠️ {item}</p>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        {/* TAB 3: MONTHLY AUDIT */}
        <TabsContent value="monthly" className="space-y-6">
          {monthlyData && (
            <div className="space-y-6">
              <Card className="border-primary/40 bg-primary/[0.02]">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-primary" />
                      <CardTitle className="text-lg">{monthlyData.monthName} Executive Financial Audit</CardTitle>
                    </div>
                    <Badge variant="outline">Verified 30-Day Close</Badge>
                  </div>
                  <CardDescription>{monthlyData.executiveSummary}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg border bg-card">
                      <span className="text-xs text-muted-foreground">Monthly Delivered Rev</span>
                      <div className="text-lg font-bold text-foreground mt-1">
                        ৳{monthlyData.financials.deliveredRevenue.toLocaleString()}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg border bg-card">
                      <span className="text-xs text-muted-foreground">Estimated Net Profit</span>
                      <div className="text-lg font-bold text-emerald-500 mt-1">
                        ৳{monthlyData.financials.estimatedNetProfit.toLocaleString()} ({monthlyData.financials.netProfitMarginPct}%)
                      </div>
                    </div>
                    <div className="p-3 rounded-lg border bg-card">
                      <span className="text-xs text-muted-foreground">Returning Buyers Ratio</span>
                      <div className="text-lg font-bold text-primary mt-1">
                        {monthlyData.customerMetrics.returningCustomerRatioPct}%
                      </div>
                    </div>
                    <div className="p-3 rounded-lg border bg-card">
                      <span className="text-xs text-muted-foreground">True Monthly ROAS</span>
                      <div className="text-lg font-bold text-foreground mt-1">
                        {monthlyData.financials.trueMonthlyROAS}x
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Strategic Roadmap Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">30-Day Growth Roadmap & Next Month Theme</CardTitle>
                  <CardDescription>Focus: {monthlyData.strategicRoadmap.monthTheme}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-3 rounded-lg border border-primary/30 bg-primary/[0.02]">
                    <strong className="text-xs text-primary font-bold">Primary Growth Lever:</strong>
                    <p className="text-xs text-foreground mt-0.5">{monthlyData.strategicRoadmap.primaryGrowthLever}</p>
                  </div>

                  <div className="space-y-1.5">
                    <strong className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Key Directives:</strong>
                    {monthlyData.strategicRoadmap.threeKeyDirectives.map((dir: string, i: number) => (
                      <p key={i} className="text-xs text-foreground flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        {dir}
                      </p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* TAB 4: CONVERSATION AI */}
        <TabsContent value="conversations" className="space-y-6">
          {convData && (
            <div className="space-y-6">
              <Card className="border-primary/30 bg-primary/[0.02]">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Conversational Intelligence Insight</CardTitle>
                  <CardDescription>{convData.executiveAiSummary}</CardDescription>
                </CardHeader>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs font-semibold">Price Objections</CardDescription>
                    <CardTitle className="text-2xl font-bold text-amber-500">
                      {convData.priceObjectionPct}%
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    Customers asking for discounts or lower price
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs font-semibold">Delivery Objections</CardDescription>
                    <CardTitle className="text-2xl font-bold text-primary">
                      {convData.deliveryObjectionPct}%
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    Hesitation over shipping fees outside Dhaka
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs font-semibold">Chat-to-Order Conversion</CardDescription>
                    <CardTitle className="text-2xl font-bold text-emerald-500">
                      {convData.chatToOrderConversionPct}%
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    Conversations resulting in confirmed orders
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        {/* TAB 5: GEOGRAPHIC */}
        <TabsContent value="geo" className="space-y-6">
          {geoData && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Regional Performance Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="py-2.5 px-3 font-semibold">Division</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Traffic</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Orders</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Delivered Rev</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Conversion %</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Delivery %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {geoData.locations.map((loc: any, i: number) => (
                        <tr key={i} className="hover:bg-muted/40 transition-colors">
                          <td className="py-3 px-3 font-medium text-foreground">{loc.location}</td>
                          <td className="py-3 px-3 text-right">{loc.traffic}</td>
                          <td className="py-3 px-3 text-right font-semibold">{loc.orders}</td>
                          <td className="py-3 px-3 text-right">৳{loc.deliveredRevenue.toLocaleString()}</td>
                          <td className="py-3 px-3 text-right">{loc.conversionRate}%</td>
                          <td className="py-3 px-3 text-right">{loc.deliveryRate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* TAB 6: PRODUCT MATRIX */}
        <TabsContent value="products" className="space-y-6">
          {productData && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-emerald-500/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-emerald-500">
                    🏆 Cash Cows ({productData.cashCows.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {productData.cashCows.map((p: any, i: number) => (
                    <div key={i} className="text-xs border-b border-border/40 pb-2">
                      <strong className="text-foreground">{p.name}</strong>
                      <div className="text-muted-foreground flex justify-between mt-0.5">
                        <span>{p.purchases} sales</span>
                        <span className="font-semibold text-emerald-500">{p.conversionRate}% conv</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-primary/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-primary">
                    💎 Hidden Gems ({productData.hiddenGems.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {productData.hiddenGems.map((p: any, i: number) => (
                    <div key={i} className="text-xs border-b border-border/40 pb-2">
                      <strong className="text-foreground">{p.name}</strong>
                      <div className="text-muted-foreground flex justify-between mt-0.5">
                        <span>{p.purchases} sales</span>
                        <span className="font-semibold text-primary">{p.conversionRate}% conv</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-amber-500/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-amber-500">
                    ⚠️ Traffic Wasters ({productData.trafficWasters.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {productData.trafficWasters.map((p: any, i: number) => (
                    <div key={i} className="text-xs border-b border-border/40 pb-2">
                      <strong className="text-foreground">{p.name}</strong>
                      <div className="text-muted-foreground flex justify-between mt-0.5">
                        <span>{p.views} views</span>
                        <span className="font-semibold text-amber-500">{p.conversionRate}% conv</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* TAB 7: AD RULES */}
        <TabsContent value="rules" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Auto-Pilot Stop-Loss & Scaling Rules</CardTitle>
                </div>
                <Button size="sm" onClick={() => void handleRunAdRules()} disabled={runningRules} className="gap-2">
                  <Zap className="w-4 h-4" />
                  Evaluate Rules Now
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border border-rose-500/30 bg-rose-500/[0.02] space-y-2">
                  <div className="flex items-center gap-2 text-rose-500 font-semibold text-sm">
                    <ShieldAlert className="w-4 h-4" />
                    Stop-Loss Rule (Kill Losers)
                  </div>
                  <p className="text-xs text-muted-foreground">
                    If spend reaches ৳1,500 with 0 delivered orders, alerts immediately.
                  </p>
                </div>

                <div className="p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.02] space-y-2">
                  <div className="flex items-center gap-2 text-emerald-500 font-semibold text-sm">
                    <ShieldCheck className="w-4 h-4" />
                    Scaling Winner Rule (Scale Winners)
                  </div>
                  <p className="text-xs text-muted-foreground">
                    If True ROAS &gt; 4.0x with &gt;80% delivery completion, alerts to scale budget.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ad Creative Health & Fatigue Diagnostic */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <CardTitle className="text-base font-semibold">Ad Creative Health & Fatigue Diagnostic</CardTitle>
                  </div>
                  <CardDescription className="text-xs">
                    Detects audience saturation when frequency &gt; 3.0x and CTR decays, generating fresh AI hook angles in Bengali & English.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    Avg Frequency: {creativeHealthData?.averageFrequency || 1.8}x
                  </Badge>
                  <Badge className="bg-rose-500/10 text-rose-500 border-rose-500/30 text-xs">
                    {creativeHealthData?.fatiguedCount || 0} Fatigued
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(creativeHealthData?.analyzedCampaigns || []).map((ad: any, i: number) => {
                  const isFatigued = ad.healthStatus === 'fatigued';
                  return (
                    <div
                      key={i}
                      className={`p-4 rounded-xl border space-y-3 ${
                        isFatigued
                          ? 'border-rose-500/40 bg-rose-500/[0.02]'
                          : 'border-border/60 bg-card'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] uppercase font-mono font-bold text-muted-foreground">
                            {ad.platform} • {ad.status}
                          </span>
                          <h5 className="text-xs font-bold text-foreground mt-0.5">{ad.campaignName}</h5>
                        </div>
                        <Badge
                          className={`text-[10px] ${
                            isFatigued
                              ? 'bg-rose-500 text-white'
                              : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                          }`}
                        >
                          {isFatigued ? 'Fatigued ⚠️' : 'Healthy ✅'}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs py-2 border-y border-border/40">
                        <div>
                          <p className="text-[10px] text-muted-foreground">Spend</p>
                          <p className="font-semibold text-foreground font-mono">৳{ad.spend?.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Frequency</p>
                          <p className={`font-semibold font-mono ${ad.frequency >= 3.0 ? 'text-rose-500' : 'text-foreground'}`}>
                            {ad.frequency}x
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">CTR</p>
                          <p className="font-semibold text-foreground font-mono">{ad.ctr}%</p>
                        </div>
                      </div>

                      {ad.fatigueReason && (
                        <p className="text-[11px] text-rose-500 bg-rose-500/10 p-2 rounded">
                          {ad.fatigueReason}
                        </p>
                      )}

                      {/* AI Hook Suggestions */}
                      {ad.suggestedHooks && ad.suggestedHooks.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-indigo-500" /> AI Refresh Hook:
                          </span>
                          <div className="p-2.5 rounded bg-muted/40 text-[11px] space-y-1 border border-border/40">
                            <p className="text-foreground font-medium">"{ad.suggestedHooks[0].hookTextBn}"</p>
                            <p className="text-muted-foreground italic">"{ad.suggestedHooks[0].hookTextEn}"</p>
                            <p className="text-[10px] text-indigo-600 font-semibold pt-1">
                              CTA: {ad.suggestedHooks[0].callToAction}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 8: PLANS & BILLING */}
        <TabsContent value="billing" className="space-y-6">
          {billingData && (
            <div className="space-y-6">
              {/* Active Plan Overview */}
              <Card className="border-indigo-500/30 bg-gradient-to-r from-indigo-500/[0.05] via-purple-500/[0.03] to-transparent">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-indigo-500" />
                        <CardTitle className="text-lg">Subscription & Usage Quotas</CardTitle>
                        <Badge className="bg-indigo-500/10 text-indigo-500 border-indigo-500/30 uppercase font-mono text-xs">
                          {billingData.currentPlan?.tier} PLAN
                        </Badge>
                      </div>
                      <CardDescription className="text-xs mt-1">
                        Status: <span className="text-emerald-500 font-semibold uppercase">{billingData.currentPlan?.status}</span> • Quota resets monthly
                      </CardDescription>
                    </div>

                    <div className="text-right sm:text-right">
                      <div className="text-2xl font-bold text-foreground">
                        ৳{billingData.currentPlan?.limits?.priceBdt?.toLocaleString()} <span className="text-xs text-muted-foreground font-normal">/ month</span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-3.5 bg-background rounded-xl border border-border/60">
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-muted-foreground font-medium">Monthly Orders Tracked</span>
                        <span className="font-semibold text-foreground font-mono">
                          {billingData.currentPlan?.usage?.orders || 0} / {billingData.currentPlan?.limits?.maxMonthlyOrders === -1 ? 'Unlimited' : billingData.currentPlan?.limits?.maxMonthlyOrders}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all"
                          style={{
                            width: `${billingData.currentPlan?.limits?.maxMonthlyOrders === -1 ? 15 : Math.min(100, ((billingData.currentPlan?.usage?.orders || 0) / (billingData.currentPlan?.limits?.maxMonthlyOrders || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="p-3.5 bg-background rounded-xl border border-border/60">
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-muted-foreground font-medium">Tracking Sessions</span>
                        <span className="font-semibold text-foreground font-mono">
                          {billingData.currentPlan?.usage?.sessions || 0} / {billingData.currentPlan?.limits?.maxMonthlySessions === -1 ? 'Unlimited' : billingData.currentPlan?.limits?.maxMonthlySessions?.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full transition-all"
                          style={{
                            width: `${billingData.currentPlan?.limits?.maxMonthlySessions === -1 ? 12 : Math.min(100, ((billingData.currentPlan?.usage?.sessions || 0) / (billingData.currentPlan?.limits?.maxMonthlySessions || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="p-3.5 bg-background rounded-xl border border-border/60">
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-muted-foreground font-medium">Connected Ad Accounts</span>
                        <span className="font-semibold text-foreground font-mono">
                          {billingData.currentPlan?.limits?.maxAdAccounts === -1 ? 'Unlimited' : `${billingData.currentPlan?.limits?.maxAdAccounts} Accounts`}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full w-2/5" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tier Cards Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {(billingData.availablePlans || []).map((p: any) => {
                  const isCurrent = billingData.currentPlan?.tier === p.id;
                  return (
                    <Card
                      key={p.id}
                      className={`relative flex flex-col justify-between transition-all ${
                        isCurrent
                          ? 'border-indigo-500 shadow-md ring-1 ring-indigo-500'
                          : 'border-border/60 hover:border-border'
                      }`}
                    >
                      {p.id === 'growth' && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <Badge className="bg-indigo-600 text-white font-medium text-[10px] px-2.5 py-0.5">
                            Most Popular
                          </Badge>
                        </div>
                      )}

                      <CardHeader className="p-4 pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base font-bold">{p.name}</CardTitle>
                          {isCurrent && (
                            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                              Current
                            </Badge>
                          )}
                        </div>
                        <div className="pt-2">
                          <span className="text-2xl font-bold text-foreground">৳{p.priceBdt.toLocaleString()}</span>
                          <span className="text-xs text-muted-foreground"> / month</span>
                        </div>
                      </CardHeader>

                      <CardContent className="p-4 pt-2 space-y-3 flex-1">
                        <ul className="text-xs text-muted-foreground space-y-2 pt-2 border-t">
                          <li className="flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span>{p.maxMonthlyOrders === -1 ? 'Unlimited' : p.maxMonthlyOrders.toLocaleString()} Orders / mo</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span>{p.maxMonthlySessions === -1 ? 'Unlimited' : p.maxMonthlySessions.toLocaleString()} Visitor Sessions</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span>{p.maxAdAccounts === -1 ? 'Unlimited' : `${p.maxAdAccounts} Ad Accounts`}</span>
                          </li>
                          <li className="flex items-center gap-2">
                            {p.whatsappBriefingEnabled ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            ) : (
                              <X className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            )}
                            <span>Daily WhatsApp 8AM Briefing</span>
                          </li>
                          <li className="flex items-center gap-2">
                            {p.adAutoPilotEnabled ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            ) : (
                              <X className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            )}
                            <span>Ad Auto-Pilot Stop-Loss</span>
                          </li>
                        </ul>
                      </CardContent>

                      <div className="p-4 pt-0">
                        <Button
                          className={`w-full text-xs font-semibold ${
                            isCurrent
                              ? 'bg-muted text-muted-foreground hover:bg-muted cursor-default'
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                          }`}
                          disabled={isCurrent}
                          onClick={() => void handleUpgradePlan(p.id)}
                        >
                          {isCurrent ? 'Current Plan' : `Upgrade to ${p.name}`}
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        {/* TAB 9: A/B EXPERIMENTS */}
        <TabsContent value="experiments" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-indigo-500" />
                <h3 className="text-lg font-bold text-foreground">A/B Testing & Growth Experiments Studio</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Scientifically test pricing, free shipping thresholds, landing pages, and sales scripts with Bayesian confidence scoring.
              </p>
            </div>
            <Button
              onClick={() => setCreatorOpen(true)}
              className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 text-xs"
            >
              <Sparkles className="w-4 h-4" />
              Launch New Experiment
            </Button>
          </div>

          {experimentsData.length === 0 ? (
            <Card className="p-12 text-center space-y-3">
              <FlaskConical className="w-12 h-12 text-muted-foreground mx-auto opacity-50" />
              <h4 className="text-base font-semibold text-foreground">No experiments running yet</h4>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Test Free Delivery vs ৳100 Discount, WhatsApp CTA vs Storefront Checkout, or video ad hooks to systematically grow conversion rates.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreatorOpen(true)}
                className="mt-2 text-indigo-600 border-indigo-200"
              >
                Launch First Experiment
              </Button>
            </Card>
          ) : (
            <div className="space-y-6">
              {experimentsData.map((exp: any) => {
                const analysis = exp.analysis || {};
                const vA = analysis.variantA || { visitors: 0, conversions: 0, conversionRate: 0, revenue: 0 };
                const vB = analysis.variantB || { visitors: 0, conversions: 0, conversionRate: 0, revenue: 0 };
                const isRunning = exp.status === 'running';

                return (
                  <Card key={exp.id} className="border-border/60 shadow-sm overflow-hidden">
                    <CardHeader className="bg-muted/20 border-b p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base font-bold">{exp.name}</CardTitle>
                            <Badge variant="outline" className="text-[10px] uppercase font-mono">
                              {exp.test_type}
                            </Badge>
                            <Badge
                              className={`text-[10px] ${
                                isRunning
                                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {isRunning ? 'Running' : 'Concluded'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground italic">
                            Hypothesis: "{exp.hypothesis}"
                          </p>
                        </div>

                        {isRunning && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleConcludeExperiment(exp.id)}
                            className="text-xs shrink-0 border-indigo-500/30 hover:bg-indigo-500/10 text-indigo-600"
                          >
                            Conclude & Rollout Winner
                          </Button>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Variant A (Control) */}
                        <div className="p-3.5 bg-muted/30 rounded-xl border border-border/60 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-foreground">Control Baseline (A)</span>
                            <Badge variant="outline" className="text-[10px]">Original</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                            <div>
                              <p className="text-[11px] text-muted-foreground">Visitors</p>
                              <p className="font-semibold text-foreground font-mono">{vA.visitors.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-[11px] text-muted-foreground">Conversions</p>
                              <p className="font-semibold text-foreground font-mono">{vA.conversions}</p>
                            </div>
                            <div>
                              <p className="text-[11px] text-muted-foreground">Conversion Rate</p>
                              <p className="font-bold text-foreground font-mono">{vA.conversionRate}%</p>
                            </div>
                            <div>
                              <p className="text-[11px] text-muted-foreground">Revenue</p>
                              <p className="font-semibold text-foreground font-mono">৳{vA.revenue.toLocaleString()}</p>
                            </div>
                          </div>
                        </div>

                        {/* Variant B (Challenger) */}
                        <div className={`p-3.5 rounded-xl border space-y-2 ${analysis.winner === 'variantB' ? 'bg-indigo-500/[0.04] border-indigo-500/30 ring-1 ring-indigo-500/20' : 'bg-muted/30 border-border/60'}`}>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-foreground">Challenger Test (B)</span>
                            {analysis.winner === 'variantB' ? (
                              <Badge className="bg-indigo-600 text-white text-[10px]">Winning Variant 🏆</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">Challenger</Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                            <div>
                              <p className="text-[11px] text-muted-foreground">Visitors</p>
                              <p className="font-semibold text-foreground font-mono">{vB.visitors.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-[11px] text-muted-foreground">Conversions</p>
                              <p className="font-semibold text-foreground font-mono">{vB.conversions}</p>
                            </div>
                            <div>
                              <p className="text-[11px] text-muted-foreground">Conversion Rate</p>
                              <p className="font-bold text-indigo-600 font-mono">{vB.conversionRate}%</p>
                            </div>
                            <div>
                              <p className="text-[11px] text-muted-foreground">Revenue</p>
                              <p className="font-semibold text-foreground font-mono">৳{vB.revenue.toLocaleString()}</p>
                            </div>
                          </div>
                        </div>

                        {/* Lift & Statistical Significance Meter */}
                        <div className="p-3.5 bg-gradient-to-br from-indigo-500/[0.05] via-purple-500/[0.03] to-background rounded-xl border border-indigo-500/20 space-y-2 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-foreground">Statistical Significance</span>
                              <Badge className={`text-[10px] ${analysis.relativeLift >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                {analysis.relativeLift >= 0 ? `+${analysis.relativeLift}% Lift` : `${analysis.relativeLift}% Lift`}
                              </Badge>
                            </div>
                            <div className="mt-2 space-y-1">
                              <div className="flex justify-between text-[11px] text-muted-foreground">
                                <span>Confidence</span>
                                <span className="font-bold text-foreground">{analysis.confidenceScore}%</span>
                              </div>
                              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${analysis.confidenceScore >= 95 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                  style={{ width: `${analysis.confidenceScore}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-border/40 text-[11px]">
                            <span className="text-muted-foreground">Estimated Monthly Impact: </span>
                            <span className="font-bold text-emerald-500">+৳{analysis.incrementalRevenue?.toLocaleString() || 0}</span>
                          </div>
                        </div>
                      </div>

                      {/* AI Evaluation */}
                      <div className="p-3 bg-muted/40 rounded-lg text-xs flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-foreground">AI Growth Recommendation: </strong>
                          <span className="text-muted-foreground">{analysis.recommendation}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Customer Journey Modal */}
      <CustomerJourneyModal
        isOpen={journeyOpen}
        onClose={() => {
          setJourneyOpen(false);
          setJourneyContactId(null);
        }}
        contactId={journeyContactId}
      />

      {/* Experiment Creator Dialog */}
      <ExperimentCreatorDialog
        isOpen={creatorOpen}
        onClose={() => setCreatorOpen(false)}
        onCreated={() => void fetchData()}
      />

      {/* Pixel Setup Dialog */}
      <PixelSetupDialog
        isOpen={pixelModalOpen}
        onClose={() => setPixelModalOpen(false)}
        accountId={billingData?.account?.id}
      />

      {/* Catalog Ad Studio Dialog */}
      <CatalogAdStudioDialog
        open={catalogStudioOpen}
        onOpenChange={setCatalogStudioOpen}
        product={selectedStudioProduct}
      />
    </div>
  );
}
