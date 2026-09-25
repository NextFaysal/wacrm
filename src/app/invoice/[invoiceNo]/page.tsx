'use client';

import { useState, useEffect, use } from 'react';
import {
  Printer,
  CheckCircle2,
  Truck,
  ShieldCheck,
  Watch,
  Phone,
  MapPin,
  Calendar,
  ExternalLink,
  Package,
  Receipt,
  FileCheck2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface InvoiceData {
  id: string;
  invoiceNo: string;
  createdAt: string;
  status: string;
  customer: {
    name: string;
    phone: string;
    address: string;
    thana?: string | null;
    district?: string | null;
  };
  item: {
    productName: string;
    variant: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  };
  pricing: {
    subtotal: number;
    deliveryCharge: number;
    totalAmount: number;
    advancePaid: number;
    codDue: number;
  };
  courier: {
    provider?: string | null;
    trackingCode?: string | null;
    status?: string | null;
    trackingUrl?: string | null;
  };
  store: {
    name: string;
    phone: string;
    warranty: string;
    supportEmail: string;
  };
}

// Deterministic Barcode SVG generator
function SvgBarcode({ text, width = 220, height = 45 }: { text: string; width?: number; height?: number }) {
  const bars: { x: number; w: number }[] = [];
  let curX = 10;
  const clean = (text || '000000').toUpperCase().replace(/[^A-Z0-9]/g, '');

  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    const pattern = [(code % 3) + 1, ((code >> 2) % 2) + 1, ((code >> 4) % 3) + 1, 1];
    pattern.forEach((w, idx) => {
      if (idx % 2 === 0) {
        bars.push({ x: curX, w: w * 1.5 });
      }
      curX += w * 1.5 + 1;
    });
    curX += 2;
  }

  const totalWidth = curX + 10;

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox={`0 0 ${totalWidth} ${height}`}
        style={{ width: `${width}px`, height: `${height}px` }}
        className="overflow-visible"
      >
        {bars.map((bar, i) => (
          <rect key={i} x={bar.x} y={2} width={bar.w} height={height - 6} fill="#111827" />
        ))}
      </svg>
      <span className="text-[10px] font-mono tracking-widest text-gray-600 mt-0.5">{text}</span>
    </div>
  );
}

const STATUS_TEXT_BN: Record<string, { label: string; color: string }> = {
  NEW: { label: 'অর্ডার প্রস্তুত হচ্ছে', color: 'bg-blue-100 text-blue-800' },
  CONFIRMED: { label: 'অর্ডার কনফার্মড', color: 'bg-emerald-100 text-emerald-800' },
  PROCESSING: { label: 'প্রসেসিং ও প্যাকেজিং', color: 'bg-purple-100 text-purple-800' },
  COURIER_BOOKED: { label: 'কুরিয়ারে হস্তান্তর', color: 'bg-amber-100 text-amber-800' },
  SHIPPED: { label: 'শহরের উদ্দেশ্যে রওনা', color: 'bg-indigo-100 text-indigo-800' },
  OUT_FOR_DELIVERY: { label: 'আজ ডেলিভারির জন্য বের হয়েছে', color: 'bg-cyan-100 text-cyan-800 font-semibold' },
  DELIVERED: { label: 'সফল ডেলিভারি', color: 'bg-green-100 text-green-800 font-bold' },
  CANCELLED: { label: 'অর্ডার বাতিল', color: 'bg-rose-100 text-rose-800' },
  RETURNED: { label: 'রিটার্ন', color: 'bg-red-100 text-red-800' },
};

