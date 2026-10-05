'use client';

import { useEffect, useState, use } from 'react';
import {
  Truck,
  CheckCircle2,
  Clock,
  Package,
  MapPin,
  Phone,
  ShieldCheck,
  AlertCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

interface TrackingData {
  order: {
    id: string;
    invoice_no?: string;
    customer_name?: string;
    customer_phone: string;
    shipping_address?: string;
    total_amount: number;
    advance_paid?: number;
    status: string;
    courier_status?: string;
    courier_provider?: string;
    courier_tracking_code?: string;
    created_at: string;
  };
  store: {
    store_name: string;
    logo_url?: string;
    tagline?: string;
    support_phone?: string;
    currency_symbol?: string;
  };
}

const TIMELINE_STEPS = [
  { key: 'CONFIRMED', label: 'অর্ডার কনফার্ম', desc: 'অর্ডারটি গ্রহণ করা হয়েছে' },
  { key: 'PROCESSING', label: 'প্যাকেজিং সম্পন্ন', desc: 'পার্সেল প্রস্তুত করা হয়েছে' },
  { key: 'DISPATCHED', label: 'কুরিয়ারে হস্তান্তর', desc: 'পার্সেল কুরিয়ার হাব-এ রয়েছে' },
  { key: 'OUT_FOR_DELIVERY', label: 'ডেলিভারির পথে', desc: 'রাইডার ডেলিভারি করতে আসছেন' },
  { key: 'DELIVERED', label: 'ডেলিভারি সম্পন্ন', desc: 'গ্রাহক পার্সেল গ্রহণ করেছেন' },
];

export default function PublicParcelTrackPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TrackingData | null>(null);

  useEffect(() => {
    async function loadTracking() {
      try {
        const res = await fetch(`/api/public/track/${encodeURIComponent(code)}`);
        if (!res.ok) throw new Error('Not found');
        const json = await res.json();
        setData(json);
      } catch {
        toast.error('পার্সেল ট্র্যাকিং তথ্য পাওয়া যায়নি');
      } finally {
        setLoading(false);
      }
    }
    loadTracking();
  }, [code]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
        <div className="flex flex-col items-center gap-3 text-slate-300">
          <Loader2 className="size-8 animate-spin text-emerald-500" />
          <p className="text-sm font-medium">লাইভ পার্সেল ট্র্যাকিং লোড হচ্ছে...</p>
        </div>
      </div>
    );
  }

  if (!data?.order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
        <div className="max-w-md rounded-2xl border border-rose-900/50 bg-rose-950/20 p-6 text-center text-rose-300">
          <AlertCircle className="mx-auto size-12 text-rose-400 mb-3" />
          <h1 className="text-lg font-bold">পার্সেল তথ্য পাওয়া যায়নি</h1>
          <p className="text-sm text-slate-400 mt-1">
            সঠিক ট্র্যাকিং কোড বা ইনভয়েস নম্বর দিয়ে পুনরায় চেষ্টা করুন।
          </p>
        </div>
      </div>
    );
  }

  const { order, store } = data;
  const dueAmount = Math.max(0, Number(order.total_amount || 0) - Number(order.advance_paid || 0));

  // Determine current timeline progress index (0 to 4)
  const courierStatus = (order.courier_status || order.status || '').toUpperCase();
  let activeStep = 0;
  if (courierStatus.includes('DELIVERED')) {
    activeStep = 4;
  } else if (courierStatus.includes('OUT') || courierStatus.includes('RIDER')) {
    activeStep = 3;
  } else if (order.courier_tracking_code || courierStatus.includes('IN_TRANSIT') || courierStatus.includes('DISPATCHED')) {
    activeStep = 2;
  } else if (courierStatus.includes('PROCESSING') || courierStatus.includes('PACKED')) {
    activeStep = 1;
  } else {
    activeStep = 0;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 py-8">
      <div className="w-full max-w-lg">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-3">
            <ShieldCheck className="size-3.5" />
            লাইভ পার্সেল ট্র্যাকিং
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">{store.store_name}</h1>
          {store.tagline && <p className="text-xs text-slate-400 mt-0.5">{store.tagline}</p>}
        </div>

        {/* Tracking Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 backdrop-blur shadow-2xl overflow-hidden p-6 space-y-6">
          {/* Top Status & Consignment Banner */}
          <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 block">ইনভয়েস নম্বর:</span>
                <span className="text-sm font-mono font-bold text-white">
                  {order.invoice_no || order.id.slice(0, 8)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-400 block">কুরিয়ার পার্টনার:</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Truck className="size-3" />
                  {order.courier_provider?.toUpperCase() || 'STEADFAST'}
                </span>
              </div>
            </div>

            {order.courier_tracking_code && (
              <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-400">ট্র্যাকিং কোড (CID):</span>
                <span className="font-mono font-bold text-emerald-300">
                  {order.courier_tracking_code}
                </span>
              </div>
            )}
          </div>

          {/* Visual Progress Timeline */}
          <div className="space-y-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              ডেলিভারি অগ্রগতি (Delivery Timeline)
            </h2>
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
              {TIMELINE_STEPS.map((step, idx) => {
                const isPassed = idx <= activeStep;
                const isCurrent = idx === activeStep;
                return (
                  <div key={step.key} className="relative flex items-start gap-3">
                    <div
                      className={`absolute -left-6 mt-0.5 size-5 rounded-full border flex items-center justify-center text-[10px] font-bold transition-all ${
                        isCurrent
                          ? 'border-emerald-400 bg-emerald-500 text-slate-950 ring-4 ring-emerald-500/20'
                          : isPassed
                          ? 'border-emerald-600 bg-emerald-600/30 text-emerald-400'
                          : 'border-slate-800 bg-slate-900 text-slate-500'
                      }`}
                    >
                      {isPassed ? '✓' : idx + 1}
                    </div>
                    <div>
                      <p
                        className={`text-xs font-bold leading-tight ${
                          isCurrent
                            ? 'text-emerald-400'
                            : isPassed
                            ? 'text-white'
                            : 'text-slate-500'
                        }`}
                      >
                        {step.label}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{step.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Payment & Delivery Summary */}
          <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-4 space-y-2 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-slate-800">
              <span className="text-slate-400">ডেলিভারিতে প্রদেয় (Cash on Delivery):</span>
              <span className="text-sm font-bold text-emerald-400">
                {store.currency_symbol || '৳'} {dueAmount}
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-400">গ্রাহক নম্বর:</span>
              <span className="font-mono text-slate-200">{order.customer_phone}</span>
            </div>
          </div>

          {/* Support Helpline */}
          {store.support_phone && (
            <div className="pt-2 text-center">
              <a
                href={`tel:${store.support_phone}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-xs font-semibold text-slate-200 hover:border-slate-700 hover:text-white transition-colors"
              >
                <Phone className="size-3.5 text-emerald-400" />
                ডেলিভারি হেল্পলাইন: {store.support_phone}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
