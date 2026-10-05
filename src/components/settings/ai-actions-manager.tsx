'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Shield,
  Zap,
  ShoppingBag,
  Truck,
  ShieldAlert,
  Clock,
  Image as ImageIcon,
  Mic,
  Plus,
  Trash2,
  RefreshCw,
  ExternalLink,
  MapPin,
  Ticket,
  Bell,
  Globe,
  Sliders,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import type { AiActionSettings, AiCustomAction, CustomActionType } from '@/types/ai-actions';
import { DEFAULT_AI_ACTION_SETTINGS } from '@/types/ai-actions';

const CUSTOM_ACTION_PRESETS = [
  {
    type: 'fixed_reply' as CustomActionType,
    name: 'send_store_location',
    label: '📍 শোরুম / দোকানের ঠিকানা (Store Location)',
    desc: 'কাস্টমার যখন দোকান কোথায় বা এসে দেখার কথা জিজ্ঞেস করে, তখন গুগল ম্যাপস লিঙ্ক ও পূর্ণ ঠিকানা পাঠাবে।',
    defaultConfig: {
      message:
        'আমাদের শোরুমের ঠিকানা: বাড়ি-১২, রোড-৪, সেক্টর-৩, উত্তরা, ঢাকা।\nগুগল ম্যাপস লোকেশন: https://maps.google.com/?q=23.8759,90.3795\nসকাল ১০টা থেকে রাত ৮টা পর্যন্ত খোলা থাকে। স্বাগতম! 😊',
    },
  },
  {
    type: 'instant_coupon' as CustomActionType,
    name: 'give_instant_discount',
    label: '🎟️ দামাদামিতে ইনস্ট্যান্ট কুপন (Bargain Discount)',
    desc: 'কাস্টমার যখন দাম বেশি বলে বা ছাড় চায়, তখন AI নিজে থেকে বিচার করে ১০০ টাকার একটি স্পেশাল কুপন কোড দেবে।',
    defaultConfig: {
      discount_amount: 100,
      coupon_prefix: 'SPECIAL',
      message:
        'আপনার আগ্রহ দেখে আমি স্পেশাল ৳১০০ ডিসকাউন্ট কোড দিচ্ছি: {CODE}। অর্ডার করার সময় এটি ব্যবহার করলেই সাথে সাথে ১০০ টাকা ছাড় পাবেন! 🎁',
    },
  },
  {
    type: 'notify_owner' as CustomActionType,
    name: 'alert_store_manager',
    label: '🔔 মালিকের হোয়াটসঅ্যাপে অ্যালার্ট (Owner WhatsApp Alert)',
    desc: 'কোনো বড় অর্ডার বা স্পেশাল ভিআইপি কাস্টমার আসলে মালিকের ব্যক্তিগত হোয়াটসঅ্যাপে তাৎক্ষণিক নোটিফিকেশন যাবে।',
    defaultConfig: {
      owner_phone: '+8801700000000',
      alert_title: '⚠️ VIP কাস্টমার চ্যাটে অপেক্ষা করছেন!',
    },
  },
  {
    type: 'webhook' as CustomActionType,
    name: 'sync_to_external_crm',
    label: '🌐 এক্সটারনাল ওয়েবহোক / Google Sheets (Webhook)',
    desc: 'অর্ডার বা গুরুত্বপূর্ণ ইভেন্ট হলে স্বয়ংক্রিয়ভাবে বাইরের কোনো URL বা Zapier/Make-এ ডাটা পাঠাবে।',
    defaultConfig: {
      webhook_url: 'https://webhook.site/...',
      webhook_method: 'POST' as const,
    },
  },
];

