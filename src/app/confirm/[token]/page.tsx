'use client';

import { useEffect, useState, use } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Package,
  MapPin,
  Phone,
  AlertCircle,
  Loader2,
  ThumbsUp,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface OrderConfirmationData {
  confirmation: {
    id: string;
    otp_code: string;
    status: string;
    customer_phone: string;
  };
  order: {
    id: string;
    invoice_no?: string;
    customer_name?: string;
    shipping_address?: string;
    total_amount: number;
    advance_paid?: number;
    status: string;
    order_items?: Array<{
      product_name: string;
      quantity: number;
      price: number;
    }>;
  };
  store: {
    store_name: string;
    logo_url?: string;
    tagline?: string;
    support_phone?: string;
    currency_symbol?: string;
  };
}

export default function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OrderConfirmationData | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  useEffect(() => {
    async function loadConfirmation() {
      try {
        const res = await fetch(`/api/orders/confirm/${token}`);
        if (!res.ok) throw new Error('Order not found');
        const json = await res.json();
        setData(json);
        if (json.confirmation?.status === 'confirmed' || json.order?.status === 'confirmed') {
          setIsConfirmed(true);
        }
      } catch {
        toast.error('অর্ডারের তথ্য পাওয়া যায়নি');
      } finally {
        setLoading(false);
      }
    }
    loadConfirmation();
  }, [token]);

  const handleConfirmOrder = async () => {
    setConfirming(true);
    try {
      const res = await fetch('/api/orders/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const resData = await res.json();
      if (resData.success) {
        setIsConfirmed(true);
        toast.success('অর্ডারটি নিশ্চিত করা হয়েছে!');
      } else {
        toast.error(resData.error || 'কনফার্মেশন সম্পন্ন হয়নি');
      }
    } catch {
      toast.error('সার্ভারে যোগাযোগ করা যায়নি');
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
        <div className="flex flex-col items-center gap-3 text-slate-300">
          <Loader2 className="size-8 animate-spin text-emerald-500" />
          <p className="text-sm font-medium">অর্ডারের বিবরণ লোড হচ্ছে...</p>
        </div>
      </div>
    );
  }

  if (!data?.order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
        <div className="max-w-md rounded-2xl border border-rose-900/50 bg-rose-950/20 p-6 text-center text-rose-300">
          <AlertCircle className="mx-auto size-12 text-rose-400 mb-3" />
          <h1 className="text-lg font-bold">অর্ডারটি পাওয়া যায়নি</h1>
          <p className="text-sm text-slate-400 mt-1">
            এই লিঙ্কটি মেয়াদোত্তীর্ণ অথবা বাতিল করা হয়েছে।
          </p>
        </div>
      </div>
    );
  }

  const { order, store, confirmation } = data;
  const dueAmount = Math.max(0, Number(order.total_amount || 0) - Number(order.advance_paid || 0));

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 py-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-3">
            <ShieldCheck className="size-3.5" />
            অর্ডার ভেরিফিকেশন ও নিশ্চয়তা
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">{store.store_name}</h1>
          {store.tagline && <p className="text-xs text-slate-400 mt-0.5">{store.tagline}</p>}
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 backdrop-blur shadow-2xl overflow-hidden">
          {isConfirmed ? (
            <div className="p-6 text-center space-y-4">
              <div className="mx-auto size-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 animate-in zoom-in duration-300">
                <CheckCircle2 className="size-8" />
              </div>
              <h2 className="text-xl font-bold text-white">অর্ডারটি নিশ্চিত হয়েছে!</h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                সম্মানিত গ্রাহক, আপনার অর্ডারটি সফলভাবে গ্রহণ ও নিশ্চিত করা হয়েছে। দ্রুত পার্সেল প্যাকেজিং সম্পন্ন করে কুরিয়ারে বুকিং দেওয়া হবে।
              </p>

              <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-4 text-left space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">ইনভয়েস নং:</span>
                  <span className="font-mono font-medium text-emerald-300">
                    {order.invoice_no || order.id.slice(0, 8)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">ডেলিভারিতে প্রদেয় (COD):</span>
                  <span className="font-bold text-white">
                    {store.currency_symbol || '৳'} {dueAmount}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">ডেলিভারি ঠিকানা:</span>
                  <span className="text-slate-200 text-right max-w-[200px] truncate">
                    {order.shipping_address || 'N/A'}
                  </span>
                </div>
              </div>

              {store.support_phone && (
                <p className="text-xs text-slate-400 pt-2">
                  যেকোনো প্রয়োজনে যোগাযোগ: <span className="text-emerald-400 font-mono">{store.support_phone}</span>
                </p>
              )}
            </div>
          ) : (
            <div className="p-6 space-y-5">
              <div className="text-center">
                <span className="text-xs font-medium text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20">
                  অপেক্ষারত অর্ডার
                </span>
                <h2 className="text-lg font-bold text-white mt-2.5">
                  আপনি কি অর্ডারটি কনফার্ম করতে চান?
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  ক্যাশ অন ডেলিভারিতে পার্সেলটি রিসিভ করতে নিচের বাটনে চাপ দিন।
                </p>
              </div>

              {/* Order summary box */}
              <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-4 text-xs space-y-2.5">
                <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                  <span className="text-slate-400">অর্ডার ইনভয়েস:</span>
                  <span className="font-mono text-slate-200">{order.invoice_no || 'Pending'}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                  <span className="text-slate-400">ক্যাশ অন ডেলিভারি (COD):</span>
                  <span className="text-base font-extrabold text-emerald-400">
                    {store.currency_symbol || '৳'} {dueAmount}
                  </span>
                </div>
                <div className="text-slate-300 space-y-1">
                  <span className="text-slate-400 block text-[11px]">ডেলিভারি ঠিকানা:</span>
                  <p className="leading-relaxed bg-slate-900/90 p-2 rounded border border-slate-800">
                    {order.shipping_address || 'ঠিকানা দেওয়া হয়নি'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={handleConfirmOrder}
                  disabled={confirming}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-70 cursor-pointer"
                >
                  {confirming ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      কনফার্ম করা হচ্ছে...
                    </>
                  ) : (
                    <>
                      <ThumbsUp className="size-4" />
                      হ্যাঁ, আমি অর্ডারটি কনফার্ম করছি
                    </>
                  )}
                </button>
              </div>

              <p className="text-[11px] text-center text-slate-400">
                পার্সেল হাতে পেয়ে মূল্য পরিশোধ করার পূর্ণ নিশ্চয়তা রয়েছে।
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
