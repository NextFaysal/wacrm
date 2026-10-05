'use client';

import { useState, useEffect } from 'react';
import {
  MessageSquare,
  Save,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Send,
  Loader2,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function SmsGatewaysManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // Active provider
  const [activeProvider, setActiveProvider] = useState<'greenweb' | 'bulksmsbd' | 'alphasms' | 'mimsms'>('greenweb');

  // Greenweb
  const [greenwebEnabled, setGreenwebEnabled] = useState(false);
  const [greenwebToken, setGreenwebToken] = useState('');

  // BulkSMSBD
  const [bulkSmsEnabled, setBulkSmsEnabled] = useState(false);
  const [bulkSmsApiKey, setBulkSmsApiKey] = useState('');
  const [bulkSmsSenderId, setBulkSmsSenderId] = useState('');

  // AlphaSMS
  const [alphaEnabled, setAlphaEnabled] = useState(false);
  const [alphaApiKey, setAlphaApiKey] = useState('');
  const [alphaSenderId, setAlphaSenderId] = useState('');

  // Test SMS State
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('টেস্ট মেসেজ: WACRM SMS গেটওয়ে সফলভাবে সংযুক্ত হয়েছে!');

  useEffect(() => {
    async function loadGateways() {
      try {
        const res = await fetch('/api/sms/gateways');
        if (!res.ok) throw new Error('Failed to load gateways');
        const data = await res.json();
        const gateways = data.gateways || [];

        const gw = gateways.find((g: { provider: string }) => g.provider === 'greenweb');
        if (gw) {
          setGreenwebEnabled(gw.is_enabled);
          setGreenwebToken(gw.api_key || '');
        }

        const bsd = gateways.find((g: { provider: string }) => g.provider === 'bulksmsbd');
        if (bsd) {
          setBulkSmsEnabled(bsd.is_enabled);
          setBulkSmsApiKey(bsd.api_key || '');
          setBulkSmsSenderId(bsd.sender_id || '');
        }

        const alpha = gateways.find((g: { provider: string }) => g.provider === 'alphasms');
        if (alpha) {
          setAlphaEnabled(alpha.is_enabled);
          setAlphaApiKey(alpha.api_key || '');
          setAlphaSenderId(alpha.sender_id || '');
        }
      } catch {
        toast.error('SMS গেটওয়ে সেটিংস লোড করা যায়নি');
      } finally {
        setLoading(false);
      }
    }
    loadGateways();
  }, []);

  const handleSaveGreenweb = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/sms/gateways', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'greenweb',
          is_enabled: greenwebEnabled,
          api_key: greenwebToken.trim(),
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      toast.success('Greenweb SMS সেটিংস সংরক্ষিত হয়েছে!');
    } catch {
      toast.error('সংরক্ষণে সমস্যা হয়েছে');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBulkSms = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/sms/gateways', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'bulksmsbd',
          is_enabled: bulkSmsEnabled,
          api_key: bulkSmsApiKey.trim(),
          sender_id: bulkSmsSenderId.trim(),
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      toast.success('BulkSMSBD সেটিংস সংরক্ষিত হয়েছে!');
    } catch {
      toast.error('সংরক্ষণে সমস্যা হয়েছে');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAlpha = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/sms/gateways', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'alphasms',
          is_enabled: alphaEnabled,
          api_key: alphaApiKey.trim(),
          sender_id: alphaSenderId.trim(),
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      toast.success('Alpha SMS সেটিংস সংরক্ষিত হয়েছে!');
    } catch {
      toast.error('সংরক্ষণে সমস্যা হয়েছে');
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestSms = async () => {
    if (!testPhone.trim()) {
      toast.error('মোবাইল নম্বর লিখুন');
      return;
    }
    setTesting(true);
    try {
      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: testPhone.trim(),
          message: testMessage.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send');
      toast.success(`টেস্ট SMS সফলভাবে পাঠানো হয়েছে (${data.provider})!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'SMS সেন্ড ব্যর্থ হয়েছে');
    } finally {
      setTesting(false);
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
      {/* Overview Banner */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
        <ShieldCheck className="size-5 text-primary shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-semibold text-foreground">
            বাংলাদেশি SMS গেটওয়ে (Greenweb, BulkSMSBD, Alpha SMS) ও অটো OTP ভেরিফিকেশন
          </p>
          <p className="text-muted-foreground leading-relaxed">
            WhatsApp এর ২৪ ঘণ্টার উইন্ডো শেষ হয়ে গেলেও বা সরাসরি গ্রাহকের মোবাইলে অর্ডার নিশ্চিতকরণ
            OTP এবং কুরিয়ার ডেলিভারি পার্সেল ট্র্যাকিং লিংক SMS এর মাধ্যমে স্বয়ংক্রিয়ভাবে পাঠানো হবে।
          </p>
        </div>
      </div>

      <Tabs defaultValue="greenweb" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="greenweb">Greenweb BD</TabsTrigger>
          <TabsTrigger value="bulksmsbd">BulkSMSBD</TabsTrigger>
          <TabsTrigger value="alphasms">Alpha SMS</TabsTrigger>
        </TabsList>

        {/* Greenweb */}
        <TabsContent value="greenweb" className="space-y-4 pt-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base">Greenweb Bangladesh SMS API</CardTitle>
                <CardDescription className="text-xs">
                  Fast non-masking & masking delivery via Greenweb token
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="gw-enabled" className="text-xs font-medium cursor-pointer">
                  {greenwebEnabled ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                </Label>
                <Switch
                  id="gw-enabled"
                  checked={greenwebEnabled}
                  onCheckedChange={setGreenwebEnabled}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="gw-token">Greenweb API Token *</Label>
                <Input
                  id="gw-token"
                  type="password"
                  placeholder="e.g. 1029485764839201"
                  value={greenwebToken}
                  onChange={(e) => setGreenwebToken(e.target.value)}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveGreenweb} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  সংরক্ষণ করুন
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* BulkSMSBD */}
        <TabsContent value="bulksmsbd" className="space-y-4 pt-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base">BulkSMSBD API</CardTitle>
                <CardDescription className="text-xs">
                  BulkSMSBD.net REST SMS Gateway
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="bsd-enabled" className="text-xs font-medium cursor-pointer">
                  {bulkSmsEnabled ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                </Label>
                <Switch
                  id="bsd-enabled"
                  checked={bulkSmsEnabled}
                  onCheckedChange={setBulkSmsEnabled}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="bsd-key">API Key *</Label>
                  <Input
                    id="bsd-key"
                    type="password"
                    placeholder="API Key"
                    value={bulkSmsApiKey}
                    onChange={(e) => setBulkSmsApiKey(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bsd-sender">Sender ID (Masking/Non-masking)</Label>
                  <Input
                    id="bsd-sender"
                    placeholder="e.g. 8809612..."
                    value={bulkSmsSenderId}
                    onChange={(e) => setBulkSmsSenderId(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveBulkSms} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  সংরক্ষণ করুন
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AlphaSMS */}
        <TabsContent value="alphasms" className="space-y-4 pt-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base">Alpha SMS (sms.net.bd)</CardTitle>
                <CardDescription className="text-xs">
                  Reliable SMS gateway with instant DLR
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="alpha-enabled" className="text-xs font-medium cursor-pointer">
                  {alphaEnabled ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                </Label>
                <Switch
                  id="alpha-enabled"
                  checked={alphaEnabled}
                  onCheckedChange={setAlphaEnabled}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="alpha-key">Alpha API Key *</Label>
                  <Input
                    id="alpha-key"
                    type="password"
                    placeholder="Alpha SMS Key"
                    value={alphaApiKey}
                    onChange={(e) => setAlphaApiKey(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="alpha-sender">Sender ID</Label>
                  <Input
                    id="alpha-sender"
                    placeholder="Sender ID"
                    value={alphaSenderId}
                    onChange={(e) => setAlphaSenderId(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveAlpha} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  সংরক্ষণ করুন
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Test SMS Sender Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Smartphone className="size-4 text-primary" />
            টেস্ট SMS পাঠান
          </CardTitle>
          <CardDescription className="text-xs">
            গেটওয়ে কনফিগারেশন যাচাই করার জন্য যেকোনো নম্বরে টেস্ট SMS পাঠিয়ে ডেলিভারি চেক করুন।
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="test-phone">প্রাপকের মোবাইল নম্বর *</Label>
              <Input
                id="test-phone"
                placeholder="01XXXXXXXXX"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
              />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label htmlFor="test-msg">মেসেজ টেক্সট</Label>
              <div className="flex gap-2">
                <Input
                  id="test-msg"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                />
                <Button
                  onClick={handleSendTestSms}
                  disabled={testing}
                  className="gap-2 shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  {testing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  টেস্ট পাঠান
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