export function AiActionsManager() {
  const [actionSettings, setActionSettings] = useState<AiActionSettings | null>(null);
  const [customActions, setCustomActions] = useState<AiCustomAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);

  // Custom action form
  const [actionName, setActionName] = useState('');
  const [actionDesc, setActionDesc] = useState('');
  const [actionType, setActionType] = useState<CustomActionType>('fixed_reply');
  const [actionConfig, setActionConfig] = useState<any>({});

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [actionsRes, customRes] = await Promise.all([
        fetch('/api/ai/actions'),
        fetch('/api/ai/custom-actions'),
      ]);

      const actionsData = await actionsRes.json();
      const customData = await customRes.json();

      if (actionsRes.ok && actionsData.settings) {
        setActionSettings(actionsData.settings);
      }
      if (customRes.ok && customData.customActions) {
        setCustomActions(customData.customActions);
      }
    } catch {
      toast.error('Failed to load AI action configurations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Toggle built-in action
  const handleToggleBuiltIn = async (key: keyof typeof DEFAULT_AI_ACTION_SETTINGS, current: boolean) => {
    if (!actionSettings) return;
    const nextVal = !current;

    // Optimistic UI update
    setActionSettings((prev) => (prev ? { ...prev, [key]: nextVal } : prev));

    try {
      setSavingSettings(true);
      const res = await fetch('/api/ai/actions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: nextVal }),
      });

      if (res.ok) {
        toast.success(`Action '${key.replace(/_/g, ' ')}' is now ${nextVal ? 'ENABLED' : 'DISABLED'}`);
      } else {
        toast.error('Failed to update action setting');
        // revert
        setActionSettings((prev) => (prev ? { ...prev, [key]: current } : prev));
      }
    } catch {
      toast.error('Network error updating action');
      setActionSettings((prev) => (prev ? { ...prev, [key]: current } : prev));
    } finally {
      setSavingSettings(false);
    }
  };

  // Preset picker
  const handleSelectPreset = (preset: typeof CUSTOM_ACTION_PRESETS[0]) => {
    setActionName(preset.name);
    setActionDesc(preset.desc);
    setActionType(preset.type);
    setActionConfig(preset.defaultConfig);
  };

  // Create custom action
  const handleCreateCustomAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionName.trim() || !actionDesc.trim()) {
      toast.error('Action name and description are required');
      return;
    }

    try {
      setSubmittingAction(true);
      const res = await fetch('/api/ai/custom-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: actionName.trim(),
          description: actionDesc.trim(),
          action_type: actionType,
          config: actionConfig,
          is_active: true,
        }),
      });

      const data = await res.json();
      if (res.ok && data.customAction) {
        toast.success(`Custom action '${data.customAction.name}' registered!`);
        setCustomActions((prev) => [data.customAction, ...prev]);
        setDialogOpen(false);
        // Reset
        setActionName('');
        setActionDesc('');
        setActionConfig({});
      } else {
        toast.error(data.error || 'Failed to create action');
      }
    } catch {
      toast.error('Network error creating action');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Toggle custom action
  const handleToggleCustomAction = async (id: string, currentState: boolean) => {
    try {
      const res = await fetch('/api/ai/custom-actions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !currentState }),
      });
      if (res.ok) {
        setCustomActions((prev) =>
          prev.map((a) => (a.id === id ? { ...a, is_active: !currentState } : a))
        );
        toast.success(`Action ${!currentState ? 'activated' : 'paused'}`);
      } else {
        toast.error('Failed to update action');
      }
    } catch {
      toast.error('Error updating action');
    }
  };

  // Delete custom action
  const handleDeleteCustomAction = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete custom action '${name}'?`)) return;
    try {
      const res = await fetch(`/api/ai/custom-actions?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setCustomActions((prev) => prev.filter((a) => a.id !== id));
        toast.success(`Action '${name}' deleted`);
      } else {
        toast.error('Failed to delete action');
      }
    } catch {
      toast.error('Error deleting action');
    }
  };

  const BUILTIN_ACTIONS: {
    key: keyof typeof DEFAULT_AI_ACTION_SETTINGS;
    title: string;
    bengaliTitle: string;
    desc: string;
    onText: string;
    offText: string;
    icon: any;
    recommended: boolean;
  }[] = [
    {
      key: 'auto_order_creation',
      title: 'Auto Order Creation',
      bengaliTitle: 'স্বয়ংক্রিয় অর্ডার তৈরি',
      desc: 'কাস্টমার চ্যাটে নাম, ফোন নম্বর ও ফুল ঠিকানা দিলে AI নিজে CRM-এ ভ্যালিডেট করে নতুন অর্ডার তৈরি করবে।',
      onText: 'অর্ডার নিজে নিজে তৈরি হবে',
      offText: 'অর্ডার তৈরি হবে না (হিউম্যান এজেন্ট নিজে কনফার্ম করবে)',
      icon: ShoppingBag,
      recommended: true,
    },
    {
      key: 'auto_courier_booking',
      title: 'Auto Courier Dispatch',
      bengaliTitle: 'অটো কুরিয়ার বুকিং (Steadfast / Pathao)',
      desc: 'অর্ডার কনফার্ম হওয়ামাত্রই AI স্বয়ংক্রিয়ভাবে কুরিয়ার API-তে পার্সেল এন্ট্রি করবে ও ট্র্যাকিং কোড নিয়ে আসবে।',
      onText: 'অর্ডার হলেই স্বয়ংক্রিয় কুরিয়ার বুকিং',
      offText: 'কুরিয়ার বুকিং বন্ধ (ড্যাশবোর্ড থেকে দেখে ম্যানুয়ালি বুক করবেন)',
      icon: Truck,
      recommended: false, // manual checking recommended
    },
    {
      key: 'risk_engine',
      title: 'Fraud & Risk Engine',
      bengaliTitle: 'কাস্টমার রিটার্ন ও ফ্রড রিস্ক চেক',
      desc: 'কাস্টমারের ফোন নম্বরের অতীতের ডেলিভারি সাকসেস রেট চেক করবে এবং হাই-রিস্ক হলে অ্যাডমিনকে সতর্ক করবে।',
      onText: 'হাই-রিস্ক কাস্টমারদের শনাক্ত করে অগ্রিম চার্জ চাইবে',
      offText: 'রিস্ক চেকিং বন্ধ থাকবে',
      icon: ShieldAlert,
      recommended: true,
    },
    {
      key: 'auto_followup',
      title: 'Cart Recovery Follow-up',
      bengaliTitle: 'অসম্পূর্ণ অর্ডারে অটো ফলো-আপ',
      desc: 'কোনো কাস্টমার পণ্য পছন্দ করে বা দাম জেনে চ্যাট থামিয়ে দিলে ৩০-৬০ মিনিট পর রি-টার্গেটিং অফার মেসেজ পাঠাবে।',
      onText: 'স্বয়ংক্রিয় ফলো-আপ মেসেজ পাঠানো হবে',
      offText: 'কোনো ফলো-আপ পাঠানো হবে না',
      icon: Clock,
      recommended: true,
    },
    {
      key: 'send_product_images',
      title: 'Send Product Images',
      bengaliTitle: 'হোয়াটসঅ্যাপে সরাসরি পণ্যের ছবি পাঠানো',
      desc: 'কাস্টমার কোনো পণ্যের কালার ভ্যারিয়েন্ট দেখতে চাইলে AI চ্যাটেই পণ্যের হাই-কোয়ালিটি ফটো পাঠাবে।',
      onText: 'হোয়াটসঅ্যাপে ছবি পাঠাবে',
      offText: 'ছবি পাঠাবে না, শুধু টেক্সট পাঠাবে',
      icon: ImageIcon,
      recommended: true,
    },
    {
      key: 'voice_notes',
      title: 'Voice Notes Transcription',
      bengaliTitle: 'বাংলা ভয়েস মেসেজ রিসিভ ও রিপ্লাই',
      desc: 'কাস্টমার বাংলায় ভয়েস মেসেজ পাঠালে Whisper AI তা শুনে বুঝে সঠিক টেক্সটে স্বয়ংক্রিয় রিপ্লাই প্রদান করবে।',
      onText: 'ভয়েস মেসেজ প্রসেস করে উত্তর দেবে',
      offText: 'ভয়েস মেসেজ সরাসরি হিউম্যান ইনবক্সে চলে যাবে',
      icon: Mic,
      recommended: true,
    },
    {
      key: 'smart_courier_routing',
      title: 'Smart Multi-Courier Routing',
      bengaliTitle: 'স্মার্ট মাল্টি-কুরিয়ার অপ্টিমাইজার (Pathao vs Steadfast)',
      desc: 'গ্রাহকের ঠিকানা অনুযায়ী ঢাকা মেট্রোতে দ্রুততম Pathao (১২-২৪ ঘণ্টা) এবং সারা দেশের ৬৪ জেলায় Steadfast ক্যাশ অন ডেলিভারি স্বয়ংক্রিয়ভাবে নির্বাচন করবে।',
      onText: 'ঠিকানা বুঝে সেরা কুরিয়ার নির্বাচন করবে',
      offText: 'কুরিয়ার অটো-সিলেকশন বন্ধ',
      icon: MapPin,
      recommended: true,
    },
    {
      key: 'meta_capi_tracking',
      title: 'Meta Conversions API (CAPI)',
      bengaliTitle: 'মেটা সার্ভার-সাইড পারচেজ ট্র্যাকিং (CAPI)',
      desc: 'প্রতিটি কনফার্মড অর্ডারের সময় স্বয়ংক্রিয়ভাবে ফেসবুক সার্ভার-সাইড CAPI-তে হ্যাশড ডাটা পাঠাবে, যা অ্যাড রিটার্ন (ROAS) বৃদ্ধি করে।',
      onText: 'মেটা CAPI ইভেন্ট ব্যাকগ্রাউন্ডে পাঠাবে',
      offText: 'মেটা সার্ভার ট্র্যাকিং বন্ধ',
      icon: Globe,
      recommended: true,
    },
    {
      key: 'vip_loyalty',
      title: 'VIP Loyalty & Replenishment',
      bengaliTitle: 'ভিআইপি মেম্বারশিপ ও কাস্টমার রি-অর্ডার ইঞ্জিন',
      desc: 'রিপিটেড ও প্রিমিয়াম কাস্টমারদের শনাক্ত করে বিশেষ মেম্বারশিপ ট্রিটমেন্ট দেবে এবং পণ্য শেষ হওয়ার আগে স্বয়ংক্রিয় রি-অর্ডার রিমাইন্ডার সাজেস্ট করবে।',
      onText: 'ভিআইপি ট্রিটমেন্ট ও রি-অর্ডার অ্যালার্ট চালু',
      offText: 'ভিআইপি ইঞ্জিন বন্ধ',
      icon: Ticket,
      recommended: true,
    },
    {
      key: 'live_tracking_bot',
      title: 'Live Parcel Tracking & RTO Prevention',
      bengaliTitle: 'লাইভ পার্সেল ট্র্যাকিং ও রিটার্ন অ্যালার্ট',
      desc: 'কাস্টমার পার্সেল কোথায় জানতে চাইলে লাইভ হাব/রাইডার লোকেশন দেবে এবং পার্সেল হোল্ড বা ফেইল্ড হলে সাথে সাথে সতর্কতা মেসেজ পাঠিয়ে রিটার্ন ঠেকাবে।',
      onText: 'লাইভ ট্র্যাকিং ও ফেইল্ড ডেলিভারি অ্যালার্ট চালু',
      offText: 'লাইভ ট্র্যাকিং বন্ধ',
      icon: Bell,
      recommended: true,
    },
    {
      key: 'dynamic_upsell',
      title: 'Dynamic Upsell & Smart Combos',
      bengaliTitle: 'ডায়নামিক আপসেল ও কম্বো রেকমেন্ডেশন',
      desc: 'কাস্টমার অর্ডার চূড়ান্ত করার সময় রিলেটেড প্রোডাক্ট কম্বো অফার দিয়ে ডিসকাউন্টসহ গড় অর্ডার ভ্যালু (AOV) বাড়াবে।',
      onText: 'স্মার্ট কম্বো ও আপসেল অফার চালু',
      offText: 'আপসেল অফার বন্ধ',
      icon: Sparkles,
      recommended: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Core Built-in Actions Card */}
      <Card className="border border-border/70 shadow-none">
        <CardHeader className="p-4 sm:p-6 pb-3 flex flex-row items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold sm:text-lg flex items-center gap-2">
                <Sliders className="h-5 w-5 text-primary" />
                AI Autonomous Actions (অ্যাকশন অন/অফ কন্ট্রোল)
              </CardTitle>
              <Badge variant="outline" className="border-primary/40 text-primary text-[11px]">
                {actionSettings ? Object.values(actionSettings).filter(Boolean).length - 1 : 6} Active
              </Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              আপনার ব্যবসার সুবিধামতো AI-এর স্বয়ংক্রিয় কাজগুলো আলাদাভাবে চালু বা বন্ধ রাখুন।
            </CardDescription>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="h-8 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 pt-2">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground text-xs gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-primary" />
              Loading action settings...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {BUILTIN_ACTIONS.map((item) => {
                const isEnabled = actionSettings
                  ? Boolean(actionSettings[item.key])
                  : Boolean(DEFAULT_AI_ACTION_SETTINGS[item.key]);
                const Icon = item.icon;

                return (
                  <div
                    key={item.key}
                    className={`rounded-xl border p-4 transition-all ${
                      isEnabled
                        ? 'border-border/80 bg-card hover:border-primary/50'
                        : 'border-border/40 bg-muted/20 opacity-75'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div
                          className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                            isEnabled
                              ? 'bg-primary/10 text-primary'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          <Icon className="h-4.5 w-4.5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-foreground">
                              {item.bengaliTitle}
                            </h4>
                            {item.recommended && (
                              <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-500/20 font-medium">
                                Recommended
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                            {item.title}
                          </p>
                        </div>
                      </div>

                      <Switch
                        checked={isEnabled}
                        disabled={savingSettings}
                        onCheckedChange={() => handleToggleBuiltIn(item.key, isEnabled)}
                      />
                    </div>

                    <p className="text-xs text-foreground/80 mt-3 leading-relaxed">
                      {item.desc}
                    </p>

                    <div className="mt-3 pt-2.5 border-t text-[11px] flex items-center justify-between">
                      <span className="text-muted-foreground">বর্তমান অবস্থা:</span>
                      <span
                        className={`font-semibold flex items-center gap-1 ${
                          isEnabled
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            isEnabled ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                        />
                        {isEnabled ? item.onText : item.offText}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Custom Actions Builder Card */}
      <Card className="border border-border/70 shadow-none">
        <CardHeader className="p-4 sm:p-6 pb-3 flex flex-row items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold sm:text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                Custom Actions & Tools (কাস্টম অ্যাকশন বিল্ডার)
              </CardTitle>
              <Badge variant="outline" className="border-amber-500/40 text-amber-500 text-[11px]">
                {customActions.length} Actions
              </Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              শোরুমের লোকেশন পাঠানো, ইনস্ট্যান্ট ডিসকাউন্ট কুপন তৈরি বা মালিকের ফোনে অ্যালার্ট দেওয়ার মতো কাস্টম অ্যাকশন যোগ করুন।
            </CardDescription>
          </div>

          <Button
            size="sm"
            onClick={() => {
              handleSelectPreset(CUSTOM_ACTION_PRESETS[0]);
              setDialogOpen(true);
            }}
            className="h-8 text-xs gap-1.5 font-medium"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Custom Action
          </Button>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 pt-2">
          {customActions.length === 0 ? (
            <div className="text-center py-10 border border-dashed rounded-lg bg-muted/20">
              <Sparkles className="h-10 w-10 mx-auto text-muted-foreground/60 mb-2" />
              <h4 className="text-sm font-medium text-foreground">No custom actions yet</h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                Add your first custom tool so your AI assistant can share store location, offer instant bargain discounts, or send webhook events.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {CUSTOM_ACTION_PRESETS.map((p) => (
                  <Button
                    key={p.name}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handleSelectPreset(p);
                      setDialogOpen(true);
                    }}
                    className="h-8 text-xs"
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {customActions.map((action) => (
                <div
                  key={action.id}
                  className={`rounded-xl border p-4 transition-all ${
                    action.is_active
                      ? 'border-border/80 bg-card hover:border-amber-500/40'
                      : 'border-border/40 bg-muted/20 opacity-70'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-foreground">
                          {action.name}
                        </span>
                        <Badge
                          variant="secondary"
                          className="text-[10px] uppercase font-semibold tracking-wider"
                        >
                          {action.action_type.replace(/_/g, ' ')}
                        </Badge>
                      </div>

                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {action.description}
                      </p>

                      {/* Config summary preview */}
                      <div className="mt-2.5 bg-muted/40 rounded-lg p-2.5 text-[11px] font-mono text-foreground border border-border/50">
                        {action.action_type === 'fixed_reply' && (
                          <div className="whitespace-pre-line text-xs font-sans">
                            💬 <strong>Reply Message:</strong> {action.config.message}
                          </div>
                        )}
                        {action.action_type === 'instant_coupon' && (
                          <div>
                            🎟️ <strong>Instant Discount:</strong> ৳{action.config.discount_amount} | Prefix: {action.config.coupon_prefix || 'SPECIAL'}
                          </div>
                        )}
                        {action.action_type === 'notify_owner' && (
                          <div>
                            🔔 <strong>Owner Alert Phone:</strong> {action.config.owner_phone}
                          </div>
                        )}
                        {action.action_type === 'webhook' && (
                          <div className="truncate">
                            🌐 <strong>{action.config.webhook_method || 'POST'}</strong>: {action.config.webhook_url}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:justify-between shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">
                          {action.is_active ? 'Active' : 'Paused'}
                        </span>
                        <Switch
                          checked={action.is_active}
                          onCheckedChange={() =>
                            handleToggleCustomAction(action.id, action.is_active)
                          }
                        />
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteCustomAction(action.id, action.name)}
                        className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10 px-2"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Custom Action Dialog */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-amber-500" />
                  Add Custom AI Action / Tool
                </DialogTitle>
                <DialogDescription>
                  Define a new capability for your AI agent to execute autonomously during conversations.
                </DialogDescription>
              </DialogHeader>

              {/* Preset quick buttons */}
              <div className="space-y-1.5 pt-1">
                <Label className="text-[11px] text-muted-foreground">Choose from popular presets:</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {CUSTOM_ACTION_PRESETS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => handleSelectPreset(p)}
                      className={`text-left text-xs p-2 rounded-lg border transition-all ${
                        actionName === p.name
                          ? 'border-primary bg-primary/10 text-primary font-semibold'
                          : 'border-border bg-card text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleCreateCustomAction} className="space-y-3.5 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="actName" className="text-xs font-semibold">
                    Action System Name (snake_case) *
                  </Label>
                  <Input
                    id="actName"
                    placeholder="e.g. send_store_location, give_instant_discount"
                    value={actionName}
                    onChange={(e) => setActionName(e.target.value)}
                    className="font-mono text-xs"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="actDesc" className="text-xs font-semibold">
                    AI Trigger Description *
                  </Label>
                  <Textarea
                    id="actDesc"
                    rows={2}
                    placeholder="Describe WHEN AI should trigger this action..."
                    value={actionDesc}
                    onChange={(e) => setActionDesc(e.target.value)}
                    className="text-xs leading-relaxed"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Example: "Trigger this when customer asks for showroom address or Google Maps location"
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Action Type</Label>
                  <select
                    value={actionType}
                    onChange={(e) => setActionType(e.target.value as any)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus:ring-1 focus:ring-ring"
                  >
                    <option value="fixed_reply">💬 Send Formatted Reply / Location (মেসেজ পাঠানো)</option>
                    <option value="instant_coupon">🎟️ Generate Instant Coupon (ইনস্ট্যান্ট কুপন ছাড়)</option>
                    <option value="notify_owner">🔔 Notify Owner on WhatsApp (মালিকের ফোনে অ্যালার্ট)</option>
                    <option value="webhook">🌐 Trigger External Webhook / Zapier (ওয়েবহুক সিঙ্ক)</option>
                  </select>
                </div>

                {/* Conditional Config Inputs */}
                {actionType === 'fixed_reply' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Message / Address / Details *</Label>
                    <Textarea
                      rows={3}
                      value={actionConfig.message || ''}
                      onChange={(e) =>
                        setActionConfig((prev: any) => ({ ...prev, message: e.target.value }))
                      }
                      placeholder="Enter the full response message or location link..."
                      className="text-xs"
                      required
                    />
                  </div>
                )}

                {actionType === 'instant_coupon' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Discount Amount (৳)</Label>
                      <Input
                        type="number"
                        value={actionConfig.discount_amount || 100}
                        onChange={(e) =>
                          setActionConfig((prev: any) => ({
                            ...prev,
                            discount_amount: Number(e.target.value),
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Coupon Prefix</Label>
                      <Input
                        value={actionConfig.coupon_prefix || 'SPECIAL'}
                        onChange={(e) =>
                          setActionConfig((prev: any) => ({
                            ...prev,
                            coupon_prefix: e.target.value.toUpperCase(),
                          }))
                        }
                      />
                    </div>
                  </div>
                )}

                {actionType === 'notify_owner' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Owner WhatsApp Phone Number *</Label>
                    <Input
                      placeholder="+8801700000000"
                      value={actionConfig.owner_phone || ''}
                      onChange={(e) =>
                        setActionConfig((prev: any) => ({ ...prev, owner_phone: e.target.value }))
                      }
                      required
                    />
                  </div>
                )}

                {actionType === 'webhook' && (
                  <div className="space-y-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Webhook Destination URL *</Label>
                      <Input
                        placeholder="https://hook.eu1.make.com/..."
                        value={actionConfig.webhook_url || ''}
                        onChange={(e) =>
                          setActionConfig((prev: any) => ({ ...prev, webhook_url: e.target.value }))
                        }
                        required
                      />
                    </div>
                  </div>
                )}

                <DialogFooter className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={submittingAction}>
                    {submittingAction ? 'Creating...' : 'Save Custom Action'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
