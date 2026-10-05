'use client';

import { useState, useEffect } from 'react';
import {
  CreditCard,
  Save,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Eye,
  EyeOff,
  Sparkles,
  Smartphone,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function PaymentGatewaysManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showBkashSecret, setShowBkashSecret] = useState(false);
  const [showBkashPassword, setShowBkashPassword] = useState(false);

  // bKash State
  const [bkashEnabled, setBkashEnabled] = useState(false);
  const [bkashSandbox, setBkashSandbox] = useState(true);
  const [bkashAppKey, setBkashAppKey] = useState('');
  const [bkashAppSecret, setBkashAppSecret] = useState('');
  const [bkashUsername, setBkashUsername] = useState('');
  const [bkashPassword, setBkashPassword] = useState('');
  const [bkashPersonalNumber, setBkashPersonalNumber] = useState('');
  const [bkashMerchantNumber, setBkashMerchantNumber] = useState('');

  // Nagad State
  const [nagadEnabled, setNagadEnabled] = useState(false);
  const [nagadSandbox, setNagadSandbox] = useState(true);
  const [nagadMerchantId, setNagadMerchantId] = useState('');
  const [nagadPersonalNumber, setNagadPersonalNumber] = useState('');

  useEffect(() => {
    async function loadGateways() {
      try {
        const res = await fetch('/api/payment/gateways');
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.warn('[loadGateways] failed:', errData.error || res.statusText);
          return;
        }
        const data = await res.json();
        const gateways = data.gateways || [];

        const bkash = gateways.find((g: { gateway: string }) => g.gateway === 'bkash');
        if (bkash) {
          setBkashEnabled(bkash.is_enabled);
          setBkashSandbox(bkash.is_sandbox);
          setBkashAppKey(bkash.config?.app_key || '');
          setBkashAppSecret(bkash.config?.app_secret || '');
          setBkashUsername(bkash.config?.username || '');
          setBkashPassword(bkash.config?.password || '');
          setBkashPersonalNumber(bkash.config?.personal_number || '');
          setBkashMerchantNumber(bkash.config?.merchant_number || '');
        }

        const nagad = gateways.find((g: { gateway: string }) => g.gateway === 'nagad');
        if (nagad) {
          setNagadEnabled(nagad.is_enabled);
          setNagadSandbox(nagad.is_sandbox);
          setNagadMerchantId(nagad.config?.merchant_id || '');
          setNagadPersonalNumber(nagad.config?.personal_number || '');
        }
      } catch (err) {
        console.error('[loadGateways] error:', err);
      } finally {
        setLoading(false);
      }
    }

    loadGateways();
  }, []);

  const handleSaveBkash = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/payment/gateways', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gateway: 'bkash',
          is_enabled: bkashEnabled,
          is_sandbox: bkashSandbox,
          display_name: 'bKash Tokenized Checkout',
          config: {
            app_key: bkashAppKey.trim(),
            app_secret: bkashAppSecret.trim(),
            username: bkashUsername.trim(),
            password: bkashPassword.trim(),
            personal_number: bkashPersonalNumber.trim(),
            merchant_number: bkashMerchantNumber.trim(),
          },
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Save failed');
      }
      toast.success('bKash গেটওয়ে সেটিংস সফলভাবে সংরক্ষিত হয়েছে!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'সংরক্ষণে সমস্যা হয়েছে';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNagad = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/payment/gateways', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gateway: 'nagad',
          is_enabled: nagadEnabled,
          is_sandbox: nagadSandbox,
          display_name: 'Nagad Gateway',
          config: {
            merchant_id: nagadMerchantId.trim(),
            personal_number: nagadPersonalNumber.trim(),
          },
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Save failed');
      }
      toast.success('নগদ গেটওয়ে সেটিংস সফলভাবে সংরক্ষিত হয়েছে!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'সংরক্ষণে সমস্যা হয়েছে';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
        <ShieldCheck className="size-5 text-primary shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-semibold text-foreground">
            স্বয়ংক্রিয় পেমেন্ট গেটওয়ে ও ১-ক্লিক ডাইনামিক পে লিঙ্ক (bKash & Nagad)
          </p>
          <p className="text-muted-foreground leading-relaxed">
            গ্রাহক যখন চ্যাটে অর্ডার করবেন বা অগ্রিম ডেলিভারি ফি চাওয়া হবে, ইনবক্স থেকে সরাসরি ১-ক্লিকে
            পেমেন্ট লিঙ্ক তৈরি হবে। পেমেন্ট সম্পন্ন হলে অর্ডার স্বয়ংক্রিয়ভাবে Advance Paid হিসেবে আপডেট হবে
            এবং গ্রাহকের কাছে ডিজিটাল ক্যাশ রিসিপ্ট চলে যাবে।
          </p>
        </div>
      </div>

      <Tabs defaultValue="bkash" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="bkash" className="flex items-center gap-2">
            <span className="font-bold text-[#E2136E]">bKash</span>
            <span>বিকাশ গেটওয়ে</span>
          </TabsTrigger>
          <TabsTrigger value="nagad" className="flex items-center gap-2">
            <span className="font-bold text-[#F7941D]">Nagad</span>
            <span>নগদ গেটওয়ে</span>
          </TabsTrigger>
        </TabsList>

        {/* bKash Tab */}
        <TabsContent value="bkash" className="space-y-4 pt-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="size-4 text-[#E2136E]" />
                  bKash Tokenized Checkout API
                </CardTitle>
                <CardDescription className="text-xs">
                  Official bKash Merchant Payment Gateway Integration (Auto-Verification)
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="bkash-active" className="text-xs font-medium cursor-pointer">
                  {bkashEnabled ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                </Label>
                <Switch
                  id="bkash-active"
                  checked={bkashEnabled}
                  onCheckedChange={setBkashEnabled}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/40 text-xs">
                <div>
                  <span className="font-semibold block">টেস্টিং স্যান্ডবক্স মোড (Sandbox Mode)</span>
                  <span className="text-muted-foreground text-[11px]">
                    লাইভ পেমেন্ট নেয়ার পূর্বে স্যান্ডবক্স মোড দিয়ে টেস্ট করতে পারেন।
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {bkashSandbox ? 'SANDBOX' : 'LIVE'}
                  </span>
                  <Switch
                    checked={bkashSandbox}
                    onCheckedChange={setBkashSandbox}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="bkash-app-key">App Key *</Label>
                  <Input
                    id="bkash-app-key"
                    type="password"
                    placeholder="bKash Merchant App Key"
                    value={bkashAppKey}
                    onChange={(e) => setBkashAppKey(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="bkash-app-secret">App Secret *</Label>
                  <div className="relative">
                    <Input
                      id="bkash-app-secret"
                      type={showBkashSecret ? 'text' : 'password'}
                      placeholder="bKash App Secret"
                      value={bkashAppSecret}
                      onChange={(e) => setBkashAppSecret(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowBkashSecret(!showBkashSecret)}
                      className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                    >
                      {showBkashSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="bkash-username">Merchant Username *</Label>
                  <Input
                    id="bkash-username"
                    placeholder="sandboxUsername / liveUsername"
                    value={bkashUsername}
                    onChange={(e) => setBkashUsername(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="bkash-password">Merchant Password *</Label>
                  <div className="relative">
                    <Input
                      id="bkash-password"
                      type={showBkashPassword ? 'text' : 'password'}
                      placeholder="bKash Password"
                      value={bkashPassword}
                      onChange={(e) => setBkashPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowBkashPassword(!showBkashPassword)}
                      className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                    >
                      {showBkashPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Fallback / Manual bKash Numbers */}
              <div className="pt-2 border-t space-y-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                  ম্যানুয়াল সেন্ড মানি নম্বর (বিকল্প মাধ্যম)
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="bkash-personal">bKash Personal Number (Send Money)</Label>
                    <Input
                      id="bkash-personal"
                      placeholder="01XXXXXXXXX"
                      value={bkashPersonalNumber}
                      onChange={(e) => setBkashPersonalNumber(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bkash-merchant">bKash Merchant Number (Payment)</Label>
                    <Input
                      id="bkash-merchant"
                      placeholder="01XXXXXXXXX"
                      value={bkashMerchantNumber}
                      onChange={(e) => setBkashMerchantNumber(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleSaveBkash}
                  disabled={saving}
                  className="gap-2 bg-[#E2136E] hover:bg-[#c90f61] text-white"
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  bKash কনফিগারেশন সেভ করুন
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Nagad Tab */}
        <TabsContent value="nagad" className="space-y-4 pt-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Smartphone className="size-4 text-[#F7941D]" />
                  Nagad (নগদ) গেটওয়ে সেটিংস
                </CardTitle>
                <CardDescription className="text-xs">
                  Nagad Merchant Checkout & Direct Send Money Integration
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="nagad-active" className="text-xs font-medium cursor-pointer">
                  {nagadEnabled ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                </Label>
                <Switch
                  id="nagad-active"
                  checked={nagadEnabled}
                  onCheckedChange={setNagadEnabled}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="nagad-merchant-id">Nagad Merchant ID</Label>
                  <Input
                    id="nagad-merchant-id"
                    placeholder="e.g. 68001024"
                    value={nagadMerchantId}
                    onChange={(e) => setNagadMerchantId(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="nagad-personal">Nagad Personal Number (Send Money)</Label>
                  <Input
                    id="nagad-personal"
                    placeholder="01XXXXXXXXX"
                    value={nagadPersonalNumber}
                    onChange={(e) => setNagadPersonalNumber(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleSaveNagad}
                  disabled={saving}
                  className="gap-2 bg-[#F7941D] hover:bg-[#de8012] text-white"
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  নগদ সেটিংস সেভ করুন
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
