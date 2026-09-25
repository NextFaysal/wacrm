'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import type { DeliveryZone, DeliverySettings as DeliverySettingsType } from '@/types/delivery';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  Truck,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Gift,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export function DeliverySettings() {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [settings, setSettings] = useState<DeliverySettingsType | null>(null);
  const [loading, setLoading] = useState(true);

  // Zone Modal
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [zoneFormData, setZoneFormData] = useState({
    name: '',
    code: '',
    charge: '100',
    is_free: false,
    estimated_time: '২৪ - ৪৮ ঘণ্টার মধ্যে',
    is_active: true,
  });
  const [isSubmittingZone, setIsSubmittingZone] = useState(false);

  // Settings Save State
  const [savingSettings, setSavingSettings] = useState(false);

  const fetchDeliveryData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/delivery');
      const data = await res.json();
      if (res.ok) {
        setZones(data.zones || []);
        setSettings(data.settings || null);
      } else {
        toast.error(data.error || 'Failed to load delivery configuration');
      }
    } catch {
      toast.error('Network error loading delivery settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDeliveryData();
  }, [fetchDeliveryData]);

  const openAddZoneModal = () => {
    setEditingZone(null);
    setZoneFormData({
      name: '',
      code: '',
      charge: '100',
      is_free: false,
      estimated_time: '২৪ - ৪৮ ঘণ্টার মধ্যে',
      is_active: true,
    });
    setIsZoneModalOpen(true);
  };

  const openEditZoneModal = (zone: DeliveryZone) => {
    setEditingZone(zone);
    setZoneFormData({
      name: zone.name,
      code: zone.code || '',
      charge: String(zone.charge),
      is_free: zone.is_free,
      estimated_time: zone.estimated_time || '২৪ - ৪৮ ঘণ্টার মধ্যে',
      is_active: zone.is_active,
    });
    setIsZoneModalOpen(true);
  };

  const handleSaveZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zoneFormData.name.trim()) {
      toast.error('এলাকার নাম পূরণ করুন');
      return;
    }

    try {
      setIsSubmittingZone(true);
      const payload = {
        name: zoneFormData.name.trim(),
        code: zoneFormData.code.trim() || undefined,
        charge: zoneFormData.is_free ? 0 : Number(zoneFormData.charge) || 0,
        is_free: zoneFormData.is_free,
        estimated_time: zoneFormData.estimated_time.trim(),
        is_active: zoneFormData.is_active,
      };

      if (editingZone) {
        const res = await fetch('/api/delivery/zones', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingZone.id, ...payload }),
        });
        const data = await res.json();
        if (res.ok && data.zone) {
          toast.success('ডেলিভারি এরিয়া আপডেট করা হয়েছে!');
          setIsZoneModalOpen(false);
          void fetchDeliveryData();
        } else {
          toast.error(data.error || 'আপডেট করতে সমস্যা হয়েছে');
        }
      } else {
        const res = await fetch('/api/delivery/zones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok && data.zone) {
          toast.success('নতুন ডেলিভারি এরিয়া যুক্ত করা হয়েছে!');
          setIsZoneModalOpen(false);
          void fetchDeliveryData();
        } else {
          toast.error(data.error || 'তৈরি করতে সমস্যা হয়েছে');
        }
      }
    } catch {
      toast.error('নেটওয়ার্ক ত্রুটি');
    } finally {
      setIsSubmittingZone(false);
    }
  };

  const handleDeleteZone = async (zoneId: string) => {
    if (!confirm('আপনি কি নিশ্চিতভাবে এই ডেলিভারি এরিয়াটি মুছে ফেলতে চান?')) return;
    try {
      const res = await fetch(`/api/delivery/zones?id=${zoneId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('ডেলিভারি এরিয়া মুছে ফেলা হয়েছে');
        setZones((prev) => prev.filter((z) => z.id !== zoneId));
      } else {
        const data = await res.json();
        toast.error(data.error || 'মুছতে ব্যর্থ হয়েছে');
      }
    } catch {
      toast.error('নেটওয়ার্ক ত্রুটি');
    }
  };

  const handleToggleZoneFree = async (zone: DeliveryZone) => {
    const nextFree = !zone.is_free;
    const nextCharge = nextFree ? 0 : (zone.charge === 0 ? 100 : zone.charge);

    setZones((prev) =>
      prev.map((z) => (z.id === zone.id ? { ...z, is_free: nextFree, charge: nextCharge } : z))
    );

    try {
      const res = await fetch('/api/delivery/zones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: zone.id, is_free: nextFree, charge: nextCharge }),
      });
      if (res.ok) {
        toast.success(nextFree ? `${zone.name}: ফ্রি ডেলিভারি চালু করা হয়েছে!` : `${zone.name}: পেইড ডেলিভারি (৳${nextCharge}) করা হয়েছে`);
      } else {
        void fetchDeliveryData();
      }
    } catch {
      void fetchDeliveryData();
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    try {
      setSavingSettings(true);
      const res = await fetch('/api/delivery/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('ডেলিভারি পলিসি ও প্রোমোশনাল রুলস সংরক্ষণ করা হয়েছে!');
      } else {
        toast.error(data.error || 'সংরক্ষণ ব্যর্থ হয়েছে');
      }
    } catch {
      toast.error('নেটওয়ার্ক ত্রুটি');
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
        <p className="text-sm">ডেলিভারি কনফিগারেশন লোড হচ্ছে...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            ডেলিভারি এরিয়া ও প্রাইসিং কন্ট্রোল
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            আপনার সুবিধা অনুযায়ী ডেলিভারি এলাকা, চার্জ (৳), এবং ফ্রি ডেলিভারি অফার ডায়নামিক ভাবে সেট করুন।
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchDeliveryData} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            রিফ্রেশ
          </Button>
          <Button onClick={openAddZoneModal} size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            নতুন এরিয়া যুক্ত করুন
          </Button>
        </div>
      </div>

      {/* Promotional Free Delivery Rules Card */}
      <Card className="border border-border/80 bg-card shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-foreground">
            <Gift className="h-5 w-5 text-amber-500" />
            ফ্রি ডেলিভারি অফার ও শর্তাবলী (Automated Free Delivery Rules)
          </CardTitle>
          <CardDescription>
            নির্দিষ্ট শর্ত পূরণ হলে কাস্টমার স্বয়ংক্রিয়ভাবে ফ্রি ডেলিভারি সুবিধা পাবে।
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            {/* Global Free Delivery Switch */}
            <div className="rounded-xl border border-border/60 p-4 bg-muted/20 space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="global_free" className="font-semibold text-xs cursor-pointer">
                  সারাদেশে ১০০% ফ্রি ডেলিভারি
                </Label>
                <Switch
                  id="global_free"
                  checked={settings?.free_delivery_global || false}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => (prev ? { ...prev, free_delivery_global: checked } : null))
                  }
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                চালু রাখলে সমস্ত এরিয়াতে সব অর্ডারে ডেলিভারি চার্জ সম্পূর্ণ ফ্রি (৳০) হবে।
              </p>
            </div>

            {/* Min Quantity for Free Delivery */}
            <div className="rounded-xl border border-border/60 p-4 bg-muted/20 space-y-2">
              <Label htmlFor="min_qty" className="font-semibold text-xs">
                ন্যূনতম কয়টি অর্ডারে ফ্রি ডেলিভারি?
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="min_qty"
                  type="number"
                  min="0"
                  value={settings?.free_delivery_min_qty ?? 2}
                  onChange={(e) =>
                    setSettings((prev) =>
                      prev ? { ...prev, free_delivery_min_qty: parseInt(e.target.value, 10) || 0 } : null
                    )
                  }
                  className="h-8 text-xs font-mono"
                  placeholder="2 (0 to disable)"
                />
                <span className="text-xs text-muted-foreground">পিস</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                কাস্টমার একসাথে এই পরিমাণের ঘড়ি নিলে ফ্রি ডেলিভারি পাবে (বন্ধ করতে 0 দিন)।
              </p>
            </div>

            {/* Min Amount for Free Delivery */}
            <div className="rounded-xl border border-border/60 p-4 bg-muted/20 space-y-2">
              <Label htmlFor="min_amount" className="font-semibold text-xs">
                ন্যূনতম কত টাকার অর্ডারে ফ্রি ডেলিভারি?
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="min_amount"
                  type="number"
                  min="0"
                  value={settings?.free_delivery_min_amount ?? 0}
                  onChange={(e) =>
                    setSettings((prev) =>
                      prev ? { ...prev, free_delivery_min_amount: parseFloat(e.target.value) || 0 } : null
                    )
                  }
                  className="h-8 text-xs font-mono"
                  placeholder="3000 (0 to disable)"
                />
                <span className="text-xs text-muted-foreground">টাকা</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                অর্ডারের মোট টাকার অংক এটি অতিক্রম করলে ফ্রি ডেলিভারি প্রযোজ্য হবে।
              </p>
            </div>
          </div>

          {/* Banner Text */}
          <div className="space-y-1.5 pt-1">
            <Label htmlFor="banner_text" className="text-xs font-semibold">
              সিঙ্গেল প্রোডাক্ট পেজের প্রোমোশনাল ব্যানার টেক্সট:
            </Label>
            <Input
              id="banner_text"
              value={settings?.free_delivery_banner_text || ''}
              onChange={(e) =>
                setSettings((prev) => (prev ? { ...prev, free_delivery_banner_text: e.target.value } : null))
              }
              placeholder="যেমন: 🎁 ধামাকা অফার: ২ বা ততোধিক পিস অর্ডার করলেই ডেলিভারি সম্পূর্ণ ফ্রি!"
              className="text-xs h-9"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button size="sm" onClick={handleSaveSettings} disabled={savingSettings}>
              {savingSettings ? 'সংরক্ষণ হচ্ছে...' : 'রুলস সংরক্ষণ করুন'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delivery Zones List Card */}
      <Card className="border border-border/80 bg-card shadow-xs">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base text-foreground">
              কনফিগার করা ডেলিভারি এরিয়াসমূহ ({zones.length})
            </CardTitle>
            <CardDescription>
              এই তালিকাটি কাস্টমারদের সিঙ্গেল প্রোডাক্ট অর্ডার পেজে সরাসরি ড্রপডাউন/বাটন হিসেবে দেখা যাবে।
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border/50">
            {zones.map((zone) => (
              <div
                key={zone.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="flex items-start sm:items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5 sm:mt-0">
                    <Truck className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-sm">{zone.name}</span>
                      {zone.is_free ? (
                        <Badge className="bg-emerald-600 text-white text-[10px] font-bold">
                          ফ্রি ডেলিভারি
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-500/40 text-amber-500 font-bold text-[10px]">
                          ৳{zone.charge} BDT
                        </Badge>
                      )}
                      {!zone.is_active && (
                        <Badge variant="secondary" className="text-[9px] text-muted-foreground">
                          নিষ্ক্রিয়
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {zone.estimated_time || '২৪ - ৪৮ ঘণ্টা'}
                      </span>
                      {zone.code && (
                        <span className="font-mono text-[10px] bg-muted px-1.5 py-0.2 rounded">
                          {zone.code}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {/* Quick Free Toggle */}
                  <div className="flex items-center gap-1.5 mr-2">
                    <Label htmlFor={`free-toggle-${zone.id}`} className="text-xs text-muted-foreground cursor-pointer">
                      ফ্রি করুন
                    </Label>
                    <Switch
                      id={`free-toggle-${zone.id}`}
                      checked={zone.is_free}
                      onCheckedChange={() => handleToggleZoneFree(zone)}
                    />
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => openEditZoneModal(zone)}
                  >
                    <Pencil className="h-3 w-3 mr-1" /> এডিট
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDeleteZone(zone.id)}
                    title="ডিলিট"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Add / Edit Zone Dialog */}
      <Dialog open={isZoneModalOpen} onOpenChange={setIsZoneModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Truck className="h-5 w-5 text-primary" />
              {editingZone ? 'ডেলিভারি এরিয়া সম্পাদনা করুন' : 'নতুন ডেলিভারি এরিয়া তৈরি করুন'}
            </DialogTitle>
            <DialogDescription>
              এলাকার নাম, ডেলিভারি চার্জ এবং সম্ভাব্য ডেলিভারি সময় নির্ধারণ করুন।
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveZone} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="zone_name">এলাকা / জোনের নাম *</Label>
              <Input
                id="zone_name"
                placeholder="যেমন: ঢাকার ভেতরে, চট্টগ্রাম সিটি, বা সাভার/গাজীপুর"
                value={zoneFormData.name}
                onChange={(e) => setZoneFormData({ ...zoneFormData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="zone_code">এরিয়া কোড (ঐচ্ছিক)</Label>
              <Input
                id="zone_code"
                placeholder="যেমন: inside_dhaka, ctg_city"
                value={zoneFormData.code}
                onChange={(e) => setZoneFormData({ ...zoneFormData, code: e.target.value })}
              />
            </div>

            {/* Free Delivery Toggle for this zone */}
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3 bg-muted/20">
              <div>
                <Label htmlFor="modal_is_free" className="font-semibold text-xs cursor-pointer block">
                  এই এলাকায় কি ডেলিভারি ফ্রি থাকবে?
                </Label>
                <span className="text-[10px] text-muted-foreground">চালু রাখলে চার্জ হবে ৳০</span>
              </div>
              <Switch
                id="modal_is_free"
                checked={zoneFormData.is_free}
                onCheckedChange={(checked) =>
                  setZoneFormData({ ...zoneFormData, is_free: checked, charge: checked ? '0' : (zoneFormData.charge === '0' ? '100' : zoneFormData.charge) })
                }
              />
            </div>

            {!zoneFormData.is_free && (
              <div className="space-y-1.5">
                <Label htmlFor="zone_charge">ডেলিভারি চার্জ (৳ BDT) *</Label>
                <Input
                  id="zone_charge"
                  type="number"
                  min="0"
                  placeholder="100"
                  value={zoneFormData.charge}
                  onChange={(e) => setZoneFormData({ ...zoneFormData, charge: e.target.value })}
                  required
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="zone_time">সম্ভাব্য ডেলিভারি সময়</Label>
              <Input
                id="zone_time"
                placeholder="যেমন: ২৪ - ৪৮ ঘণ্টার মধ্যে"
                value={zoneFormData.estimated_time}
                onChange={(e) => setZoneFormData({ ...zoneFormData, estimated_time: e.target.value })}
              />
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <Switch
                id="zone_active"
                checked={zoneFormData.is_active}
                onCheckedChange={(checked) => setZoneFormData({ ...zoneFormData, is_active: checked })}
              />
              <Label htmlFor="zone_active" className="cursor-pointer text-xs">
                অর্ডার পেজে এই এরিয়াটি সক্রিয় রাখুন
              </Label>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsZoneModalOpen(false)}>
                বাতিল
              </Button>
              <Button type="submit" size="sm" disabled={isSubmittingZone}>
                {isSubmittingZone ? 'সংরক্ষণ হচ্ছে...' : editingZone ? 'আপডেট করুন' : 'তৈরি করুন'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
