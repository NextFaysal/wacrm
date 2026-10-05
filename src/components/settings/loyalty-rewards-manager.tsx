'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Crown,
  Award,
  Coins,
  Gift,
  Users,
  Search,
  Plus,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Percent,
  Check,
  Edit3,
} from 'lucide-react';
import { toast } from 'sonner';

interface LoyaltyMember {
  id: string;
  customer_phone: string;
  customer_name?: string | null;
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'VIP';
  points_balance: number;
  cashback_balance: number;
  total_spend: number;
  total_orders: number;
  last_order_at?: string | null;
  created_at: string;
}

export function LoyaltyRewardsManager() {
  const [members, setMembers] = useState<LoyaltyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Settings State
  const [programEnabled, setProgramEnabled] = useState(true);
  const [pointsPerHundred, setPointsPerHundred] = useState('1');
  const [pointRedeemValue, setPointRedeemValue] = useState('0.50');
  const [cashbackPercent, setCashbackPercent] = useState('2');

  // Adjustment Modal
  const [selectedMember, setSelectedMember] = useState<LoyaltyMember | null>(null);
  const [adjustPoints, setAdjustPoints] = useState('50');
  const [adjustCashback, setAdjustCashback] = useState('0');
  const [adjustReason, setAdjustReason] = useState('কাস্টমার লয়ালটি বোনাস');
  const [isAdjusting, setIsAdjusting] = useState(false);

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/loyalty');
      const data = await res.json();
      if (res.ok && data.members) {
        setMembers(data.members);
      }
    } catch {
      toast.error('লয়ালটি ডেটা লোড করা সম্ভব হয়নি');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleAdjustPoints = async () => {
    if (!selectedMember) return;
    try {
      setIsAdjusting(true);
      const res = await fetch('/api/loyalty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'adjust',
          phone: selectedMember.customer_phone,
          customerName: selectedMember.customer_name,
          pointsDelta: parseInt(adjustPoints, 10) || 0,
          cashbackDelta: parseFloat(adjustCashback) || 0,
          description: adjustReason,
        }),
      });

      if (res.ok) {
        toast.success('পয়েন্ট / ক্যাশব্যাক সফলভাবে সমন্বয় করা হয়েছে');
        setSelectedMember(null);
        fetchMembers();
      } else {
        const d = await res.json();
        toast.error(d.error || 'সমন্বয় করতে ব্যর্থ');
      }
    } catch {
      toast.error('নেটওয়ার্ক সমস্যা');
    } finally {
      setIsAdjusting(false);
    }
  };

  const filteredMembers = members.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      m.customer_phone.includes(q) ||
      (m.customer_name && m.customer_name.toLowerCase().includes(q)) ||
      m.tier.toLowerCase().includes(q)
    );
  });

  const vipCount = members.filter((m) => m.tier === 'VIP').length;
  const goldCount = members.filter((m) => m.tier === 'GOLD').length;
  const totalPoints = members.reduce((acc, m) => acc + (m.points_balance || 0), 0);
  const totalCashback = members.reduce((acc, m) => acc + (Number(m.cashback_balance) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-500" />
            কাস্টমার লয়ালটি ও ক্যাশব্যাক রিওয়ার্ডস (Loyalty Program)
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            নিয়মিত ক্রেতাদের VIP টায়ার, রিওয়ার্ড পয়েন্ট ও ক্যাশব্যাক দিয়ে বিক্রয় দ্বিগুণ করুন
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchMembers}
            disabled={loading}
            className="h-8 text-xs gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            রিফ্রেশ
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4 bg-card border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">মোট সদস্য</p>
              <h3 className="text-xl font-bold text-foreground mt-0.5">{members.length}</h3>
              <p className="text-[10px] text-muted-foreground">নিবন্ধিত ক্রেতা</p>
            </div>
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">VIP ও গোল্ড সদস্য</p>
              <h3 className="text-xl font-bold text-amber-500 mt-0.5">{vipCount + goldCount}</h3>
              <p className="text-[10px] text-muted-foreground">VIP: {vipCount} | Gold: {goldCount}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500">
              <Crown className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">মোট রিওয়ার্ড পয়েন্ট</p>
              <h3 className="text-xl font-bold text-indigo-500 mt-0.5">{totalPoints.toLocaleString()}</h3>
              <p className="text-[10px] text-muted-foreground">অর্জিত পয়েন্ট ব্যালেন্স</p>
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-500">
              <Coins className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">মোট ক্যাশব্যাক ব্যালেন্স</p>
              <h3 className="text-xl font-bold text-emerald-500 mt-0.5">৳{totalCashback.toLocaleString()}</h3>
              <p className="text-[10px] text-muted-foreground">রিডিম উপযোগী</p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
              <Gift className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Program Settings */}
      <Card className="border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> লয়ালটি পয়েন্ট ও ক্যাশব্যাক কনফিগারেশন
          </CardTitle>
          <CardDescription className="text-xs">
            গ্রাহক প্রতি অর্ডারে কত পয়েন্ট পাবে এবং পয়েন্ট রূপান্তরের হার নির্ধারণ করুন
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <Label className="text-xs font-semibold">পয়েন্ট অর্জনের হার</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="number"
                  value={pointsPerHundred}
                  onChange={(e) => setPointsPerHundred(e.target.value)}
                  className="h-9 font-mono"
                />
                <span className="text-muted-foreground text-xs shrink-0">পয়েন্ট / প্রতি ৳১০০</span>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">১ পয়েন্টের মূল্য (টাকা)</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="number"
                  step="0.1"
                  value={pointRedeemValue}
                  onChange={(e) => setPointRedeemValue(e.target.value)}
                  className="h-9 font-mono"
                />
                <span className="text-muted-foreground text-xs shrink-0">টাকা</span>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">ক্যাশব্যাক পার্সেন্টেজ (%)</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="number"
                  value={cashbackPercent}
                  onChange={(e) => setCashbackPercent(e.target.value)}
                  className="h-9 font-mono"
                />
                <span className="text-muted-foreground text-xs shrink-0">% অফার</span>
              </div>
            </div>
          </div>

          <div className="bg-muted/40 p-3 rounded-xl flex items-center justify-between text-xs">
            <div>
              <p className="font-semibold text-foreground">স্বয়ংক্রিয় হোয়াটসঅ্যাপ ভিআইপি অভিনন্দন বার্তা</p>
              <p className="text-muted-foreground text-[11px]">
                কাস্টমার নতুন কোনো টায়ারে (যেমন Gold বা VIP) উত্তীর্ণ হলে স্বয়ংক্রিয়ভাবে মেসেজ চলে যাবে।
              </p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* Member Leaderboard */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
            <Award className="w-4 h-4 text-primary" /> লয়ালটি লিডারবোর্ড ও গ্রাহক তালিকা
          </h3>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="মোবাইল বা নাম দিয়ে খুঁজুন..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 opacity-50" />
            লয়ালটি মেম্বার তালিকা লোড হচ্ছে...
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="py-12 border border-dashed rounded-xl text-center bg-muted/10 text-xs">
            <Crown className="w-8 h-8 text-muted-foreground/40 mx-auto mb-1.5" />
            <p className="font-medium text-foreground">কোন লয়ালটি সদস্য পাওয়া যায়নি</p>
            <p className="text-muted-foreground mt-0.5">
              অর্ডার সম্পন্ন হওয়ার পর গ্রাহকরা স্বয়ংক্রিয়ভাবে পয়েন্ট পেয়ে তালিকায় যুক্ত হবেন।
            </p>
          </div>
        ) : (
          <div className="border rounded-xl divide-y bg-card overflow-hidden">
            <div className="grid grid-cols-12 px-4 py-2.5 bg-muted/50 text-[11px] font-semibold text-muted-foreground">
              <div className="col-span-4">গ্রাহক</div>
              <div className="col-span-2 text-center">টায়ার (Tier)</div>
              <div className="col-span-2 text-center">পয়েন্ট ব্যালেন্স</div>
              <div className="col-span-2 text-right">মোট ক্রয়</div>
              <div className="col-span-2 text-right">অ্যাকশন</div>
            </div>

            {filteredMembers.map((m) => (
              <div
                key={m.id}
                className="grid grid-cols-12 px-4 py-3 items-center text-xs hover:bg-muted/30 transition-colors"
              >
                <div className="col-span-4 min-w-0 pr-2">
                  <p className="font-medium text-foreground truncate">
                    {m.customer_name || 'Customer'}
                  </p>
                  <p className="font-mono text-muted-foreground text-[11px]">{m.customer_phone}</p>
                </div>

                <div className="col-span-2 text-center">
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-bold ${
                      m.tier === 'VIP'
                        ? 'border-purple-500/50 text-purple-600 bg-purple-500/10'
                        : m.tier === 'GOLD'
                        ? 'border-amber-500/50 text-amber-600 bg-amber-500/10'
                        : m.tier === 'SILVER'
                        ? 'border-slate-500/50 text-slate-600 bg-slate-500/10'
                        : 'border-muted text-muted-foreground'
                    }`}
                  >
                    {m.tier === 'VIP'
                      ? '🌟 VIP'
                      : m.tier === 'GOLD'
                      ? '👑 GOLD'
                      : m.tier === 'SILVER'
                      ? '🥈 SILVER'
                      : '🥉 BRONZE'}
                  </Badge>
                </div>

                <div className="col-span-2 text-center font-mono font-bold text-primary">
                  {m.points_balance} pts
                  <span className="text-[10px] text-emerald-600 block font-normal">
                    ৳{m.cashback_balance} ক্যাশব্যাক
                  </span>
                </div>

                <div className="col-span-2 text-right font-mono">
                  <p className="font-bold text-foreground">৳{m.total_spend?.toLocaleString() || 0}</p>
                  <p className="text-[10px] text-muted-foreground">{m.total_orders || 0} টি অর্ডার</p>
                </div>

                <div className="col-span-2 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => {
                      setSelectedMember(m);
                      setAdjustPoints('50');
                      setAdjustCashback('0');
                    }}
                  >
                    <Edit3 className="w-3 h-3 text-muted-foreground" />
                    সমন্বয়
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MANUAL ADJUSTMENT DIALOG */}
      {selectedMember && (
        <Dialog open={!!selectedMember} onOpenChange={() => setSelectedMember(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-500" /> পয়েন্ট বা ক্যাশব্যাক সমন্বয়
              </DialogTitle>
              <DialogDescription className="text-xs">
                গ্রাহক: {selectedMember.customer_name || 'Customer'} ({selectedMember.customer_phone})
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="bg-muted/40 p-3 rounded-lg flex justify-between items-center">
                <span>বর্তমান ব্যালেন্স:</span>
                <span className="font-bold font-mono text-primary">
                  {selectedMember.points_balance} Points • ৳{selectedMember.cashback_balance} Cashback
                </span>
              </div>

              <div>
                <Label className="text-xs font-semibold">যোগ / বিয়োগ করার পয়েন্ট</Label>
                <Input
                  type="number"
                  placeholder="+50 বা -20"
                  value={adjustPoints}
                  onChange={(e) => setAdjustPoints(e.target.value)}
                  className="h-9 mt-1 text-xs font-mono"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">যোগ / বিয়োগ করার ক্যাশব্যাক (৳)</Label>
                <Input
                  type="number"
                  placeholder="যেমন 100"
                  value={adjustCashback}
                  onChange={(e) => setAdjustCashback(e.target.value)}
                  className="h-9 mt-1 text-xs font-mono"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">কারণ বা নোট</Label>
                <Input
                  placeholder="যেমন: বিশেষ অফার বোনাস"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="h-9 mt-1 text-xs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setSelectedMember(null)}>
                বাতিল
              </Button>
              <Button
                size="sm"
                onClick={handleAdjustPoints}
                disabled={isAdjusting}
                className="font-bold gap-1.5"
              >
                {isAdjusting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                সংরক্ষণ করুন
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
