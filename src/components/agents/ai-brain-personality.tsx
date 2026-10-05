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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Brain,
  Sparkles,
  MessageSquare,
  DollarSign,
  ShieldCheck,
  BookOpen,
  RefreshCw,
  Save,
  X,
  Plus,
  Bot,
  TrendingUp,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface PersonaConfig {
  tone: 'formal' | 'casual' | 'friendly' | 'professional';
  response_language: 'bangla' | 'english' | 'mixed';
  custom_greeting: string | null;
  custom_sign_off: string | null;
  max_discount_percent: number;
  negotiation_style: 'firm' | 'flexible' | 'generous';
  require_advance_above: number | null;
  min_order_amount: number | null;
  blocked_phrases: string[];
  custom_rules: string | null;
  auto_learn_from_products: boolean;
  auto_learn_from_orders: boolean;
}

interface AiInsight {
  type: string;
  title: string;
  description: string;
  value?: string;
  trend?: 'up' | 'down' | 'neutral';
  action?: string;
}

const DEFAULT_PERSONA: PersonaConfig = {
  tone: 'friendly',
  response_language: 'mixed',
  custom_greeting: null,
  custom_sign_off: null,
  max_discount_percent: 10,
  negotiation_style: 'flexible',
  require_advance_above: null,
  min_order_amount: null,
  blocked_phrases: [],
  custom_rules: null,
  auto_learn_from_products: true,
  auto_learn_from_orders: true,
};

const TONE_OPTIONS = [
  { value: 'friendly', label: '😊 বন্ধুত্বপূর্ণ (Friendly)', desc: 'উষ্ণ ও আন্তরিক ভাষায় কথা বলে' },
  { value: 'professional', label: '💼 প্রফেশনাল (Professional)', desc: 'ব্যবসায়িক ও গুছানো উত্তর দেয়' },
  { value: 'casual', label: '🤙 ক্যাজুয়াল (Casual)', desc: 'হালকা ও অনানুষ্ঠানিক ভাষায় কথা বলে' },
  { value: 'formal', label: '🎩 ফর্মাল (Formal)', desc: 'শ্রদ্ধাপূর্ণ ও আনুষ্ঠানিক ভাষায় কথা বলে' },
];

const LANG_OPTIONS = [
  { value: 'mixed', label: '🇧🇩 বাংলা + English (মিশ্র)' },
  { value: 'bangla', label: '🇧🇩 শুধু বাংলা' },
  { value: 'english', label: '🇬🇧 শুধু English' },
];

const NEGO_OPTIONS = [
  { value: 'firm', label: '💪 দৃঢ় (Firm)', desc: 'দাম নিয়ে কোনো ছাড় দেয় না' },
  { value: 'flexible', label: '🤝 নমনীয় (Flexible)', desc: 'সীমার মধ্যে ছাড় দিতে পারে' },
  { value: 'generous', label: '🎁 উদার (Generous)', desc: 'গ্রাহক ধরে রাখতে বেশি ছাড় দেয়' },
];

