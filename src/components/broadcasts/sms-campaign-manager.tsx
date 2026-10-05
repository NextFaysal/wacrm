'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  MessageSquare,
  Users,
  Send,
  Sparkles,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Loader2,
  Tag,
  Link as LinkIcon,
  Flame,
  Award,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';

interface SegmentSummary {
  key: string;
  title: string;
  description: string;
  count: number;
  badge: string;
  color: string;
}

interface SmsCampaign {
  id: string;
  name: string;
  segment_type: string;
  message_template: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed';
  created_at: string;
}

const PRESET_TEMPLATES = [
  {
    title: '⚡ ফ্ল্যাশ সেল ও ডিসকাউন্ট (Flash Sale)',
    text: 'আসসালামু আলাইকুম {name}! আমাদের স্পেশাল ফ্ল্যাশ সেলে পাচ্ছেন বিশেষ ডিসকাউন্ট। কুপন কোড: {coupon} ব্যবহার করে অর্ডার করুন: {link}',
  },
  {
    title: '💎 ভিআইপি কাস্টমার অফার (VIP Exclusive)',
    text: 'প্রিয় {name}, আমাদের মূল্যবান ভিআইপি কাস্টমার হিসেবে আপনার জন্য রয়েছে বিশেষ উপহার ও ফ্রি ডেলিভারি! কুপন: {coupon}। ভিজিট করুন: {link}',
  },
  {
    title: '🛒 ইনঅ্যাক্টিভ রি-এনগেজমেন্ট (Win Back)',
    text: 'আসসালামু আলাইকুম {name}! অনেক দিন আপনার কোনো অর্ডার পাইনি। আপনাকে ফিরিয়ে আনতে আমরা দিচ্ছি আকর্ষণীয় ছাড়! কুপন: {coupon}। দেখুন: {link}',
  },
  {
    title: '📦 অ্যাবান্ডনড কার্ট অফার (Cart Recovery)',
    text: 'প্রিয় {name}, আপনার পছন্দের আইটেমটি স্টকে শেষ হওয়ার আগেই অর্ডার কনফার্ম করুন! আজই অর্ডার করলে পাচ্ছেন বিশেষ উপহার: {link}',
  },
];

