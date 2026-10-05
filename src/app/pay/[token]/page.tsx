'use client';

import { useEffect, useState, use } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ShieldCheck,
  CheckCircle2,
  Copy,
  ExternalLink,
  Smartphone,
  CreditCard,
  AlertCircle,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';

interface PaymentDetailsResponse {
  link: {
    id: string;
    payment_token: string;
    amount: number;
    currency: string;
    purpose: string;
    customer_name?: string;
    customer_phone: string;
    status: string;
    trx_id?: string;
    order?: {
      id: string;
      invoice_no?: string;
      total_amount?: number;
      shipping_address?: string;
    };
  };
  store: {
    store_name: string;
    logo_url?: string;
    tagline?: string;
    support_phone?: string;
    currency_symbol?: string;
  };
  gateways: Array<{
    gateway: string;
    display_name?: string;
    instructions?: string;
    is_sandbox?: boolean;
    has_pgw?: boolean;
    personal_number?: string;
    merchant_number?: string;
    account_type?: string;
  }>;
  loyalty?: {
    tier: string;
    points_balance: number;
    cashback_balance: number;
  } | null;
}

export default function PaymentCheckoutPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const searchParams = useSearchParams();
  const queryStatus = searchParams.get('status');
  const queryTrxId = searchParams.get('trxId');

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PaymentDetailsResponse | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<'bkash_pgw' | 'bkash_manual' | 'nagad_manual'>('bkash_pgw');
  const [trxIdInput, setTrxIdInput] = useState('');
  const [senderPhoneInput, setSenderPhoneInput] = useState('');
  const [submittingTrx, setSubmittingTrx] = useState(false);
  const [redirectingPg, setRedirectingPg] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [finalTrxId, setFinalTrxId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch(`/api/payment/details/${token}`);
        if (!res.ok) {
          throw new Error('Payment link not found');
        }
        const json = await res.json();
        setData(json);

        if (json.link?.status === 'completed' || queryStatus === 'success') {
          setIsCompleted(true);
          setFinalTrxId(json.link?.trx_id || queryTrxId || 'Confirmed');
        } else {
          // Check available gateways
          const bkashGw = json.gateways?.find((g: { gateway: string }) => g.gateway === 'bkash');
          if (bkashGw?.has_pgw) {
            setSelectedMethod('bkash_pgw');
          } else {
            setSelectedMethod('bkash_manual');
          }
        }
      } catch (err) {
        toast.error('Payment details could not be loaded');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [token, queryStatus, queryTrxId]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('নম্বর কপি করা হয়েছে!');
  };

  const handleBkashPgwCheckout = async () => {
    setRedirectingPg(true);
    try {
      const res = await fetch('/api/payment/bkash/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentToken: token }),
      });
      const resData = await res.json();
      if (resData.bkashURL) {
        window.location.href = resData.bkashURL;
      } else {
        toast.error(resData.error || 'bKash PGW চালু করা সম্ভব হয়নি');
        setRedirectingPg(false);
      }
    } catch {
      toast.error('bKash gateway connection failed');
      setRedirectingPg(false);
    }
  };

  const handleManualTrxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trxIdInput.trim() || trxIdInput.trim().length < 4) {
      toast.error('সঠিক Transaction ID (TrxID) লিখুন');
      return;
    }

    setSubmittingTrx(true);
    try {
      const res = await fetch('/api/payment/verify-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentToken: token,
          trxId: trxIdInput.trim(),
          paymentMethod: selectedMethod.replace('_manual', ''),
          senderNumber: senderPhoneInput.trim(),
        }),
      });

      const resData = await res.json();
      if (resData.success) {
        setIsCompleted(true);
        setFinalTrxId(trxIdInput.trim().toUpperCase());
        toast.success('পেমেন্ট সফলভাবে নিশ্চিত করা হয়েছে!');
      } else {
        toast.error(resData.error || 'ভেরিফিকেশন সম্পন্ন হয়নি');
      }
    } catch {
      toast.error('সার্ভারে যোগাযোগ করা যায়নি');
    } finally {
      setSubmittingTrx(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
        <div className="flex flex-col items-center gap-3 text-slate-300">
          <Loader2 className="size-8 animate-spin text-emerald-500" />
          <p className="text-sm font-medium">পেমেন্ট গেটওয়ে লোড হচ্ছে...</p>
        </div>
      </div>
    );
  }

  if (!data?.link) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
        <div className="max-w-md rounded-2xl border border-rose-900/50 bg-rose-950/20 p-6 text-center text-rose-300">
          <AlertCircle className="mx-auto size-12 text-rose-400 mb-3" />
          <h1 className="text-lg font-bold">পেমেন্ট লিঙ্কটি পাওয়া যায়নি</h1>
          <p className="text-sm text-slate-400 mt-1">
            এই লিঙ্কটি মেয়াদোত্তীর্ণ অথবা ভুল হতে পারে। অনুগ্রহ করে বিক্রেতার সাথে যোগাযোগ করুন।
          </p>
        </div>
      </div>
    );
  }

  const { link, store, gateways } = data;
  const bkashGateway = gateways.find((g) => g.gateway === 'bkash');
  const nagadGateway = gateways.find((g) => g.gateway === 'nagad');

  const manualBkashNumber = bkashGateway?.personal_number || bkashGateway?.merchant_number || store.support_phone || '01XXXXXXXXX';
  const manualNagadNumber = nagadGateway?.personal_number || nagadGateway?.merchant_number || store.support_phone || '01XXXXXXXXX';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 py-8">
      <div className="w-full max-w-md">
        {/* Store Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-3">
            <ShieldCheck className="size-3.5" />
            100% নিরাপদ ও অনুমোদিত পেমেন্ট
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">{store.store_name}</h1>
          {store.tagline && <p className="text-xs text-slate-400 mt-0.5">{store.tagline}</p>}
        </div>

        {/* Success Card */}
        {isCompleted ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 backdrop-blur p-6 text-center shadow-xl">
            <div className="mx-auto size-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-4 animate-in zoom-in duration-300">
              <CheckCircle2 className="size-8" />
            </div>
            <h2 className="text-xl font-bold text-white mb-1">পেমেন্ট সফল হয়েছে!</h2>
            <p className="text-sm text-slate-300 mb-4">
              আপনার <span className="font-semibold text-emerald-400">{link.currency} {link.amount}</span> টাকা পেমেন্ট নিশ্চিত হয়েছে।
            </p>

            <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 text-left space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Transaction ID:</span>
                <span className="font-mono font-medium text-emerald-300">{finalTrxId}</span>
              </div>
              {link.order?.invoice_no && (
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">অর্ডার ইনভয়েস:</span>
                  <span className="font-mono text-slate-200">{link.order.invoice_no}</span>
                </div>
              )}
              <div className="flex justify-between py-1">
                <span className="text-slate-400">গ্রাহক নম্বর:</span>
                <span className="text-slate-200">{link.customer_phone}</span>
              </div>
            </div>

            <p className="text-xs text-slate-400 mt-5">
              অর্ডার প্রসেসিং শুরু হয়েছে। আপনার মেসেজ বা ইনবক্সে কনফার্মেশন পাঠানো হয়েছে।
            </p>
          </div>
        ) : (
          /* Payment Processing Card */
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 backdrop-blur shadow-2xl overflow-hidden">
            {/* Amount Banner */}
            <div className="bg-gradient-to-r from-emerald-600/30 via-slate-800 to-indigo-600/30 p-5 border-b border-slate-800 text-center">
              <span className="text-xs text-slate-400 font-medium">পরিশোধের পরিমাণ</span>
              <div className="text-3xl font-extrabold text-white mt-1">
                {store.currency_symbol || '৳'} {link.amount}
              </div>
              <div className="text-xs text-emerald-400 font-medium mt-1">
                {link.purpose === 'advance_payment' ? 'অগ্রিম ডেলিভারি চার্জ' : 'অর্ডার পেমেন্ট'}
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Customer Loyalty Tier & Rewards Badge */}
              {data.loyalty && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 rounded-lg bg-amber-500/20 text-amber-300 text-sm">
                      👑
                    </span>
                    <div>
                      <span className="font-bold text-amber-300">
                        {data.loyalty.tier} VIP সদস্য
                      </span>
                      <p className="text-[11px] text-slate-400">
                        আপনার ওয়ালেটে {data.loyalty.points_balance} লয়্যালটি পয়েন্ট রয়েছে
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-emerald-400 font-bold block">
                      ৳{data.loyalty.cashback_balance}
                    </span>
                    <span className="text-[10px] text-slate-400">ক্যাশব্যাক ভ্যালু</span>
                  </div>
                </div>
              )}

              {/* Payment Methods Tabs */}
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2.5">
                  পেমেন্ট মাধ্যম বেছে নিন
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {bkashGateway?.has_pgw && (
                    <button
                      type="button"
                      onClick={() => setSelectedMethod('bkash_pgw')}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all ${
                        selectedMethod === 'bkash_pgw'
                          ? 'border-[#E2136E] bg-[#E2136E]/10 text-white shadow-md'
                          : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span className="text-sm font-bold text-[#E2136E]">bKash PGW</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">অটোমেটিক ইনস্ট্যান্ট</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('bkash_manual')}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all ${
                      selectedMethod === 'bkash_manual'
                        ? 'border-[#E2136E] bg-[#E2136E]/10 text-white shadow-md'
                        : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-sm font-bold text-[#E2136E]">bKash Send Money</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">অ্যাপ / ডায়াল TrxID</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('nagad_manual')}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all ${
                      selectedMethod === 'nagad_manual'
                        ? 'border-[#F7941D] bg-[#F7941D]/10 text-white shadow-md'
                        : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-sm font-bold text-[#F7941D]">Nagad নগদ</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">Send Money / TrxID</span>
                  </button>
                </div>
              </div>

              {/* Method 1: Instant bKash Checkout */}
              {selectedMethod === 'bkash_pgw' && (
                <div className="space-y-4 pt-1">
                  <div className="rounded-xl border border-[#E2136E]/30 bg-[#E2136E]/5 p-3.5 text-xs text-slate-300 space-y-1.5">
                    <p className="font-semibold text-white">bKash অফিসিয়াল গেটওয়ে:</p>
                    <p className="text-slate-400 leading-relaxed">
                      নিচের বাটনে ক্লিক করলে bKash পেমেন্ট পেজ ওপেন হবে। পিন দিয়ে পেমেন্ট নিশ্চিত করলেই স্বয়ংক্রিয়ভাবে অর্ডার কনফার্ম হবে।
                    </p>
                  </div>

                  <button
                    onClick={handleBkashPgwCheckout}
                    disabled={redirectingPg}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#E2136E] hover:bg-[#c90f61] text-white font-bold text-sm shadow-lg shadow-[#E2136E]/20 transition-all disabled:opacity-70"
                  >
                    {redirectingPg ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        bKash গেটওয়েতে নেওয়া হচ্ছে...
                      </>
                    ) : (
                      <>
                        bKash এ পেমেন্ট করুন {store.currency_symbol || '৳'}{link.amount}
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Method 2 & 3: Manual Send Money with TrxID Input */}
              {(selectedMethod === 'bkash_manual' || selectedMethod === 'nagad_manual') && (
                <form onSubmit={handleManualTrxSubmit} className="space-y-4 pt-1">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 text-xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-medium">
                        {selectedMethod === 'bkash_manual' ? 'bKash Personal নম্বর:' : 'নগদ Personal নম্বর:'}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(
                            selectedMethod === 'bkash_manual' ? manualBkashNumber : manualNagadNumber
                          )
                        }
                        className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-mono text-xs bg-emerald-500/10 px-2 py-0.5 rounded"
                      >
                        <Copy className="size-3" />
                        {selectedMethod === 'bkash_manual' ? manualBkashNumber : manualNagadNumber}
                      </button>
                    </div>

                    <div className="text-[11px] text-slate-400 space-y-1">
                      <p>১. আপনার অ্যাপ অথবা ডায়াল করে <strong>Send Money</strong> করুন।</p>
                      <p>২. টাকার পরিমাণ দিন: <strong>{store.currency_symbol || '৳'}{link.amount}</strong></p>
                      <p>৩. সেন্ড করার পর প্রাপ্ত <strong>Transaction ID (TrxID)</strong> টি নিচে লিখুন।</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-slate-300 block mb-1">
                        Transaction ID (TrxID) *
                      </label>
                      <input
                        type="text"
                        placeholder="যেমন: BL92K8XZ"
                        value={trxIdInput}
                        onChange={(e) => setTrxIdInput(e.target.value)}
                        className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 uppercase"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-300 block mb-1">
                        যে নম্বর থেকে পাঠিয়েছেন (ঐচ্ছিক)
                      </label>
                      <input
                        type="tel"
                        placeholder="01XXXXXXXXX"
                        value={senderPhoneInput}
                        onChange={(e) => setSenderPhoneInput(e.target.value)}
                        className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingTrx}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-70"
                  >
                    {submittingTrx ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        যাচাই করা হচ্ছে...
                      </>
                    ) : (
                      <>
                        পেমেন্ট কনফার্ম করুন
                        <CheckCircle2 className="size-4" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
