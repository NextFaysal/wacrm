'use client';

import React, { useState, useEffect } from 'react';
import type { Order, OrderStatus } from '@/types/commerce';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ShoppingBag,
  User,
  Phone,
  MapPin,
  Package,
  Truck,
  CreditCard,
  Printer,
  Smartphone,
  Edit3,
  ExternalLink,
  Copy,
  Check,
  Send,
  RefreshCw,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  MessageSquare,
  Clock,
  Crown,
  Coins,
  Gift,
  PhoneCall,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { CallVerificationModal } from './call-verification-modal';

interface OrderDetailsSheetProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allOrders?: Order[];
  onEditOrder: (order: Order) => void;
  onPrintInvoice: (order: Order) => void;
  onBookCourier: (order: Order) => void;
  onStatusUpdate: (orderId: string, status: OrderStatus) => Promise<void>;
  onSyncCourier: (orderId: string) => Promise<void>;
}

export function OrderDetailsSheet({
  order,
  open,
  onOpenChange,
  allOrders = [],
  onEditOrder,
  onPrintInvoice,
  onBookCourier,
  onStatusUpdate,
  onSyncCourier,
}: OrderDetailsSheetProps) {
  const [copiedInvoice, setCopiedInvoice] = useState(false);
  const [copiedTracking, setCopiedTracking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [sendingMsg, setSendingMsg] = useState<string | null>(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [loyaltyData, setLoyaltyData] = useState<any>(null);

  const handleSendOtp = async () => {
    if (!order) return;
    setSendingOtp(true);
    try {
      const res = await fetch('/api/orders/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send OTP');
      toast.success(`OTP (${data.otp}) ও কনফার্মেশন লিঙ্ক SMS পাঠানো হয়েছে!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error sending OTP');
    } finally {
      setSendingOtp(false);
    }
  };

  useEffect(() => {
    if (order?.customer_phone) {
      fetch(`/api/loyalty?phone=${encodeURIComponent(order.customer_phone)}`)
        .then((r) => r.json())
        .then((d) => {
          if (d?.profile || d?.calculated) {
            setLoyaltyData(d);
          }
        })
        .catch(() => {});
    } else {
      setLoyaltyData(null);
    }
  }, [order?.customer_phone]);

  if (!order) return null;

  const invoiceNo = order.invoice_no || `INV-${order.id.slice(0, 8).toUpperCase()}`;
  const advancePaid = Number(order.advance_paid) || 0;
  const totalAmount = Number(order.total_amount) || 0;
  const codDue = Math.max(0, totalAmount - advancePaid);

  // Check for duplicates with same phone
  const duplicateOrders = allOrders.filter(
    (o) =>
      o.id !== order.id &&
      o.customer_phone.replace(/\D/g, '') === order.customer_phone.replace(/\D/g, '') &&
      o.status !== 'CANCELLED'
  );

  const copyToClipboard = (text: string, type: 'invoice' | 'tracking') => {
    navigator.clipboard.writeText(text);
    if (type === 'invoice') {
      setCopiedInvoice(true);
      setTimeout(() => setCopiedInvoice(false), 2000);
      toast.success('ইনভয়েস নম্বর কপি করা হয়েছে');
    } else {
      setCopiedTracking(true);
      setTimeout(() => setCopiedTracking(false), 2000);
      toast.success('ট্র্যাকিং কোড কপি করা হয়েছে');
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      await onSyncCourier(order.id);
    } finally {
      setSyncing(false);
    }
  };

  const handleSendWhatsAppQuick = async (type: 'confirm' | 'tracking' | 'reschedule' | 'feedback') => {
    const cleanPhone = order.customer_phone.replace(/\D/g, '');
    const waPhone = cleanPhone.startsWith('880') ? cleanPhone : `880${cleanPhone.replace(/^0/, '')}`;

    let text = '';
    if (type === 'confirm') {
      text = `আসসালামু আলাইকুম ${order.customer_name}! ✨\nআপনার অর্ডারটি সফলভাবে কনফার্ম করা হয়েছে।\n\n🔖 ইনভয়েস: ${invoiceNo}\n📦 প্রোডাক্ট: ${order.product_name} (${order.variant || 'Standard'})\n🔢 পরিমাণ: ${order.quantity}\n💰 মোট বিল: ৳${totalAmount.toLocaleString('en-BD')}\n📍 ডেলিভারি ঠিকানা: ${order.customer_address}\n\nখুব শীঘ্রই পার্সেলটি কুরিয়ারে বুকিং করে ট্র্যাকিং কোড জানানো হবে। ধন্যবাদ! 🌸`;
    } else if (type === 'tracking') {
      text = `আসসালামু আলাইকুম ${order.customer_name}! 🚚\nআপনার পার্সেলটি কুরিয়ারে বুকিং সম্পন্ন হয়েছে।\n\n📦 কুরিয়ার: ${order.courier_provider?.toUpperCase() || 'STEADFAST'}\n🔖 ট্র্যাকিং কোড: ${order.courier_tracking_code || 'N/A'}\n💰 কুরিয়ারে প্রদেয় (COD): ৳${codDue.toLocaleString('en-BD')}\n\nখুব শীঘ্রই ডেলিভারিম্যান আপনার সাথে যোগাযোগ করবেন। ধন্যবাদ! ✨`;
    } else if (type === 'reschedule') {
      text = `আসসালামু আলাইকুম ${order.customer_name}! ⚠️\nকুরিয়ারের ডেলিভারিম্যান আপনার সাথে যোগাযোগ করতে পারেনি বলে জানিয়েছে।\n\n🔖 ইনভয়েস: ${invoiceNo}\n📦 প্রোডাক্ট: ${order.product_name}\n\nআপনি কি অনুগ্রহ করে আগামীকাল ডেলিভারি নিতে পারবেন? অনুগ্রহ করে নিশ্চিত করুন যাতে আমরা কুরিয়ারে পুনরায় রিকোয়েস্ট পাঠাতে পারি। ধন্যবাদ!`;
    } else if (type === 'feedback') {
      text = `আসসালামু আলাইকুম ${order.customer_name}! 🎁\nআশা করি আপনার অর্ডার করা পণ্যটি (${order.product_name}) ভালো অবস্থায় পেয়ে গেছেন।\n\nআমাদের পণ্যের মান ও সেবা কেমন লেগেছে জানালে আমরা কৃতজ্ঞ হব। আপনার পরবর্তী অর্ডারের জন্য বিশেষ ডিসকাউন্ট পেতে আমাদের জানান। ধন্যবাদ! ⭐`;
    }

    if (order.conversation_id) {
      try {
        setSendingMsg(type);
        const res = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: order.conversation_id,
            messageType: 'text',
            text,
          }),
        });
        if (res.ok) {
          toast.success('গ্রাহকের হোয়াটসঅ্যাপে মেসেজ পাঠানো হয়েছে!');
        } else {
          window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`, '_blank');
        }
      } catch {
        window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`, '_blank');
      } finally {
        setSendingMsg(null);
      }
    } else {
      window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`, '_blank');
    }
  };

  const isHighRisk = order.risk_level === 'HIGH';
  const isMediumRisk = order.risk_level === 'MEDIUM';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[95vw] max-w-lg p-0 overflow-y-auto">
        <SheetHeader className="border-b border-border/70 p-4 sticky top-0 bg-popover/95 backdrop-blur-md z-10">
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <SheetTitle className="text-base font-bold font-mono text-primary flex items-center gap-1.5">
                  <ShoppingBag className="h-4 w-4" />
                  {invoiceNo}
                </SheetTitle>
                <button
                  type="button"
                  onClick={() => copyToClipboard(invoiceNo, 'invoice')}
                  className="text-muted-foreground hover:text-foreground"
                  title="Copy invoice number"
                >
                  {copiedInvoice ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              <SheetDescription className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {order.created_at ? format(new Date(order.created_at), 'dd MMM yyyy, hh:mm a') : 'Recent'}{' '}
                {order.created_at && (
                  <span>({formatDistanceToNow(new Date(order.created_at), { addSuffix: true })})</span>
                )}
              </SheetDescription>
            </div>

            {/* Quick Header Actions */}
            <div className="flex items-center gap-1.5 mr-6">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={() => onEditOrder(order)}
                title="Edit Order Details"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={() => onPrintInvoice(order)}
                title="Print Invoice / Packing Slip"
              >
                <Printer className="h-3.5 w-3.5 text-primary" />
                Print
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1 text-emerald-600 border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-semibold"
                onClick={() => setCallModalOpen(true)}
                title="Open Phone Verification Station"
              >
                <PhoneCall className="h-3.5 w-3.5" />
                কল ভেরিফাই
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10"
                onClick={handleSendOtp}
                disabled={sendingOtp}
                title="Send Order Verification OTP (SMS)"
              >
                {sendingOtp ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Smartphone className="h-3.5 w-3.5" />}
                OTP SMS
              </Button>
              <a
                href={`/track/${encodeURIComponent(order.courier_tracking_code || invoiceNo)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1 text-blue-500 border-blue-500/30 hover:bg-blue-500/10" title="Open Public Live Tracking">
                  <Truck className="h-3.5 w-3.5" />
                  Track
                </Button>
              </a>
            </div>
          </div>
        </SheetHeader>

        <div className="p-4 space-y-4 text-xs">
          {/* Duplicate Order Warning Banner */}
          {duplicateOrders.length > 0 && (
            <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-400 space-y-1 animate-in fade-in">
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                সম্ভাব্য ডুপ্লিকেট অর্ডার সতর্কতা ({duplicateOrders.length}টি অন্যান্য অর্ডার পাওয়া গেছে)
              </div>
              <p className="text-[11px] text-muted-foreground">
                একই মোবাইল নম্বর ({order.customer_phone})-এ আরও সক্রিয় অর্ডার রয়েছে:{' '}
                {duplicateOrders.map((d) => d.invoice_no || d.id.slice(0, 8)).join(', ')}। কুরিয়ারে ডাবল
                পাঠানোর আগে কাস্টমারের সাথে কথা বলে নিশ্চিত হন।
              </p>
            </div>
          )}

          {/* Status & Risk Row */}
          <div className="rounded-lg border border-border/70 bg-card p-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[11px] text-muted-foreground mb-1">অর্ডার স্ট্যাটাস</div>
              <select
                value={order.status}
                onChange={(e) => onStatusUpdate(order.id, e.target.value as OrderStatus)}
                className="rounded-md border border-input bg-background px-2.5 py-1 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="NEW">NEW</option>
                <option value="CONFIRMED">CONFIRMED</option>
                <option value="PROCESSING">PROCESSING</option>
                <option value="COURIER_BOOKED">COURIER_BOOKED</option>
                <option value="SHIPPED">SHIPPED</option>
                <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option>
                <option value="DELIVERED">DELIVERED</option>
                <option value="CANCELLED">CANCELLED (Restock)</option>
                <option value="RETURNED">RETURNED (Restock)</option>
              </select>
            </div>

            <div>
              <div className="text-[11px] text-muted-foreground mb-1">ফ্রড রিস্ক লেভেল</div>
              <Badge
                variant="outline"
                className={`text-[10px] uppercase font-bold py-1 px-2 ${
                  isHighRisk
                    ? 'border-red-500 bg-red-500/10 text-red-500'
                    : isMediumRisk
                    ? 'border-amber-500 bg-amber-500/10 text-amber-500'
                    : 'border-emerald-500 bg-emerald-500/10 text-emerald-500'
                }`}
              >
                {isHighRisk ? (
                  <ShieldAlert className="mr-1 h-3.5 w-3.5" />
                ) : (
                  <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                )}
                {order.risk_level || 'LOW'} RISK
              </Badge>
            </div>
          </div>

          {/* Customer Profile Card */}
          <div className="rounded-lg border border-border/70 bg-card p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-primary" /> কাস্টমার তথ্য
              </span>
              {order.conversation_id && (
                <a
                  href={`/inbox?c=${order.conversation_id}`}
                  className="text-primary hover:underline flex items-center gap-1 text-[11px]"
                >
                  <MessageSquare className="h-3 w-3" /> হোয়াটসঅ্যাপ চ্যাট খুলুন
                </a>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">নাম:</span>
                <span className="font-medium text-foreground">{order.customer_name}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">মোবাইল:</span>
                <a
                  href={`tel:${order.customer_phone}`}
                  className="font-mono font-medium text-primary hover:underline inline-flex items-center gap-1"
                >
                  <Phone className="h-2.5 w-2.5" /> {order.customer_phone}
                </a>
              </div>
            </div>

            <div className="pt-1 border-t border-border/50">
              <span className="text-muted-foreground block text-[11px]">ডেলিভারি ঠিকানা:</span>
              <p className="font-medium text-foreground flex items-start gap-1 mt-0.5">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
                <span>
                  {order.customer_address}
                  {order.thana ? `, ${order.thana}` : ''}
                  {order.district ? `, ${order.district}` : ''}
                </span>
              </p>
            </div>
          </div>

          {/* Customer Loyalty & VIP Card */}
          {loyaltyData && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                  <Crown className="h-3.5 w-3.5 text-amber-500" /> লয়ালটি ও ভিআইপি স্ট্যাটাস
                </span>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-bold ${
                    loyaltyData.profile?.tier === 'VIP'
                      ? 'border-purple-500/50 text-purple-600 bg-purple-500/10'
                      : loyaltyData.profile?.tier === 'GOLD'
                      ? 'border-amber-500/50 text-amber-600 bg-amber-500/10'
                      : loyaltyData.profile?.tier === 'SILVER'
                      ? 'border-slate-500/50 text-slate-600 bg-slate-500/10'
                      : 'border-muted text-muted-foreground'
                  }`}
                >
                  {loyaltyData.calculated?.loyaltyBadgeBangla || loyaltyData.profile?.tier || 'BRONZE'}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-amber-500/20">
                <div className="flex items-center gap-1.5">
                  <Coins className="h-3.5 w-3.5 text-indigo-500" />
                  <div>
                    <span className="text-muted-foreground block text-[10px]">পয়েন্ট ব্যালেন্স:</span>
                    <span className="font-mono font-bold text-foreground">
                      {loyaltyData.profile?.points_balance || 0} pts
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Gift className="h-3.5 w-3.5 text-emerald-500" />
                  <div>
                    <span className="text-muted-foreground block text-[10px]">ক্যাশব্যাক ব্যালেন্স:</span>
                    <span className="font-mono font-bold text-emerald-600">
                      ৳{loyaltyData.profile?.cashback_balance || 0}
                    </span>
                  </div>
                </div>
              </div>

              {loyaltyData.calculated?.perks && loyaltyData.calculated.perks.length > 0 && (
                <div className="pt-1 border-t border-amber-500/20 text-[11px] text-muted-foreground">
                  সুবিধা: <span className="text-foreground font-medium">{loyaltyData.calculated.perks.join(' • ')}</span>
                </div>
              )}
            </div>
          )}

          {/* Product & Financial Overview */}
          <div className="rounded-lg border border-border/70 bg-card p-3 space-y-2.5">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-primary" /> প্রোডাক্ট ও পেমেন্ট বিবরণ
            </span>

            <div className="flex items-start justify-between gap-2 pb-2 border-b border-border/50">
              <div>
                <div className="font-semibold text-foreground">{order.product_name}</div>
                <div className="text-[11px] text-muted-foreground">
                  ভ্যারিয়েন্ট: <strong>{order.variant || 'Standard'}</strong> • পরিমাণ: {order.quantity} পিস
                </div>
              </div>
              <div className="text-right font-mono font-bold text-foreground">
                ৳{(order.unit_price * order.quantity).toLocaleString('en-BD')}
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>প্রোডাক্ট সাবটোটাল:</span>
                <span className="font-mono">৳{(order.unit_price * order.quantity).toLocaleString('en-BD')}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>ডেলিভারি চার্জ:</span>
                <span className="font-mono">৳{order.delivery_charge}</span>
              </div>
              {advancePaid > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>
                    অগ্রিম পরিশোধিত ({order.advance_method || 'bKash'}
                    {order.advance_trx_id ? ` - ${order.advance_trx_id}` : ''}):
                  </span>
                  <span className="font-mono">- ৳{advancePaid}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border/60 pt-2 font-bold text-sm">
                <span>কুরিয়ারে প্রদেয় (Net COD Due):</span>
                <span className="text-primary font-mono text-base font-black">
                  ৳{codDue.toLocaleString('en-BD')}
                </span>
              </div>
            </div>
          </div>

          {/* Courier & Tracking Section */}
          <div className="rounded-lg border border-border/70 bg-card p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-primary" /> কুরিয়ার ও লাইভ ট্র্যাকিং
              </span>
              {order.courier_tracking_code && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSync}
                  disabled={syncing}
                  className="h-7 text-[11px] gap-1 px-2"
                >
                  <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin text-primary' : ''}`} />
                  Sync Status
                </Button>
              )}
            </div>

            {order.courier_tracking_code ? (
              <div className="space-y-2 bg-muted/40 rounded-md p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-[11px]">কুরিয়ার প্রোভাইডার:</span>
                  <span className="font-bold text-foreground capitalize">
                    {order.courier_provider || 'Steadfast'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-[11px]">ট্র্যাকিং কোড:</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono font-bold text-primary">
                      {order.courier_tracking_code}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(order.courier_tracking_code!, 'tracking')}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {copiedTracking ? (
                        <Check className="h-3 w-3 text-emerald-600" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-[11px]">কুরিয়ার স্ট্যাটাস:</span>
                  <Badge variant="secondary" className="text-[10px] font-semibold uppercase">
                    {order.courier_status || 'In Transit'}
                  </Badge>
                </div>

                <div className="pt-1.5 border-t border-border/50 flex justify-end">
                  <a
                    href={
                      order.courier_provider === 'pathao'
                        ? `https://merchant.pathao.com/tracking?consignment_id=${order.courier_consignment_id || order.courier_tracking_code}`
                        : `https://portal.packzy.com/tracking?tracking_code=${order.courier_tracking_code}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                  >
                    কুরিয়ার পোর্টালে লাইভ ট্র্যাক করুন <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-dashed p-3 text-center space-y-2">
                <p className="text-muted-foreground text-xs">পার্সেলটি এখনও কুরিয়ারে বুকিং করা হয়নি।</p>
                {order.status !== 'CANCELLED' && order.status !== 'RETURNED' && (
                  <Button
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => {
                      onOpenChange(false);
                      onBookCourier(order);
                    }}
                  >
                    <Truck className="h-3.5 w-3.5" /> কুরিয়ারে পার্সেল বুক করুন
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Quick WhatsApp Notification Templates */}
          <div className="rounded-lg border border-border/70 bg-card p-3 space-y-2">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <Send className="h-3.5 w-3.5 text-emerald-600" /> গ্রাহককে কুইক হোয়াটসঅ্যাপ মেসেজ পাঠান
            </span>
            <p className="text-[11px] text-muted-foreground">
              এক ক্লিকে প্রি-মেড টেমপ্লেট দিয়ে গ্রাহককে অর্ডার সংক্রান্ত আপডেট মেসেজ পাঠান:
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-[11px] justify-start text-left truncate"
                onClick={() => handleSendWhatsAppQuick('confirm')}
                disabled={!!sendingMsg}
              >
                ✅ কনফার্মেশন মেসেজ
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-8 text-[11px] justify-start text-left truncate"
                onClick={() => handleSendWhatsAppQuick('tracking')}
                disabled={!order.courier_tracking_code || !!sendingMsg}
              >
                🚚 ট্র্যাকিং কোড মেসেজ
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-8 text-[11px] justify-start text-left truncate border-amber-500/40 text-amber-600 dark:text-amber-400"
                onClick={() => handleSendWhatsAppQuick('reschedule')}
                disabled={!!sendingMsg}
              >
                ⚠️ রি-সিডিউল রিকোয়েস্ট (RTO)
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-8 text-[11px] justify-start text-left truncate border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                onClick={() => handleSendWhatsAppQuick('feedback')}
                disabled={!!sendingMsg}
              >
                ⭐ রিভিউ ও ফিডব্যাক
              </Button>
            </div>
          </div>

          {/* Order Notes */}
          {order.notes && (
            <div className="rounded-lg border border-border/70 bg-muted/20 p-3 space-y-1">
              <span className="font-semibold text-foreground block text-[11px]">নোট / নির্দেশনা:</span>
              <p className="text-muted-foreground text-xs whitespace-pre-wrap">{order.notes}</p>
            </div>
          )}
        </div>
      </SheetContent>

      <CallVerificationModal
        order={order}
        open={callModalOpen}
        onOpenChange={setCallModalOpen}
        onOrderUpdated={(updated) => {
          onStatusUpdate(updated.id, updated.status);
        }}
      />
    </Sheet>
  );
}
