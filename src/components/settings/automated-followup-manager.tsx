'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Clock,
  Send,
  Zap,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  PhoneCall,
  CreditCard,
  MessageSquare,
  ShieldCheck,
  Save,
  ShoppingBag,
  Info,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  type FollowupSettings,
  type FollowupLog,
  type DispatchSummary,
  DEFAULT_FOLLOWUP_SETTINGS,
} from '@/types/followup';
import { format } from 'date-fns';

export function AutomatedFollowupManager() {
  const [settings, setSettings] = useState<FollowupSettings>({
    account_id: '',
    ...DEFAULT_FOLLOWUP_SETTINGS,
  });
  const [logs, setLogs] = useState<FollowupLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [lastSummary, setLastSummary] = useState<DispatchSummary | null>(null);

  const fetchSettingsAndLogs = useCallback(async () => {
    try {
      setLoading(true);
      const [settingsRes, logsRes] = await Promise.all([
        fetch('/api/followups/settings'),
        fetch('/api/followups/logs'),
      ]);

      if (settingsRes.ok) {
        const sData = await settingsRes.json();
        if (sData?.settings) {
          setSettings(sData.settings);
        }
      }

      if (logsRes.ok) {
        const lData = await logsRes.json();
        if (lData?.logs) {
          setLogs(lData.logs);
        }
      }
    } catch (err) {
      console.error('Failed to load followup data:', err);
      toast.error('ফলোআপ সেটিংস লোড করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettingsAndLogs();
  }, [fetchSettingsAndLogs]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await fetch('/api/followups/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!res.ok) {
        throw new Error('Save failed');
      }

      toast.success('ফলোআপ ও রিকভারি সেটিংস সফলভাবে সংরক্ষিত হয়েছে!');
    } catch (err: any) {
      toast.error(err.message || 'সেটিংস সেভ করতে ব্যর্থ হয়েছে');
    } finally {
      setSaving(false);
    }
  };

  const handleRunNow = async () => {
    try {
      setDispatching(true);
      const res = await fetch('/api/followups/dispatch', {
        method: 'POST',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Dispatch failed');
      }

      setLastSummary(data.summary);
      toast.success(
        `ফলোআপ কিউ সম্পন্ন! পাঠানো হয়েছে: ${data.summary.sent}, স্কিপ: ${data.summary.skipped}`
      );
      // Refresh logs
      fetchSettingsAndLogs();
    } catch (err: any) {
      toast.error(err.message || 'ফলোআপ রান করতে ব্যর্থ হয়েছে');
    } finally {
      setDispatching(false);
    }
  };

  const insertVariable = (
    field: 'abandoned_checkout_template' | 'advance_payment_template',
    placeholder: string
  ) => {
    setSettings((prev) => ({
      ...prev,
      [field]: prev[field] + ' ' + placeholder,
    }));
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Automated Follow-ups & Recovery (অটোমেটেড ফলোআপ)
            </h2>
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-xs">
              <Zap className="mr-1 h-3 w-3" /> Auto Queue
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 sm:text-sm">
            অসম্পূর্ণ চেকআউট ড্রপ-অফ ও বকেয়া অগ্রিম ডেলিভারি চার্জের জন্য স্বয়ংক্রিয় শিডিউলড হোয়াটসঅ্যাপ মেসেজ।
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunNow}
            disabled={dispatching || loading}
            className="h-9 gap-1.5 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
          >
            {dispatching ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            Run Queue Now (এখনই রান করুন)
          </Button>

          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || loading}
            className="h-9 gap-1.5"
          >
            {saving ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Settings
          </Button>
        </div>
      </div>

      {lastSummary && (
        <Card className="border border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="h-5 w-5" />
              সর্বশেষ কিউ রান সম্পন্ন: মোট প্রসেস {lastSummary.processed} টি
            </div>
            <div className="flex items-center gap-4 text-xs sm:text-sm text-muted-foreground">
              <span>পাঠানো হয়েছে: <strong className="text-foreground">{lastSummary.sent}</strong></span>
              <span>স্কিপ: <strong className="text-foreground">{lastSummary.skipped}</strong></span>
              <span>ব্যর্থ: <strong className="text-foreground">{lastSummary.failed}</strong></span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grid of Triggers */}
      <div className="grid grid-cols-1 gap-6">
        {/* Trigger 1: Abandoned Checkout */}
        <Card className="border shadow-none">
          <CardHeader className="p-4 sm:p-5 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400">
                  <ShoppingBag className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">
                    1. Abandoned Checkout Recovery (অসম্পূর্ণ চেকআউট রিকভারি)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    গ্রাহক ল্যান্ডিং পেজে নাম/ফোন দিয়ে অর্ডার সম্পন্ন না করলে নির্ধারিত সময় পর স্বয়ংক্রিয় অফার মেসেজ যাবে।
                  </CardDescription>
                </div>
              </div>
              <Switch
                checked={settings.abandoned_checkout_enabled}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, abandoned_checkout_enabled: checked }))
                }
              />
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  ফলোআপ পাঠানোর বিরতি (মিনিট পর)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={15}
                    max={1440}
                    value={settings.abandoned_checkout_delay_minutes}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        abandoned_checkout_delay_minutes: Number(e.target.value) || 45,
                      }))
                    }
                    className="h-9 w-32"
                  />
                  <span className="text-xs text-muted-foreground">মিনিট (প্রস্তাবিত: ৪৫ মিনিট)</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  স্টোর ল্যান্ডিং ডোমেইন URL (ঐচ্ছিক)
                </Label>
                <Input
                  placeholder="https://yourstore.com"
                  value={settings.store_url || ''}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, store_url: e.target.value }))
                  }
                  className="h-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">WhatsApp রিকভারি মেসেজ টেমপ্লেট (বাংলা)</Label>
                <div className="flex flex-wrap gap-1">
                  {[
                    '{{customer_name}}',
                    '{{product_name}}',
                    '{{checkout_url}}',
                    '{{store_name}}',
                  ].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => insertVariable('abandoned_checkout_template', tag)}
                      className="text-[11px] px-2 py-0.5 bg-muted hover:bg-muted/80 rounded border text-muted-foreground"
                    >
                      +{tag}
                    </button>
                  ))}
                </div>
              </div>
              <Textarea
                rows={4}
                value={settings.abandoned_checkout_template}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    abandoned_checkout_template: e.target.value,
                  }))
                }
                className="text-xs sm:text-sm font-sans"
              />
            </div>
          </CardContent>
        </Card>

        {/* Trigger 2: Advance Payment Reminder */}
        <Card className="border shadow-none">
          <CardHeader className="p-4 sm:p-5 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-400">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">
                    2. Advance Delivery Charge Reminder (অগ্রিম ডেলিভারি ফি রিমাইন্ডার)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    যেসব অর্ডারে অগ্রিম ডেলিভারি চার্জ প্রযোজ্য কিন্তু এখনো পেমেন্ট আসেনি, তাদেরকে স্বয়ংক্রিয় বিকাশ/নগদ রিমাইন্ডার।
                  </CardDescription>
                </div>
              </div>
              <Switch
                checked={settings.advance_payment_enabled}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, advance_payment_enabled: checked }))
                }
              />
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  রিমাইন্ডার পাঠানোর বিরতি (ঘণ্টা পর)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={72}
                    value={settings.advance_payment_delay_hours}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        advance_payment_delay_hours: Number(e.target.value) || 2,
                      }))
                    }
                    className="h-9 w-32"
                  />
                  <span className="text-xs text-muted-foreground">ঘণ্টা (প্রস্তাবিত: ২ ঘণ্টা)</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  bKash / Nagad পেমেন্ট নম্বর
                </Label>
                <Input
                  placeholder="017XXXXXXXX (Personal / Merchant)"
                  value={settings.bkash_number || ''}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, bkash_number: e.target.value }))
                  }
                  className="h-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">WhatsApp পেমেন্ট রিমাইন্ডার টেমপ্লেট</Label>
                <div className="flex flex-wrap gap-1">
                  {[
                    '{{customer_name}}',
                    '{{order_id}}',
                    '{{advance_amount}}',
                    '{{bkash_number}}',
                    '{{store_name}}',
                  ].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => insertVariable('advance_payment_template', tag)}
                      className="text-[11px] px-2 py-0.5 bg-muted hover:bg-muted/80 rounded border text-muted-foreground"
                    >
                      +{tag}
                    </button>
                  ))}
                </div>
              </div>
              <Textarea
                rows={4}
                value={settings.advance_payment_template}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    advance_payment_template: e.target.value,
                  }))
                }
                className="text-xs sm:text-sm font-sans"
              />
            </div>
          </CardContent>
        </Card>

        {/* Trigger 3: Incomplete WhatsApp Chat */}
        <Card className="border shadow-none">
          <CardHeader className="p-4 sm:p-5 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-400">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">
                    3. WhatsApp Chat Lead Recovery (মেসেঞ্জার লিড রিকভারি)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    গ্রাহক ইনবক্সে পণ্যের প্রতি আগ্রহ দেখালেও পরবর্তীতে অর্ডার সম্পন্ন না করলে Meta 72h/24h উইন্ডোর মধ্যে অটো-ফলোআপ।
                  </CardDescription>
                </div>
              </div>
              <Switch
                checked={settings.incomplete_chat_enabled}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, incomplete_chat_enabled: checked }))
                }
              />
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 flex items-center gap-3 text-xs text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 text-blue-500" />
            <span>
              অ্যান্টি-স্প্যাম সুরক্ষার জন্য প্রতি গ্রাহককে সর্বোচ্চ ২-৩ টির বেশি ফলোআপ পাঠানো হবে না এবং গ্রাহক অসম্মতি জানালে সাথে সাথে কিউ বাতিল হয়ে যাবে।
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Logs Table */}
      <Card className="border shadow-none">
        <CardHeader className="p-4 sm:p-5 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                Follow-up Delivery Logs (সর্বশেষ ডেলিভারি লগ)
              </CardTitle>
              <CardDescription className="text-xs">
                স্বয়ংক্রিয়ভাবে প্রেরিত মেসেজগুলোর স্ট্যাটাস ও সময়সূচি
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchSettingsAndLogs}
              disabled={loading}
              className="h-8 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              এখনো কোনো ফলোআপ মেসেজ পাঠানো হয়নি। &quot;Run Queue Now&quot; বাটনে ক্লিক করে কিউ প্রসেস করুন।
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 text-muted-foreground border-b uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-4 font-medium">Customer</th>
                    <th className="py-2.5 px-4 font-medium">Trigger Type</th>
                    <th className="py-2.5 px-4 font-medium">Status</th>
                    <th className="py-2.5 px-4 font-medium">Message Preview</th>
                    <th className="py-2.5 px-4 font-medium">Date & Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/30">
                      <td className="py-2.5 px-4 font-medium text-foreground whitespace-nowrap">
                        {log.recipient_name || 'Customer'}
                        <div className="text-[11px] font-mono text-muted-foreground">
                          {log.recipient_phone}
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        {log.trigger_type === 'ABANDONED_CHECKOUT' && (
                          <Badge variant="outline" className="border-amber-500/40 text-amber-600 bg-amber-500/10 text-[10px]">
                            Abandoned Checkout
                          </Badge>
                        )}
                        {log.trigger_type === 'ADVANCE_PAYMENT' && (
                          <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 bg-emerald-500/10 text-[10px]">
                            Advance Payment
                          </Badge>
                        )}
                        {log.trigger_type === 'INCOMPLETE_CHAT' && (
                          <Badge variant="outline" className="border-blue-500/40 text-blue-600 bg-blue-500/10 text-[10px]">
                            Incomplete Chat
                          </Badge>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        {log.status === 'SENT' && (
                          <Badge className="bg-emerald-600 text-white text-[10px]">
                            Sent
                          </Badge>
                        )}
                        {log.status === 'SKIPPED' && (
                          <Badge variant="secondary" className="text-[10px]">
                            Skipped
                          </Badge>
                        )}
                        {log.status === 'FAILED' && (
                          <Badge variant="destructive" className="text-[10px]">
                            Failed
                          </Badge>
                        )}
                      </td>
                      <td className="py-2.5 px-4 max-w-xs truncate text-muted-foreground" title={log.message_text}>
                        {log.message_text.slice(0, 75)}...
                      </td>
                      <td className="py-2.5 px-4 text-muted-foreground whitespace-nowrap">
                        {log.created_at
                          ? format(new Date(log.created_at), 'dd MMM yyyy, hh:mm a')
                          : '—'}
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