export function SmsCampaignManager() {
  const [segments, setSegments] = useState<SegmentSummary[]>([]);
  const [campaigns, setCampaigns] = useState<SmsCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Form State
  const [selectedSegment, setSelectedSegment] = useState<string>('VIP_SPENDERS');
  const [campaignName, setCampaignName] = useState('Weekend Flash Sale Blast');
  const [messageTemplate, setMessageTemplate] = useState(PRESET_TEMPLATES[0].text);
  const [couponCode, setCouponCode] = useState('SPECIAL10');
  const [promoUrl, setPromoUrl] = useState('https://wacrm.live');

  // Test SMS Dialog
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  // Confirmation Dialog
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  // Fetch Segment Stats & Campaigns
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [segRes, campRes] = await Promise.all([
        fetch('/api/audience/segments'),
        fetch('/api/sms/broadcast'),
      ]);

      if (segRes.ok) {
        const segData = await segRes.json();
        setSegments(segData.summaries || []);
      }

      if (campRes.ok) {
        const campData = await campRes.json();
        setCampaigns(campData.campaigns || []);
      }
    } catch {
      toast.error('তথ্য লোড করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Selected Segment Details
  const activeSegmentData = useMemo(() => {
    return segments.find((s) => s.key === selectedSegment) || segments[0];
  }, [segments, selectedSegment]);

  // Message stats (Bangla / GSM Detection)
  const isUnicode = useMemo(() => {
    // Check for non-ASCII characters
    return /[^\u0000-\u007f]/.test(messageTemplate);
  }, [messageTemplate]);

  const charCount = messageTemplate.length;
  const maxCharsPerSms = isUnicode ? 70 : 160;
  const smsParts = Math.max(1, Math.ceil(charCount / maxCharsPerSms));
  const estimatedCost = (activeSegmentData?.count || 0) * smsParts * 0.35;

  // Insert Variable into Template
  const handleInsertTag = (tag: string) => {
    setMessageTemplate((prev) => `${prev} ${tag}`);
  };

  // Preview Message
  const previewMessage = useMemo(() => {
    return messageTemplate
      .replace(/{name}/g, 'ফয়সাল মোল্লা')
      .replace(/{coupon}/g, couponCode || 'SPECIAL10')
      .replace(/{link}/g, promoUrl || 'https://wacrm.live');
  }, [messageTemplate, couponCode, promoUrl]);

  // Send Test SMS
  const handleSendTestSms = async () => {
    if (!testPhone.trim()) {
      toast.error('অনুগ্রহ করে টেস্ট নম্বর দিন');
      return;
    }
    try {
      setSendingTest(true);
      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: testPhone,
          message: previewMessage,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`টেস্ট SMS পাঠানো হয়েছে (${data.provider})`);
        setTestModalOpen(false);
      } else {
        toast.error(data.error || 'টেস্ট SMS পাঠাতে ব্যর্থ');
      }
    } catch {
      toast.error('সার্ভার যোগাযোগে ত্রুটি');
    } finally {
      setSendingTest(false);
    }
  };

  // Launch Campaign Broadcast
  const handleLaunchCampaign = async () => {
    if (!campaignName.trim() || !messageTemplate.trim()) {
      toast.error('ক্যাম্পেইনের নাম এবং মেসেজ পূরণ করুন');
      return;
    }

    try {
      setSending(true);
      setConfirmModalOpen(false);
      const res = await fetch('/api/sms/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignName,
          segmentType: selectedSegment,
          messageTemplate,
          couponCode,
          promoUrl,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`ক্যাম্পেইন সম্পন্ন! ${data.sentCount} টি SMS সফলভাবে পাঠানো হয়েছে`);
        fetchData();
      } else {
        toast.error(data.error || 'ক্যাম্পেইন পাঠাতে ত্রুটি');
      }
    } catch {
      toast.error('সার্ভারে সমস্যা হয়েছে');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-5 rounded-xl border shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-primary/10 text-primary">
              <MessageSquare className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold tracking-tight">স্মার্ট SMS মার্কেটিং ও ফ্লাশ সেল ইঞ্জিন</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            গ্রিনওয়েব, বাল্কএসএমএসবিডি ও আলফা এসএমএস গেটওয়ে ব্যবহার করে কাস্টমার সেগমেন্টে সরাসরি প্রচার চালান
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setTestModalOpen(true)} className="gap-2">
            <Smartphone className="w-4 h-4 text-emerald-600" /> টেস্ট SMS পাঠান
          </Button>
          <Button variant="ghost" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* 1. Dynamic Audience Segment Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> টার্গেট অডিয়েন্স সেগমেন্ট নির্বাচন করুন
          </h3>
          <span className="text-xs text-muted-foreground">রিয়েল-টাইম লাইভ ডাটাবেজ ফিল্টারিং</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {segments.map((seg) => {
            const isSelected = selectedSegment === seg.key;
            return (
              <div
                key={seg.key}
                onClick={() => setSelectedSegment(seg.key)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-primary ring-2 ring-primary/20 bg-primary/5 shadow-sm'
                    : 'bg-card hover:border-muted-foreground/30 hover:shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <Badge variant="outline" className={`text-xs font-semibold ${seg.color}`}>
                    {seg.badge}
                  </Badge>
                  <span className="text-lg font-bold text-foreground tabular-nums">
                    {seg.count.toLocaleString('en-BD')} জন
                  </span>
                </div>
                <h4 className="text-xs font-semibold text-foreground line-clamp-1">{seg.title}</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{seg.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Campaign Setup & Live Smartphone Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Editor Form */}
        <div className="lg:col-span-7 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" /> ক্যাম্পেইন কনফিগারেশন
              </CardTitle>
              <CardDescription>
                ক্যাম্পেইনের নাম, কুপন এবং ডায়নামিক ভ্যারিয়েবল সেট করুন
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs font-semibold">ক্যাম্পেইনের নাম</Label>
                <Input
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="যেমন: Eid Special 10% Off"
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-primary" /> কুপন কোড ({`{coupon}`})
                  </Label>
                  <Input
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="EID2026"
                    className="mt-1 font-mono uppercase"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <LinkIcon className="w-3.5 h-3.5 text-primary" /> ওয়েবসাইট লিংক ({`{link}`})
                  </Label>
                  <Input
                    value={promoUrl}
                    onChange={(e) => setPromoUrl(e.target.value)}
                    placeholder="https://wacrm.live"
                    className="mt-1 font-mono text-xs"
                  />
                </div>
              </div>

              {/* Preset Templates */}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                  দ্রুত টেমপ্লেট নির্বাচন করুন
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {PRESET_TEMPLATES.map((tmpl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setMessageTemplate(tmpl.text)}
                      className="text-left text-xs p-2 rounded-lg border bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground transition-all line-clamp-1"
                    >
                      {tmpl.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Body */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs font-semibold">SMS কনটেন্ট (Message Body)</Label>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => handleInsertTag('{name}')}
                      className="text-[11px] h-6 px-1.5"
                    >
                      + নাম
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => handleInsertTag('{coupon}')}
                      className="text-[11px] h-6 px-1.5"
                    >
                      + কুপন
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => handleInsertTag('{link}')}
                      className="text-[11px] h-6 px-1.5"
                    >
                      + লিংক
                    </Button>
                  </div>
                </div>

                <Textarea
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  rows={4}
                  className="font-sans text-sm resize-none"
                  placeholder="আপনার বার্তা বাংলায় বা ইংরেজিতে লিখুন..."
                />

                {/* SMS Billing Meta Info */}
                <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground mt-2 pt-2 border-t">
                  <div className="flex items-center gap-3">
                    <span>
                      ক্যারেক্টার: <strong className="text-foreground">{charCount}</strong>/{maxCharsPerSms}
                    </span>
                    <span>
                      টাইপ: <Badge variant="secondary" className="text-[10px] px-1 py-0">{isUnicode ? 'বাংলা (Unicode)' : 'English (GSM)'}</Badge>
                    </span>
                    <span>
                      পার্ট: <strong className="text-foreground">{smsParts} SMS</strong>
                    </span>
                  </div>
                  <div>
                    আনুমানিক খরচ: <strong className="text-emerald-600 font-semibold">৳{estimatedCost.toFixed(1)}</strong>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTestModalOpen(true)}
                  className="gap-1.5"
                >
                  <Smartphone className="w-4 h-4" /> টেস্ট পাঠান
                </Button>
                <Button
                  size="sm"
                  onClick={() => setConfirmModalOpen(true)}
                  disabled={sending || (activeSegmentData?.count || 0) === 0}
                  className="gap-2 bg-primary hover:bg-primary/90"
                >
                  {sending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> পাঠানো হচ্ছে...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> ক্যাম্পেইন লঞ্চ করুন ({activeSegmentData?.count || 0} জন)
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Smartphone Notification Mockup */}
        <div className="lg:col-span-5 flex flex-col items-center justify-start">
          <div className="w-full max-w-[320px] bg-slate-900 text-white rounded-[36px] p-4 shadow-xl border-4 border-slate-800 relative">
            {/* Speaker & Camera notch */}
            <div className="flex justify-center mb-3">
              <div className="h-4 w-28 bg-slate-800 rounded-full flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-950 mr-2" />
                <div className="w-8 h-1 rounded-full bg-slate-700" />
              </div>
            </div>

            {/* Lock screen top info */}
            <div className="text-center mb-4">
              <span className="text-3xl font-light tracking-tight">10:45</span>
              <p className="text-[10px] text-slate-400">রোববার, ৪ অক্টোবর</p>
            </div>

            {/* Live Message Notification Card */}
            <div className="bg-slate-800/90 backdrop-blur-md rounded-2xl p-3 border border-slate-700/60 shadow-lg text-left">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-md bg-emerald-500 flex items-center justify-center text-white">
                    <MessageSquare className="w-3 h-3" />
                  </div>
                  <span className="text-xs font-semibold text-slate-200">MESSAGES • WACRM</span>
                </div>
                <span className="text-[10px] text-slate-400">এখন</span>
              </div>
              <p className="text-xs text-slate-100 leading-relaxed font-sans whitespace-pre-wrap">
                {previewMessage}
              </p>
            </div>

            {/* Bottom bar indicator */}
            <div className="mt-8 flex justify-center">
              <div className="w-24 h-1 bg-slate-700 rounded-full" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> গ্রাহকের ফোনে যেভাবে প্রদর্শিত হবে
          </p>
        </div>
      </div>

      {/* 3. Campaign History Log */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" /> বিগত SMS ক্যাম্পেইন হিস্ট্রি
          </CardTitle>
          <CardDescription>
            পূর্বে প্রেরিত সকল বাল্ক এসএমএস প্রচারণার পূর্ণাঙ্গ অডিট ও ডেলিভারি স্ট্যাটাস
          </CardDescription>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              কোনো ক্যাম্পেইন পাওয়া যায়নি। ওপরের ফর্ম ব্যবহার করে প্রথম ক্যাম্পেইন শুরু করুন!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-muted-foreground border-b uppercase">
                  <tr>
                    <th className="py-2.5 px-3">ক্যাম্পেইনের নাম</th>
                    <th className="py-2.5 px-3">টার্গেট সেগমেন্ট</th>
                    <th className="py-2.5 px-3 text-center">মোট প্রাপক</th>
                    <th className="py-2.5 px-3 text-center">সফল</th>
                    <th className="py-2.5 px-3 text-center">ব্যর্থ</th>
                    <th className="py-2.5 px-3 text-center">স্ট্যাটাস</th>
                    <th className="py-2.5 px-3 text-right">তারিখ</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {campaigns.map((camp) => (
                    <tr key={camp.id} className="hover:bg-muted/30">
                      <td className="py-3 px-3 font-semibold text-foreground">
                        {camp.name}
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant="outline" className="text-[10px]">
                          {camp.segment_type}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-center font-mono">
                        {camp.total_recipients}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-emerald-600 font-semibold">
                        {camp.sent_count}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-rose-500">
                        {camp.failed_count}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Badge
                          variant="secondary"
                          className={
                            camp.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 border-emerald-200'
                              : camp.status === 'sending'
                              ? 'bg-blue-50 text-blue-700 animate-pulse'
                              : 'bg-rose-50 text-rose-700'
                          }
                        >
                          {camp.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-right text-muted-foreground">
                        {new Date(camp.created_at).toLocaleDateString('bn-BD', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test SMS Dialog */}
      <Dialog open={testModalOpen} onOpenChange={setTestModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-primary" /> টেস্ট SMS পাঠান
            </DialogTitle>
            <DialogDescription>
              ক্যাম্পেইন লঞ্চ করার পূর্বে আপনার নিজের নম্বরে একটি প্রিভিউ মেসেজ পাঠিয়ে যাচাই করুন
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-semibold">আপনার মোবাইল নম্বর</Label>
              <Input
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="017XXXXXXXX"
                className="mt-1 font-mono"
              />
            </div>
            <div className="p-3 bg-muted rounded-lg text-xs space-y-1">
              <span className="font-semibold text-muted-foreground">প্রেরণযোগ্য প্রিভিউ মেসেজ:</span>
              <p className="text-foreground italic">{previewMessage}</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setTestModalOpen(false)}>
              বাতিল
            </Button>
            <Button
              size="sm"
              onClick={handleSendTestSms}
              disabled={sendingTest}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              {sendingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              টেস্ট মেসেজ পাঠান
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertCircle className="w-5 h-5" /> ক্যাম্পেইন নিশ্চিতকরণ
            </DialogTitle>
            <DialogDescription>
              আপনি কি নিশ্চিত যে এই ক্যাম্পেইনটি এখনই প্রেরণ করতে চান?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2 text-xs">
            <div className="flex justify-between py-1 border-b">
              <span className="text-muted-foreground">টার্গেট সেগমেন্ট:</span>
              <strong className="text-foreground">{activeSegmentData?.title}</strong>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span className="text-muted-foreground">মোট প্রাপক:</span>
              <strong className="text-foreground font-mono">{activeSegmentData?.count} জন</strong>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span className="text-muted-foreground">SMS পার্টস:</span>
              <strong className="text-foreground font-mono">{smsParts} SMS / প্রতি গ্রাহক</strong>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span className="text-muted-foreground">আনুমানিক খরচ:</span>
              <strong className="text-emerald-600 font-semibold font-mono">৳{estimatedCost.toFixed(1)}</strong>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmModalOpen(false)}>
              ফিরে যান
            </Button>
            <Button
              size="sm"
              onClick={handleLaunchCampaign}
              className="gap-2 bg-primary hover:bg-primary/90"
            >
              <Send className="w-4 h-4" /> নিশ্চিত করুন ও লঞ্চ করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
