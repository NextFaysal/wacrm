'use client';

import { useState, useEffect, useCallback } from 'react';
import { Package, Truck, Send, CheckCircle2, Loader2, ExternalLink, ShieldAlert, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CourierProvider, CourierOrderRecord, FraudCheckResult } from '@/lib/courier/types';
import type { Contact } from '@/types';

interface CourierOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId?: string;
  contact?: Contact | null;
  onSendWhatsAppMessage?: (text: string) => void;
  onOrderCreated?: (order: CourierOrderRecord) => void;
}

export function CourierOrderDialog({
  open,
  onOpenChange,
  conversationId,
  contact,
  onSendWhatsAppMessage,
  onOrderCreated,
}: CourierOrderDialogProps) {
  const [provider, setProvider] = useState<CourierProvider>('steadfast');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [codAmount, setCodAmount] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [note, setNote] = useState('');

  const [loading, setLoading] = useState(false);
  const [bookedOrder, setBookedOrder] = useState<CourierOrderRecord | null>(null);
  const [fraudScore, setFraudScore] = useState<FraudCheckResult | null>(null);
  const [checkingFraud, setCheckingFraud] = useState(false);

  const checkCustomerFraud = useCallback(async (num: string) => {
    const clean = num.replace(/\D/g, '').replace(/^(8801|880)/, (m) => m === '8801' ? '01' : '0');
    if (!clean || clean.length < 11) {
      setFraudScore(null);
      return;
    }

    setCheckingFraud(true);
    try {
      const res = await fetch(`/api/courier/fraud-check?phone=${encodeURIComponent(clean)}`);
      const data = await res.json();
      if (res.ok && data.fraud_check) {
        setFraudScore(data.fraud_check);
      } else {
        setFraudScore(null);
      }
    } catch {
      setFraudScore(null);
    } finally {
      setCheckingFraud(false);
    }
  }, []);

  // Pre-fill contact details when dialog opens
  useEffect(() => {
    if (open) {
      const initialPhone = contact?.phone || '';
      setName(contact?.name || '');
      setPhone(initialPhone);
      setAddress((contact as { address?: string })?.address || '');
      setCodAmount('');
      setInvoiceId(`INV-${Date.now().toString().slice(-6)}`);
      setNote('');
      setBookedOrder(null);
      setFraudScore(null);

      if (initialPhone) {
        checkCustomerFraud(initialPhone);
      }
    }
  }, [open, contact, checkCustomerFraud]);

  const handleBookOrder = async () => {
    if (!name.trim()) {
      toast.error('Recipient name is required');
      return;
    }
    if (!phone.trim()) {
      toast.error('Recipient phone is required');
      return;
    }
    if (!address.trim()) {
      toast.error('Delivery address is required');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/courier/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          recipient_name: name.trim(),
          recipient_phone: phone.trim(),
          recipient_address: address.trim(),
          cod_amount: Number(codAmount) || 0,
          invoice_id: invoiceId.trim(),
          note: note.trim(),
          conversation_id: conversationId,
          contact_id: contact?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to dispatch order to courier');
        return;
      }

      setBookedOrder(data.order);
      onOrderCreated?.(data.order);
      toast.success(`Parcel booked successfully with ${provider.toUpperCase()}!`);
    } catch {
      toast.error('Network error booking parcel');
    } finally {
      setLoading(false);
    }
  };

  const generateTrackingMessage = (order: CourierOrderRecord): string => {
    const courierName =
      order.provider === 'steadfast'
        ? 'Steadfast Courier'
        : order.provider === 'pathao'
          ? 'Pathao Courier'
          : order.provider === 'redx'
            ? 'RedX Courier'
            : 'Paperfly';

    const lines = [
      `📦 *আপনার অর্ডারটি কুরিয়ারে বুক করা হয়েছে!*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `*Courier Service:* ${courierName}`,
      order.tracking_code ? `*Tracking Code:* \`${order.tracking_code}\`` : '',
      order.consignment_id ? `*Consignment ID:* \`${order.consignment_id}\`` : '',
      order.cod_amount ? `*Cash On Delivery (COD):* ৳${order.cod_amount}` : '',
      `*Delivery Address:* ${order.recipient_address}`,
      order.tracking_url ? `\n👉 *লাইভ পার্সেল ট্র্যাকিং লিংক:*\n${order.tracking_url}` : '',
      `━━━━━━━━━━━━━━━━━━━━`,
      `কুরিয়ার ডেলিভারি রাইডার আপনার সাথে ডেলিভারির পূর্বে ফোনে যোগাযোগ করবে। ধন্যবাদ!`,
    ];

    return lines.filter(Boolean).join('\n');
  };

  const handleSendWhatsAppNotification = () => {
    if (!bookedOrder || !onSendWhatsAppMessage) return;
    const text = generateTrackingMessage(bookedOrder);
    onSendWhatsAppMessage(text);
    onOpenChange(false);
    toast.success('Tracking details sent to customer on WhatsApp');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="size-5 text-primary" />
            Book Courier Parcel (কুরিয়ার পার্সেল বুকিং)
          </DialogTitle>
          <DialogDescription>
            Send order & delivery details directly to the courier API (Steadfast, Pathao, RedX, Paperfly).
          </DialogDescription>
        </DialogHeader>

        {bookedOrder ? (
          // Success State
          <div className="space-y-4 py-4">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
              <CheckCircle2 className="mx-auto size-10 text-emerald-500 mb-2" />
              <h3 className="text-base font-semibold text-emerald-300">
                Parcel Booked Successfully!
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Courier:{' '}
                <span className="font-semibold uppercase text-foreground">
                  {bookedOrder.provider}
                </span>
              </p>
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tracking Code:</span>
                <span className="font-mono font-medium text-foreground">
                  {bookedOrder.tracking_code}
                </span>
              </div>
              {bookedOrder.consignment_id && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Consignment ID:</span>
                  <span className="font-mono text-foreground">{bookedOrder.consignment_id}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">COD Amount:</span>
                <span className="font-semibold text-foreground">৳{bookedOrder.cod_amount}</span>
              </div>
              {bookedOrder.tracking_url && (
                <div className="pt-2">
                  <a
                    href={bookedOrder.tracking_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                  >
                    View Live Tracking Online <ExternalLink className="size-3" />
                  </a>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              {onSendWhatsAppMessage && (
                <Button onClick={handleSendWhatsAppNotification} className="gap-1.5">
                  <Send className="size-4" />
                  Send Tracking to Customer on WhatsApp
                </Button>
              )}
            </DialogFooter>
          </div>
        ) : (
          // Booking Form State
          <div className="space-y-4 py-2">
            {/* Courier Selection */}
            <div className="space-y-1.5">
              <Label>Select Courier Service *</Label>
              <Select value={provider} onValueChange={(val) => setProvider(val as CourierProvider)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="steadfast">Steadfast Courier (স্টেডফাস্ট)</SelectItem>
                  <SelectItem value="pathao">Pathao Courier (পাঠাও)</SelectItem>
                  <SelectItem value="redx">RedX Courier (রেডএক্স)</SelectItem>
                  <SelectItem value="paperfly">Paperfly (পেপারফ্লাই)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Recipient Details */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-name">Customer Name *</Label>
                <Input
                  id="c-name"
                  placeholder="e.g. Rahim Ahmed"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="c-phone">Customer Phone *</Label>
                  {checkingFraud && (
                    <span className="text-[10px] text-muted-foreground animate-pulse flex items-center gap-1">
                      <Loader2 className="size-3 animate-spin" />
                      Checking fraud score...
                    </span>
                  )}
                </div>
                <Input
                  id="c-phone"
                  placeholder="017XXXXXXXX"
                  value={phone}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPhone(val);
                    if (val.replace(/\D/g, '').length >= 11) {
                      checkCustomerFraud(val);
                    }
                  }}
                />
              </div>
            </div>

            {/* Steadfast Delivery Fraud & Reliability Alert */}
            {fraudScore && (
              <div
                className={cn(
                  'rounded-lg p-2.5 text-xs flex items-start gap-2.5 border transition-all',
                  fraudScore.level === 'danger' || fraudScore.level === 'risky'
                    ? 'bg-red-500/10 border-red-500/30 text-red-400'
                    : fraudScore.level === 'caution'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : fraudScore.level === 'trusted' || fraudScore.level === 'good'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-muted/50 border-border text-muted-foreground'
                )}
              >
                {fraudScore.level === 'danger' || fraudScore.level === 'risky' ? (
                  <ShieldAlert className="size-4 shrink-0 mt-0.5 text-red-500" />
                ) : (
                  <ShieldCheck className="size-4 shrink-0 mt-0.5 text-emerald-500" />
                )}
                <div className="space-y-0.5">
                  <div className="font-semibold flex items-center gap-1.5 capitalize">
                    <span>Steadfast Reliability: {fraudScore.level}</span>
                    {fraudScore.score !== null && (
                      <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-background/50">
                        {fraudScore.score}/100
                      </span>
                    )}
                    {fraudScore.total_reports > 0 && (
                      <span className="text-red-400 font-medium text-[11px]">
                        ({fraudScore.total_reports} Fraud/Fake Reports)
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] opacity-90">
                    {fraudScore.level === 'danger' || fraudScore.level === 'risky'
                      ? '⚠️ সতর্কতা: এই নম্বরে কুরিয়ারে রিটার্ন বা প্রতারণার রেকর্ড রয়েছে! ক্যাশ অন ডেলিভারির পূর্বে অগ্রিম কুরিয়ার চার্জ নেওয়া নিরাপদ।'
                      : fraudScore.level === 'caution'
                      ? 'সাবধানতা: গ্রাহকের অতীতে কিছু কুরিয়ার সমস্যা বা অর্ডার বাতিলের রেকর্ড রয়েছে।'
                      : fraudScore.level === 'trusted' || fraudScore.level === 'good'
                      ? '✅ নিরাপদ গ্রাহক: কুরিয়ারে কোনো খারাপ রিপোর্ট নেই, সফল ডেলিভারি রেকর্ড অত্যন্ত ভালো।'
                      : 'ℹ️ নতুন গ্রাহক: কুরিয়ার ডাটাবেজে কোনো রেকর্ড পাওয়া যায়নি।'}
                  </p>
                </div>
              </div>
            )}

            {/* Address */}
            <div className="space-y-1.5">
              <Label htmlFor="c-addr">Delivery Address (জেলা, থানা, ঠিকানা) *</Label>
              <Textarea
                id="c-addr"
                rows={2}
                placeholder="House #, Road #, Area, Thana, District"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            {/* COD & Invoice */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-cod">Cash on Delivery (COD Amount ৳) *</Label>
                <Input
                  id="c-cod"
                  type="number"
                  placeholder="e.g. 1200"
                  value={codAmount}
                  onChange={(e) => setCodAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-inv">Invoice / Order ID</Label>
                <Input
                  id="c-inv"
                  placeholder="e.g. INV-102"
                  value={invoiceId}
                  onChange={(e) => setInvoiceId(e.target.value)}
                />
              </div>
            </div>

            {/* Delivery Note */}
            <div className="space-y-1.5">
              <Label htmlFor="c-note">Delivery Instructions / Note</Label>
              <Input
                id="c-note"
                placeholder="e.g. Call before delivery / Fragile product"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleBookOrder} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Package className="size-4" />}
                Send to Courier (API)
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