export default function PublicInvoicePage({
  params,
}: {
  params: Promise<{ invoiceNo: string }>;
}) {
  const { invoiceNo } = use(params);
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInvoice() {
      try {
        setLoading(true);
        const res = await fetch(`/api/invoices/${encodeURIComponent(invoiceNo)}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'ইনভয়েস পাওয়া যায়নি।');
        } else {
          setInvoice(data);
        }
      } catch {
        setError('ডাটা লোড করতে সমস্যা হয়েছে। দয়া করে পুনরায় চেষ্টা করুন।');
      } finally {
        setLoading(false);
      }
    }
    fetchInvoice();
  }, [invoiceNo]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-600 font-medium">ক্যাশ মেমো লোড হচ্ছে...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-6 rounded-xl border border-slate-200 text-center shadow-sm">
          <Receipt className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-800">ইনভয়েস খুঁজে পাওয়া যায়নি</h2>
          <p className="text-sm text-slate-600 mt-1 mb-4">{error || 'অনুগ্রহ করে সঠিক লিঙ্কটি চেক করুন।'}</p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            পুনরায় চেষ্টা করুন
          </Button>
        </div>
      </div>
    );
  }

  const statusBadge = STATUS_TEXT_BN[invoice.status] || {
    label: invoice.status,
    color: 'bg-slate-100 text-slate-800',
  };

  const formattedDate = new Date(invoice.createdAt).toLocaleDateString('bn-BD', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-3 sm:px-6 flex flex-col items-center">
      {/* Action Bar (hidden on print) */}
      <div className="w-full max-w-2xl mb-4 flex items-center justify-between no-print">
        <div className="flex items-center gap-2">
          <Watch className="w-5 h-5 text-emerald-600" />
          <span className="font-bold text-slate-800 text-sm sm:text-base">Watch Gallery BD</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => window.print()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm"
          >
            <Printer className="w-4 h-4" />
            প্রিন্ট / PDF সেভ
          </Button>
        </div>
      </div>

      {/* Main Invoice Card */}
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-md overflow-hidden print:shadow-none print:border-none print:m-0 print:p-0">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl sm:text-2xl font-black tracking-tight text-emerald-400">
                  WATCH GALLERY BD
                </span>
                <Badge variant="outline" className="text-xs bg-emerald-950/60 border-emerald-500 text-emerald-300">
                  অফিসিয়াল ক্যাশ মেমো
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-1">প্রিমিয়াম ঘড়ির নির্ভরযোগ্য বিশ্বস্ত শপ</p>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-xs text-slate-400 block">ইনভয়েস নম্বর</span>
              <span className="font-mono text-sm sm:text-base font-bold text-white tracking-wider">
                {invoice.invoiceNo}
              </span>
              <div className="text-xs text-slate-300 mt-0.5 flex items-center sm:justify-end gap-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                <span>{formattedDate}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Delivery Status Ribbon */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-xs text-slate-600 font-medium">অর্ডার স্ট্যাটাস:</span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusBadge.color}`}>
              {statusBadge.label}
            </span>
          </div>

          {invoice.courier.trackingCode && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-mono">
                {invoice.courier.provider?.toUpperCase()}: {invoice.courier.trackingCode}
              </span>
              {invoice.courier.trackingUrl && (
                <a
                  href={invoice.courier.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1 hover:underline"
                >
                  ট্র্যাক করুন <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}
        </div>

        {/* Customer Information */}
        <div className="p-5 sm:p-6 border-b border-slate-200 bg-white">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            গ্রাহকের ডেলিভারি বিবরণ
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-bold text-slate-800 text-base">{invoice.customer.name}</p>
              <p className="text-slate-600 flex items-center gap-1.5 mt-1 font-mono">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                {invoice.customer.phone}
              </p>
            </div>
            <div>
              <p className="text-slate-700 flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span>
                  {invoice.customer.address}
                  {invoice.customer.thana ? `, ${invoice.customer.thana}` : ''}
                  {invoice.customer.district ? `, ${invoice.customer.district}` : ''}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Order Items Table */}
        <div className="p-5 sm:p-6 border-b border-slate-200">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            পণ্য বিবরণ
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase">
                  <th className="pb-2 font-semibold">বিবরণ</th>
                  <th className="pb-2 text-center font-semibold">পরিমাণ</th>
                  <th className="pb-2 text-right font-semibold">মূল্য</th>
                  <th className="pb-2 text-right font-semibold">মোট</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-3">
                    <p className="font-semibold text-slate-800">{invoice.item.productName}</p>
                    <p className="text-xs text-slate-500 mt-0.5">কালার/ভ্যারিয়েন্ট: {invoice.item.variant}</p>
                  </td>
                  <td className="py-3 text-center text-slate-700 font-medium">
                    {invoice.item.quantity}টি
                  </td>
                  <td className="py-3 text-right text-slate-700 font-mono">
                    ৳{invoice.item.unitPrice.toLocaleString('en-BD')}
                  </td>
                  <td className="py-3 text-right font-bold text-slate-900 font-mono">
                    ৳{invoice.item.subtotal.toLocaleString('en-BD')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Pricing Summary */}
        <div className="p-5 sm:p-6 bg-slate-50/50 border-b border-slate-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <SvgBarcode text={invoice.invoiceNo} />
            </div>

            <div className="w-full sm:w-64 space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>পণ্যের মূল্য</span>
                <span className="font-mono">৳{invoice.pricing.subtotal.toLocaleString('en-BD')}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>ডেলিভারি চার্জ</span>
                <span className="font-mono">
                  {invoice.pricing.deliveryCharge === 0 ? (
                    <span className="text-emerald-600 font-semibold">ফ্রি</span>
                  ) : (
                    `৳${invoice.pricing.deliveryCharge.toLocaleString('en-BD')}`
                  )}
                </span>
              </div>

              {invoice.pricing.advancePaid > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>অগ্রিম পরিশোধ</span>
                  <span className="font-mono">-৳{invoice.pricing.advancePaid.toLocaleString('en-BD')}</span>
                </div>
              )}

              <div className="border-t border-slate-300 pt-2 flex justify-between items-center text-base font-extrabold text-slate-900">
                <span>ক্যাশ অন ডেলিভারি</span>
                <span className="text-emerald-700 text-lg font-mono">
                  ৳{invoice.pricing.codDue.toLocaleString('en-BD')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Official Store Assurance & Policy */}
        <div className="p-5 sm:p-6 bg-emerald-50/40 border-b border-emerald-100 text-xs text-slate-700 space-y-2">
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p>
              <strong className="text-emerald-900">১ বছর ওয়ারেন্টি পলিসি:</strong> ঘড়িটিতে ১ বছর মেশিন এবং কালারের অফিসিয়াল ওয়ারেন্টি থাকবে।
            </p>
          </div>
          <div className="flex items-start gap-2">
            <Package className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p>
              <strong className="text-emerald-900">চেক করে নেওয়ার সুযোগ:</strong> ডেলিভারিম্যান থেকে পার্সেল রিসিভ করার সময় অবশ্যই ঘড়িটি চেক করে টাকা পরিশোধ করবেন।
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white text-center text-xs text-slate-400">
          ধন্যবাদ আমাদের সাথে কেনাকাটা করার জন্য! Watch Gallery BD — Customer Support: {invoice.store.phone}
        </div>
      </div>
    </div>
  );
}
