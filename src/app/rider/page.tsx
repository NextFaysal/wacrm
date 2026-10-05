'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Truck,
  Phone,
  MessageSquare,
  MapPin,
  CheckCircle2,
  XCircle,
  Clock,
  Coins,
  RefreshCw,
  Search,
  ExternalLink,
  Navigation,
  User,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface RiderOrder {
  id: string;
  invoice_no?: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  total_amount: number;
  advance_paid?: number;
  status: string;
  delivery_notes?: string;
  rider_name?: string;
  rider_collected_amount?: number;
  created_at: string;
}

interface RiderStats {
  totalOrders: number;
  completedCount: number;
  pendingCount: number;
  codToCollect: number;
}

export default function DeliveryRiderAppPage() {
  const [orders, setOrders] = useState<RiderOrder[]>([]);
  const [stats, setStats] = useState<RiderStats>({
    totalOrders: 0,
    completedCount: 0,
    pendingCount: 0,
    codToCollect: 0,
  });
  const [riderInfo, setRiderInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'delivered'>('pending');

  // Complete Dialog
  const [selectedOrder, setSelectedOrder] = useState<RiderOrder | null>(null);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [collectedAmount, setCollectedAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Failed Dialog
  const [failModalOpen, setFailModalOpen] = useState(false);
  const [failReason, setFailReason] = useState('কাস্টমার ফোন ধরেননি');

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/rider/orders');
      if (!res.ok) throw new Error('Failed to load orders');
      const data = await res.json();
      setOrders(data.orders || []);
      setStats(data.stats || { totalOrders: 0, completedCount: 0, pendingCount: 0, codToCollect: 0 });
      setRiderInfo(data.rider);
    } catch {
      toast.error('অর্ডার তালিকা লোড করা যায়নি');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleOpenComplete = (ord: RiderOrder) => {
    setSelectedOrder(ord);
    const total = Number(ord.total_amount) || 0;
    const adv = Number(ord.advance_paid) || 0;
    const due = Math.max(0, total - adv);
    setCollectedAmount(due.toString());
    setCompleteModalOpen(true);
  };

  const handleOpenFail = (ord: RiderOrder) => {
    setSelectedOrder(ord);
    setFailModalOpen(true);
  };

  const submitDeliveryComplete = async () => {
    if (!selectedOrder) return;
    try {
      setSubmitting(true);
      const res = await fetch('/api/rider/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          action: 'delivered',
          collectedAmount: Number(collectedAmount),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('ডেলিভারি সফলভাবে সম্পন্ন হয়েছে!');
        setCompleteModalOpen(false);
        fetchOrders();
      } else {
        toast.error(data.error || 'আপডেট করা যায়নি');
      }
    } catch {
      toast.error('সার্ভারে যোগাযোগ করা যায়নি');
    } finally {
      setSubmitting(false);
    }
  };

  const submitDeliveryFailed = async () => {
    if (!selectedOrder) return;
    try {
      setSubmitting(true);
      const res = await fetch('/api/rider/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          action: 'failed',
          notes: failReason,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.warning('ডেলিভারি ব্যর্থ হিসেবে চিহ্নিত করা হয়েছে');
        setFailModalOpen(false);
        fetchOrders();
      } else {
        toast.error(data.error || 'আপডেট করা যায়নি');
      }
    } catch {
      toast.error('সার্ভারে সমস্যা হয়েছে');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      const q = search.toLowerCase();
      const matchSearch =
        (ord.customer_name || '').toLowerCase().includes(q) ||
        (ord.customer_phone || '').includes(q) ||
        (ord.invoice_no || '').toLowerCase().includes(q) ||
        (ord.customer_address || '').toLowerCase().includes(q);

      if (!matchSearch) return false;

      if (statusFilter === 'pending') {
        return ord.status !== 'DELIVERED';
      }
      if (statusFilter === 'delivered') {
        return ord.status === 'DELIVERED';
      }
      return true;
    });
  }, [orders, search, statusFilter]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16 font-sans">
      {/* Top Mobile App Header */}
      <header className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">
                {riderInfo?.name || 'এক্সপ্রেস রাইডার হাব'}
              </h1>
              <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                অনলাইন ডিসপ্যাচ
              </span>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={fetchOrders}
            disabled={loading}
            className="h-8 w-8 p-0 text-slate-300 hover:text-white hover:bg-slate-800"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Quick KPI Stat Strip */}
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-800/80">
          <div className="bg-slate-800/60 rounded-xl p-2 text-center border border-slate-700/40">
            <span className="text-[10px] text-slate-400 block">বাকি পার্সেল</span>
            <span className="text-base font-extrabold text-amber-400 font-mono">
              {stats.pendingCount}
            </span>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-2 text-center border border-slate-700/40">
            <span className="text-[10px] text-slate-400 block">সম্পন্ন</span>
            <span className="text-base font-extrabold text-emerald-400 font-mono">
              {stats.completedCount}
            </span>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-2 text-center border border-slate-700/40">
            <span className="text-[10px] text-slate-400 block">ক্যাশ আদায়</span>
            <span className="text-base font-extrabold text-white font-mono">
              ৳{stats.codToCollect.toLocaleString('en-BD')}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-md mx-auto p-4 space-y-4">
        {/* Search & Filter Bar */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="নাম, ফোন বা ইনভয়েস দিয়ে খুঁজুন..."
              className="pl-9 bg-slate-900 border-slate-800 text-xs text-white placeholder:text-slate-500 rounded-xl"
            />
          </div>

          {/* Filter Tabs */}
          <div className="grid grid-cols-3 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={`py-1.5 rounded-lg font-semibold transition-all ${
                statusFilter === 'pending'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              বাকি আছে ({stats.pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('delivered')}
              className={`py-1.5 rounded-lg font-semibold transition-all ${
                statusFilter === 'delivered'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              সম্পন্ন ({stats.completedCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`py-1.5 rounded-lg font-semibold transition-all ${
                statusFilter === 'all'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              সকল ({stats.totalOrders})
            </button>
          </div>
        </div>

        {/* Parcel Cards List */}
        {loading ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <Loader2 className="w-7 h-7 animate-spin mx-auto text-emerald-500" />
            <p className="text-xs">পার্সেল লোড হচ্ছে...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-16 text-center text-slate-500 space-y-2 bg-slate-900/50 rounded-2xl border border-slate-800/80 p-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-500/60 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-300">কোনো পার্সেল বাকি নেই!</h3>
            <p className="text-xs text-slate-500">আপনার আজকের সব ডেলিভারি সম্পন্ন হয়েছে অথবা নতুন অ্যাসাইনমেন্ট নেই।</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((ord) => {
              const invoiceNo = ord.invoice_no || `INV-${ord.id.slice(0, 8).toUpperCase()}`;
              const total = Number(ord.total_amount) || 0;
              const adv = Number(ord.advance_paid) || 0;
              const due = Math.max(0, total - adv);
              const isDelivered = ord.status === 'DELIVERED';
              const isFailed = ord.status === 'FAILED_DELIVERY';

              const cleanPhone = ord.customer_phone.replace(/\D/g, '');
              const waPhone = cleanPhone.startsWith('880') ? cleanPhone : `880${cleanPhone.replace(/^0/, '')}`;
              const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ord.customer_address)}`;

              return (
                <div
                  key={ord.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isDelivered
                      ? 'bg-emerald-950/20 border-emerald-900/50'
                      : isFailed
                      ? 'bg-rose-950/20 border-rose-900/50'
                      : 'bg-slate-900/90 border-slate-800 shadow-md'
                  }`}
                >
                  {/* Top Bar: Invoice & Status */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-md">
                      {invoiceNo}
                    </span>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] uppercase font-semibold ${
                        isDelivered
                          ? 'bg-emerald-600 text-white'
                          : isFailed
                          ? 'bg-rose-600 text-white'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {ord.status}
                    </Badge>
                  </div>

                  {/* Customer Info */}
                  <div className="space-y-1 mb-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" /> {ord.customer_name}
                      </h3>
                      <span className="text-xs font-mono text-slate-300 font-semibold">
                        {ord.customer_phone}
                      </span>
                    </div>

                    <div className="flex items-start gap-1.5 text-xs text-slate-300">
                      <MapPin className="w-3.5 h-3.5 shrink-0 text-rose-400 mt-0.5" />
                      <span className="line-clamp-2 leading-relaxed">{ord.customer_address}</span>
                    </div>
                  </div>

                  {/* COD Cash Amount Box */}
                  <div className="bg-slate-950/80 rounded-xl p-2.5 flex items-center justify-between border border-slate-800/80 mb-3">
                    <span className="text-xs text-slate-400 font-medium">ক্যাশ প্রদেয় (COD Due):</span>
                    <span className="text-lg font-black text-amber-400 font-mono">
                      ৳{due.toLocaleString('en-BD')}
                    </span>
                  </div>

                  {/* Quick Action Navigation Buttons */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <a
                      href={`tel:${ord.customer_phone}`}
                      className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-emerald-400 border border-slate-700/60 transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5" /> কল দিন
                    </a>

                    <a
                      href={`https://wa.me/${waPhone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-emerald-400 border border-slate-700/60 transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                    </a>

                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-sky-400 border border-slate-700/60 transition-colors"
                    >
                      <Navigation className="w-3.5 h-3.5" /> ম্যাপ
                    </a>
                  </div>

                  {/* Delivery Status Triggers */}
                  {!isDelivered ? (
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                      <Button
                        size="sm"
                        onClick={() => handleOpenFail(ord)}
                        variant="outline"
                        className="h-9 text-xs border-rose-900/60 text-rose-400 hover:bg-rose-950/50 hover:text-rose-300 font-semibold rounded-xl"
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1" /> ব্যর্থ / রিশিডিউল
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => handleOpenComplete(ord)}
                        className="h-9 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-md"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> ডেলিভারি সম্পন্ন
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-1 text-xs text-emerald-400 font-medium flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> ডেলিভারি ও ক্যাশ সংগ্রহ সম্পন্ন
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Complete Order Dialog */}
      <Dialog open={completeModalOpen} onOpenChange={setCompleteModalOpen}>
        <DialogContent className="max-w-xs bg-slate-900 text-white border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-base text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" /> ডেলিভারি নিশ্চিতকরণ
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              কাস্টমারের কাছ থেকে গৃহীত ক্যাশ টাকার পরিমাণ নিশ্চিত করুন
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                গৃহীত ক্যাশ টাকা (টাকা):
              </label>
              <Input
                type="number"
                value={collectedAmount}
                onChange={(e) => setCollectedAmount(e.target.value)}
                className="bg-slate-950 border-slate-800 text-lg font-mono font-bold text-emerald-400"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              * ডেলিভারি নিশ্চিত করার সাথে সাথে গ্রাহককে ধন্যবাদ মেসেজ ও ৳১০০ ডিসকাউন্ট কুপন পাঠানো হবে।
            </p>
          </div>

          <DialogFooter className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCompleteModalOpen(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              বাতিল
            </Button>
            <Button
              size="sm"
              onClick={submitDeliveryComplete}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'নিশ্চিত করুন'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Failed Order Dialog */}
      <Dialog open={failModalOpen} onOpenChange={setFailModalOpen}>
        <DialogContent className="max-w-xs bg-slate-900 text-white border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-base text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> ডেলিভারি ব্যর্থতার কারণ
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              কেন পার্সেলটি হস্তান্তর করা সম্ভব হয়নি নির্বাচন করুন
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            {[
              'কাস্টমার ফোন ধরেননি',
              'কাস্টমার ঠিকানায় উপস্থিত ছিলেন না',
              'কাস্টমারের কাছে টাকা প্রস্তুত ছিলো না',
              'কাস্টমার আগামীকাল ডেলিভারি চেয়েছেন',
              'কাস্টমার পণ্যটি নিতে অস্বীকৃতি জানিয়েছেন',
            ].map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => setFailReason(reason)}
                className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all ${
                  failReason === reason
                    ? 'border-rose-500 bg-rose-500/10 text-white font-semibold'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                }`}
              >
                {reason}
              </button>
            ))}
          </div>

          <DialogFooter className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFailModalOpen(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              বাতিল
            </Button>
            <Button
              size="sm"
              onClick={submitDeliveryFailed}
              disabled={submitting}
              className="bg-rose-600 hover:bg-rose-500 text-white font-bold"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'সাবমিট করুন'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
