'use client';

import React, { useState, useEffect } from 'react';
import {
  Bot,
  Zap,
  Clock,
  Feather,
  Sparkles,
  Settings2,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  ShoppingBag,
  Truck,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
  Cpu,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface AiAgentOverviewProps {
  onNavigateTab: (tabId: string) => void;
}

export function AiAgentOverview({ onNavigateTab }: AiAgentOverviewProps) {
  const [config, setConfig] = useState<any>(null);
  const [actionSettings, setActionSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const fetchOverviewData = async () => {
    try {
      setLoading(true);
      const [cfgRes, actRes] = await Promise.all([
        fetch('/api/ai/config'),
        fetch('/api/ai/actions'),
      ]);

      if (cfgRes.ok) {
        const cData = await cfgRes.json();
        setConfig(cData?.config || (cData?.configured ? cData : null));
      }

      if (actRes.ok) {
        const aData = await actRes.json();
        setActionSettings(aData?.settings || null);
      }
    } catch (err) {
      console.error('Failed to load overview data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();
  }, []);

  const handleMasterToggle = async (active: boolean) => {
    try {
      setToggling(true);
      const res = await fetch('/api/ai/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: active }),
      });

      if (!res.ok) {
        throw new Error('Failed to update status');
      }

      setConfig((prev: any) => ({ ...prev, is_active: active }));
      toast.success(
        active
          ? 'AI এজেন্ট সক্রিয় করা হয়েছে! এখন থেকে গ্রাহকদের স্বয়ংক্রিয় রিপ্লাই ও অর্ডার হ্যান্ডল করবে।'
          : 'AI এজেন্ট সাময়িকভাবে স্থগিত (Paused) করা হয়েছে।'
      );
    } catch (err: any) {
      toast.error(err.message || 'স্ট্যাটাস পরিবর্তন করতে ব্যর্থ হয়েছে');
    } finally {
      setToggling(false);
    }
  };

  const isActive = Boolean(config?.is_active);
  const modelName = config?.model || 'gemini-2.5-flash';
  const provider = config?.provider || 'Google Gemini';

  const activeActionsCount = actionSettings
    ? [
        actionSettings.auto_order_creation,
        actionSettings.auto_courier_booking,
        actionSettings.risk_engine,
        actionSettings.auto_followup,
        actionSettings.send_product_images,
        actionSettings.voice_notes,
        actionSettings.smart_courier_routing ?? true,
        actionSettings.meta_capi_tracking ?? true,
        actionSettings.vip_loyalty ?? true,
        actionSettings.live_tracking_bot ?? true,
        actionSettings.dynamic_upsell ?? true,
      ].filter(Boolean).length
    : 11;

  return (
    <div className="space-y-6">
      {/* Master Agent Status Banner */}
      <Card className="border border-border/80 bg-gradient-to-br from-card via-card to-primary/5 shadow-none overflow-hidden">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div
                className={`p-3.5 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : 'bg-muted text-muted-foreground border border-border'
                }`}
              >
                <Bot className="h-7 w-7" />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold text-foreground sm:text-xl">
                    WhatsApp AI Autonomous Commerce Agent
                  </h3>
                  {isActive ? (
                    <Badge className="bg-emerald-600 text-white gap-1 text-[11px] px-2 py-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                      Live & Answering
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1 text-[11px] px-2 py-0.5">
                      <Pause className="h-3 w-3" />
                      Paused
                    </Badge>
                  )}
                </div>

                <p className="text-xs text-muted-foreground mt-1 max-w-xl sm:text-sm">
                  গ্রাহকের হোয়াটসঅ্যাপ ইনবক্স চ্যাট থেকে সরাসরি প্রোডাক্ট প্রস্তাবনা, স্বয়ংক্রিয় অর্ডার প্লেসমেন্ট, বিডি কুরিয়ার বুকিং ও ফ্রড ডিটেকশন পরিচালনা করে।
                </p>

                <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 font-mono text-[11px] bg-background px-2 py-0.5 rounded border">
                    <Cpu className="h-3 w-3 text-primary" /> {provider} ({modelName})
                  </span>
                  <span className="flex items-center gap-1 text-[11px] bg-background px-2 py-0.5 rounded border">
                    <Zap className="h-3 w-3 text-amber-500" /> {activeActionsCount} / 6 Actions Enabled
                  </span>
                </div>
              </div>
            </div>

            {/* Master Switch */}
            <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-3 sm:pt-0">
              <div className="text-right sm:mb-2">
                <span className="text-xs font-semibold block text-foreground">
                  Master Agent Switch
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {isActive ? 'স্বয়ংক্রিয় রিপ্লাই চালু' : 'স্বয়ংক্রিয় রিপ্লাই বন্ধ'}
                </span>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={handleMasterToggle}
                disabled={toggling || loading}
                className="scale-110"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border shadow-none">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Core Actions</p>
              <h4 className="text-xl font-bold mt-1 text-foreground">
                {activeActionsCount} / 11
              </h4>
              <p className="text-[11px] text-emerald-600 mt-0.5">অটোমেশন প্রস্তুত</p>
            </div>
            <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
              <Zap className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-none">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Order Creation</p>
              <h4 className="text-xl font-bold mt-1 text-foreground">
                {actionSettings?.auto_order_creation ? 'Active' : 'Off'}
              </h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">স্বয়ংক্রিয় অর্ডার</p>
            </div>
            <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-600">
              <ShoppingBag className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-none">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Courier Booking</p>
              <h4 className="text-xl font-bold mt-1 text-foreground">
                {actionSettings?.auto_courier_booking ? 'Active' : 'Off'}
              </h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">Steadfast / Pathao</p>
            </div>
            <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-600">
              <Truck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-none">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Risk & Fraud</p>
              <h4 className="text-xl font-bold mt-1 text-foreground">
                {actionSettings?.risk_engine ? 'Protected' : 'Off'}
              </h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">পার্সেল রিটার্ন ফিল্টার</p>
            </div>
            <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Control Hub Navigation Matrix */}
      <div>
        <h3 className="text-sm font-semibold tracking-tight text-foreground mb-3">
          AI Sub-systems & Control Modules (সকল এআই ফিচার কন্ট্রোল)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card 1: Autonomous Actions */}
          <div
            onClick={() => onNavigateTab('actions')}
            className="group cursor-pointer p-4 rounded-xl border bg-card hover:border-primary/50 hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Zap className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </div>
            <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
              Actions & Custom Tools (অ্যাকশন ও টুলস)
            </h4>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              অটো অর্ডার, কুরিয়ার বুকিং, ফ্রড ফিল্টার এবং নতুন কাস্টম অ্যাকশন টুল তৈরি ও টগল করুন।
            </p>
          </div>

          {/* Card 2: Followups & Recovery */}
          <div
            onClick={() => onNavigateTab('followups')}
            className="group cursor-pointer p-4 rounded-xl border bg-card hover:border-primary/50 hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Clock className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </div>
            <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
              Follow-ups & Recovery (স্বয়ংক্রিয় রিকভারি)
            </h4>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              অসম্পূর্ণ চেকআউট ড্রপ-অফ ও বকেয়া অগ্রিম চার্জের শিডিউলড হোয়াটসঅ্যাপ পুশ কিউ।
            </p>
          </div>

          {/* Card 3: Copywriter Studio */}
          <div
            onClick={() => onNavigateTab('copywriter')}
            className="group cursor-pointer p-4 rounded-xl border bg-card hover:border-primary/50 hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Feather className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </div>
            <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
              AI Sales Copywriter (সেলস কপিরাইটার)
            </h4>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              ফেসবুক বিজ্ঞাপন, ল্যান্ডিং পেজ ও হোয়াটসঅ্যাপ ব্রডকাস্টের জন্য কনভার্টিং বাংলা টেক্সট জেনারেটর।
            </p>
          </div>

          {/* Card 4: Playground Simulator */}
          <div
            onClick={() => onNavigateTab('playground')}
            className="group cursor-pointer p-4 rounded-xl border bg-card hover:border-primary/50 hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Sparkles className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </div>
            <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
              Agent Simulator & Playground (লাইভ টেস্ট)
            </h4>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              কাস্টমার হিসেবে চ্যাট করে এআই এজেন্টের টুল কল ও অর্ডার প্লেসমেন্ট লাইভ টেস্ট করুন।
            </p>
          </div>

          {/* Card 5: Setup & Brain Config */}
          <div
            onClick={() => onNavigateTab('setup')}
            className="group cursor-pointer p-4 rounded-xl border bg-card hover:border-primary/50 hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-zinc-500/10 text-zinc-600 dark:text-zinc-400">
                <Settings2 className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </div>
            <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
              Brain & Model Config (মডেল ও ব্রেন সেটিংস)
            </h4>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              Gemini, OpenAI, Groq বা Claude API কি, সিস্টেম প্রম্পট ও হিউম্যান হ্যান্ডঅফ রুলস।
            </p>
          </div>

          {/* Card 6: Usage & Token Analytics */}
          <div
            onClick={() => onNavigateTab('usage')}
            className="group cursor-pointer p-4 rounded-xl border bg-card hover:border-primary/50 hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                <BarChart3 className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </div>
            <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
              Token Analytics & Cost (টোকেন অ্যানালিটিক্স)
            </h4>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              প্রতিদিনের এআই টোকেন খরচ, ব্যবহার এবং মোট সেভিংস রিপোর্ট।
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