export function AiBrainPersonality() {
  const [persona, setPersona] = useState<PersonaConfig>(DEFAULT_PERSONA);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [newBlockedPhrase, setNewBlockedPhrase] = useState('');

  const loadPersona = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/persona');
      if (res.ok) {
        const data = await res.json();
        setPersona({ ...DEFAULT_PERSONA, ...data.persona });
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInsights = useCallback(async () => {
    try {
      const res = await fetch('/api/analytics/ai-insights');
      if (res.ok) {
        const data = await res.json();
        setInsights(data.insights ?? []);
      }
    } catch {
      // silent
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPersona();
    loadInsights();
  }, [loadPersona, loadInsights]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/ai/persona', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(persona),
      });
      if (!res.ok) throw new Error('save failed');
      toast.success('AI পার্সোনালিটি সেভ হয়েছে ✅');
    } catch {
      toast.error('সেভ করতে সমস্যা হয়েছে');
    } finally {
      setSaving(false);
    }
  };

  const handleAutoLearn = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/ai/auto-learn', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(data.message ?? 'AI লার্নিং সম্পন্ন হয়েছে ✅');
      } else {
        toast.error(data.error ?? 'লার্নিং শুরু করতে সমস্যা হয়েছে');
      }
    } catch {
      toast.error('সার্ভার সংযোগ সমস্যা');
    } finally {
      setSyncing(false);
    }
  };

  const addBlockedPhrase = () => {
    const phrase = newBlockedPhrase.trim();
    if (!phrase || persona.blocked_phrases.includes(phrase)) return;
    setPersona((p) => ({ ...p, blocked_phrases: [...p.blocked_phrases, phrase] }));
    setNewBlockedPhrase('');
  };

  const removeBlockedPhrase = (phrase: string) => {
    setPersona((p) => ({ ...p, blocked_phrases: p.blocked_phrases.filter((ph) => ph !== phrase) }));
  };

  const trendIcon = (trend?: string) => {
    if (trend === 'up') return '📈';
    if (trend === 'down') return '📉';
    return '➡️';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-violet-500/10 rounded-xl text-violet-600">
            <Brain className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold">AI Brain Personality</h2>
            <p className="text-sm text-muted-foreground">
              আপনার ব্যবসার জন্য AI-এর ব্যক্তিত্ব, নিয়ম ও লার্নিং কাস্টমাইজ করুন
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          সেভ করুন
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-5">

          {/* Tone & Language */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-500" />
                কথা বলার স্টাইল
              </CardTitle>
              <CardDescription className="text-xs">AI কোন ভাষায় ও কীভাবে কথা বলবে</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">টোন (Tone)</Label>
                <div className="grid grid-cols-2 gap-2">
                  {TONE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setPersona((p) => ({ ...p, tone: opt.value as PersonaConfig['tone'] }))}
                      className={`text-left p-2.5 rounded-lg border text-xs transition-all ${
                        persona.tone === opt.value
                          ? 'border-primary bg-primary/5 text-primary font-medium'
                          : 'border-muted hover:border-muted-foreground/50'
                      }`}
                    >
                      <div className="font-medium">{opt.label}</div>
                      <div className="text-muted-foreground mt-0.5 text-[11px]">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">ভাষা (Language)</Label>
                <Select
                  value={persona.response_language}
                  onValueChange={(v) => setPersona((p) => ({ ...p, response_language: v as PersonaConfig['response_language'] }))}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANG_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-sm">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">কাস্টম গ্রিটিং (ঐচ্ছিক)</Label>
                <Input
                  className="text-sm h-9"
                  placeholder="যেমন: আস্সালামুয়ালাইকুম! আমি XYZ থেকে বলছি 😊"
                  value={persona.custom_greeting ?? ''}
                  onChange={(e) => setPersona((p) => ({ ...p, custom_greeting: e.target.value || null }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">কাস্টম সাইন-অফ (ঐচ্ছিক)</Label>
                <Input
                  className="text-sm h-9"
                  placeholder="যেমন: ধন্যবাদ - XYZ সার্ভিস টিম 🙏"
                  value={persona.custom_sign_off ?? ''}
                  onChange={(e) => setPersona((p) => ({ ...p, custom_sign_off: e.target.value || null }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Business Rules */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-500" />
                ব্যবসায়িক নিয়ম
              </CardTitle>
              <CardDescription className="text-xs">দাম-দর ও অর্ডার নিয়ম কাস্টমাইজ করুন</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">সর্বোচ্চ ডিসকাউন্ট</Label>
                  <Badge variant="secondary" className="text-xs font-mono">
                    {persona.max_discount_percent}%
                  </Badge>
                </div>
                <input
                  type="range"
                  min={0}
                  max={30}
                  step={1}
                  value={persona.max_discount_percent}
                  onChange={(e) => setPersona((p) => ({ ...p, max_discount_percent: Number(e.target.value) }))}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <p className="text-[11px] text-muted-foreground">
                  AI এই সীমার বেশি ছাড় দেবে না (0% = কোনো ছাড় নেই)
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">দাম-দর স্টাইল</Label>
                <div className="grid grid-cols-3 gap-2">
                  {NEGO_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setPersona((p) => ({ ...p, negotiation_style: opt.value as PersonaConfig['negotiation_style'] }))}
                      className={`text-left p-2 rounded-lg border text-xs transition-all ${
                        persona.negotiation_style === opt.value
                          ? 'border-primary bg-primary/5 text-primary font-medium'
                          : 'border-muted hover:border-muted-foreground/50'
                      }`}
                    >
                      <div className="font-medium text-[11px]">{opt.label}</div>
                      <div className="text-muted-foreground mt-0.5 text-[10px] leading-tight">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">অ্যাডভান্স প্রয়োজন (৳)</Label>
                  <Input
                    type="number"
                    className="text-sm h-9"
                    placeholder="যেমন: 500"
                    value={persona.require_advance_above ?? ''}
                    onChange={(e) => setPersona((p) => ({
                      ...p,
                      require_advance_above: e.target.value ? Number(e.target.value) : null,
                    }))}
                  />
                  <p className="text-[10px] text-muted-foreground">এর বেশি অর্ডারে অ্যাডভান্স নেবে</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">ন্যূনতম অর্ডার (৳)</Label>
                  <Input
                    type="number"
                    className="text-sm h-9"
                    placeholder="যেমন: 200"
                    value={persona.min_order_amount ?? ''}
                    onChange={(e) => setPersona((p) => ({
                      ...p,
                      min_order_amount: e.target.value ? Number(e.target.value) : null,
                    }))}
                  />
                  <p className="text-[10px] text-muted-foreground">এর কম অর্ডার নেবে না</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-5">

          {/* AI Learning */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-amber-500" />
                AI লার্নিং সিস্টেম
              </CardTitle>
              <CardDescription className="text-xs">
                AI আপনার ব্যবসার ডেটা থেকে শিখে আরো স্মার্ট হয়
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">🛍️ প্রোডাক্ট ক্যাটালগ থেকে শেখা</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    AI আপনার প্রোডাক্ট সম্পর্কে বিস্তারিত জানবে
                  </p>
                </div>
                <Switch
                  checked={persona.auto_learn_from_products}
                  onCheckedChange={(v) => setPersona((p) => ({ ...p, auto_learn_from_products: v }))}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">📦 অর্ডার প্যাটার্ন থেকে শেখা</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    কী বিক্রি হয়, কী কথায় অর্ডার আসে — AI শিখবে
                  </p>
                </div>
                <Switch
                  checked={persona.auto_learn_from_orders}
                  onCheckedChange={(v) => setPersona((p) => ({ ...p, auto_learn_from_orders: v }))}
                />
              </div>

              <Button
                variant="outline"
                className="w-full gap-2 text-sm"
                onClick={handleAutoLearn}
                disabled={syncing}
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 text-amber-500" />
                )}
                এখনই AI-কে শেখাও (Sync Now)
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                প্রোডাক্ট ক্যাটালগ ও অর্ডার ডেটা AI Knowledge Base-এ যোগ করবে
              </p>
            </CardContent>
          </Card>

          {/* Blocked Phrases */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-red-500" />
                ব্লক করা কথা
              </CardTitle>
              <CardDescription className="text-xs">
                AI এই কথাগুলো কখনো বলবে না
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  className="text-sm h-9 flex-1"
                  placeholder="যেমন: প্রতিযোগী কোম্পানির নাম..."
                  value={newBlockedPhrase}
                  onChange={(e) => setNewBlockedPhrase(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addBlockedPhrase()}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 w-9 p-0"
                  onClick={addBlockedPhrase}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {persona.blocked_phrases.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2 text-center">
                  কোনো ব্লক করা কথা নেই
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {persona.blocked_phrases.map((phrase) => (
                    <Badge
                      key={phrase}
                      variant="destructive"
                      className="text-xs gap-1 cursor-pointer"
                      onClick={() => removeBlockedPhrase(phrase)}
                    >
                      {phrase}
                      <X className="h-2.5 w-2.5" />
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Custom Rules */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bot className="h-4 w-4 text-violet-500" />
                কাস্টম নির্দেশনা
              </CardTitle>
              <CardDescription className="text-xs">
                আপনার ব্যবসার জন্য AI-কে যেকোনো বিশেষ নির্দেশ দিন
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                className="text-sm min-h-[120px] resize-none"
                placeholder={'যেমন:\n- রমজান মাসে সকল পণ্যে ১০% ছাড় আছে\n- কাস্টমার রাগ করলে ম্যানেজারের নম্বর দাও: 01XXXXXXXXX\n- ঢাকার বাইরে ডেলিভারি ৩-৫ দিন লাগে'}
                value={persona.custom_rules ?? ''}
                onChange={(e) => setPersona((p) => ({ ...p, custom_rules: e.target.value || null }))}
              />
              <p className="text-[11px] text-muted-foreground mt-2">
                এই নির্দেশগুলো AI-এর সিস্টেম প্রম্পটে যোগ হবে
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* AI Insights Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            AI ইনসাইটস — গত ৩০ দিনের বিশ্লেষণ
          </CardTitle>
          <CardDescription className="text-xs">
            আপনার ব্যবসার পারফরমেন্স সম্পর্কে AI-এর বিশ্লেষণ ও পরামর্শ
          </CardDescription>
        </CardHeader>
        <CardContent>
          {insightsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : insights.length === 0 ? (
            <div className="flex items-center gap-2 p-4 bg-muted/40 rounded-lg">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                পর্যাপ্ত ডেটা নেই। কিছু অর্ডার হলে AI স্বয়ংক্রিয়ভাবে বিশ্লেষণ করবে।
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {insights.map((insight, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-xl border bg-card hover:shadow-sm transition-shadow space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">
                      {trendIcon(insight.trend)} {insight.title}
                    </p>
                    {insight.value && (
                      <Badge variant="secondary" className="text-xs font-mono">
                        {insight.value}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {insight.description}
                  </p>
                  {insight.action && (
                    <p className="text-xs text-primary font-medium mt-1">
                      💡 {insight.action}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Footer */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg" className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          সব পরিবর্তন সেভ করুন
        </Button>
      </div>
    </div>
  );
}
