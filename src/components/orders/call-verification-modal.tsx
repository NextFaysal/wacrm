'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { Order } from '@/types/commerce';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Phone,
  PhoneCall,
  PhoneOff,
  PhoneMissed,
  CheckCircle2,
  Calendar,
  XCircle,
  AlertTriangle,
  Clock,
  Send,
  Loader2,
  User,
  MapPin,
  Package,
  ShieldCheck,
  ShieldAlert,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

interface CallLogEntry {
  id: string;
  customer_phone: string;
  call_outcome: string;
  rescheduled_date?: string | null;
  cancellation_reason?: string | null;
  notes?: string | null;
  sms_sent: boolean;
  created_at: string;
  caller?: {
    full_name?: string | null;
    email?: string | null;
  };
}

interface CallVerificationModalProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderUpdated?: (order: Order) => void;
}

export function CallVerificationModal({
  order,
  open,
  onOpenChange,
  onOrderUpdated,
}: CallVerificationModalProps) {
  const [outcome, setOutcome] = useState<'confirmed' | 'no_answer' | 'busy' | 'rescheduled' | 'cancelled' | 'wrong_number'>('confirmed');
  const [rescheduledDate, setRescheduledDate] = useState<string>('');
  const [cancellationReason, setCancellationReason] = useState<string>('কাস্টমারের মন পরিবর্তন হয়েছে');
  const [notes, setNotes] = useState<string>('');
  const [sendSms, setSendSms] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [logs, setLogs] = useState<CallLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);

  // Fetch past logs for this order
  const fetchLogs = useCallback(async (orderId: string) => {
    try {
      setLoadingLogs(true);
      const res = await fetch(`/api/orders/call-log?orderId=${orderId}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    if (order && open) {
      fetchLogs(order.id);
      setOutcome('confirmed');
      setNotes('');
      setRescheduledDate('');
    }
  }, [order, open, fetchLogs]);

  if (!order) return null;

  const invoiceNo = order.invoice_no || `INV-${order.id.slice(0, 8).toUpperCase()}`;
  const totalAmount = Number(order.total_amount) || 0;
  const advanceAmount = Number(order.advance_paid) || 0;
  const codDue = Math.max(0, totalAmount - advanceAmount);

  const cleanPhone = order.customer_phone.replace(/\D/g, '');
  const waPhone = cleanPhone.startsWith('880')
    ? cleanPhone
    : cleanPhone.startsWith('0')
    ? `88${cleanPhone}`
    : `880${cleanPhone}`;

  const handleSubmit = async () => {
    try {
      setSaving(true);
      const res = await fetch('/api/orders/call-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          callOutcome: outcome,
          rescheduledDate: outcome === 'rescheduled' ? rescheduledDate : undefined,
          cancellationReason: outcome === 'cancelled' || outcome === 'wrong_number' ? cancellationReason : undefined,
          notes,
          shouldSendSms: sendSms,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save call log');
      }

      toast.success(
        outcome === 'confirmed'
          ? 'অর্ডার সফলভাবে কনফার্ম করা হয়েছে!'
          : outcome === 'cancelled'
          ? 'অর্ডারটি বাতিল ও স্টক রিস্টোর করা হয়েছে'
          : 'কল রিপোর্ট সংরক্ষণ করা হয়েছে'
      );

      if (data.smsSent) {
        toast.info('কাস্টমারকে অটোমেটিক SMS পাঠানো হয়েছে');
      }

      if (onOrderUpdated && data.order) {
        onOrderUpdated(data.order);
      }

      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error submitting call log');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] sm:max-w-2xl max-h-[92vh] flex flex-col p-0 rounded-2xl overflow-hidden border-border/80 shadow-2xl bg-background">
        {/* Header */}
        <DialogHeader className="p-4 sm:p-5 border-b bg-muted/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 space-y-0 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 ring-1 ring-emerald-500/20">
              <PhoneCall className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                কল ভেরিফিকেশন স্টেশন
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {invoiceNo}
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground truncate mt-0.5">
                গ্রাহককে কল করুন, ফলাফল নির্বাচন করুন ও কনফার্মেশন রিপোর্ট সংরক্ষণ করুন
              </DialogDescription>
            </div>
          </div>

          {/* Quick Actions (Call & WhatsApp) */}
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={`tel:${order.customer_phone}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-xs"
            >
              <Phone className="h-3.5 w-3.5" /> কল দিন
            </a>
            <a
              href={`https://wa.me/${waPhone}?text=${encodeURIComponent(`আসসালামু আলাইকুম ${order.customer_name}! আপনার ${order.product_name} অর্ডারের বিষয়ে যোগাযোগ করছি...`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 font-semibold text-xs transition-colors"
            >
              <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
            </a>
          </div>
        </DialogHeader>

        {/* Scrollable Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Customer & Order Summary Card */}
          <div className="rounded-xl border border-border/70 bg-card p-3.5 sm:p-4 space-y-2.5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-bold text-sm text-foreground truncate">{order.customer_name}</span>
                <span className="font-mono text-xs text-muted-foreground">({order.customer_phone})</span>
              </div>

              {order.risk_level === 'HIGH' ? (
                <Badge variant="destructive" className="gap-1 text-[10px] font-bold">
                  <ShieldAlert className="h-3 w-3" /> উচ্চ ঝুঁকি (Fraud Risk)
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-[10px] font-bold border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="h-3 w-3" /> নিরাপদ গ্রাহক
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground min-w-0">
                <Package className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="truncate font-medium text-foreground">
                  {order.product_name} {order.variant && order.variant !== 'Standard' ? `(${order.variant})` : ''} × {order.quantity || 1}
                </span>
              </div>
              <div className="sm:text-right flex items-center sm:justify-end gap-1.5 text-xs text-muted-foreground">
                <span>কুরিয়ার COD:</span>
                <strong className="text-foreground font-mono text-sm font-bold">
                  ৳{codDue.toLocaleString('en-BD')}
                </strong>
                {advanceAmount > 0 && (
                  <span className="text-[11px] text-emerald-600 font-medium">
                    (৳{advanceAmount} অগ্রিম)
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-start gap-1.5 text-muted-foreground text-xs pt-1 border-t border-border/30">
              <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
              <span className="line-clamp-2 leading-relaxed">
                {order.customer_address || 'ঠিকানা দেওয়া হয়নি'}
                {order.thana ? `, ${order.thana}` : ''}
                {order.district ? `, ${order.district}` : ''}
              </span>
            </div>
          </div>

          {/* Outcome Selection Grid */}
          <div className="space-y-2.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              কল ফলাফল নির্বাচন করুন (Call Outcome):
            </Label>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {/* Confirmed */}
              <button
                type="button"
                onClick={() => setOutcome('confirmed')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 ${
                  outcome === 'confirmed'
                    ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'bg-card border-border/70 hover:border-emerald-500/40 hover:bg-muted/30'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    কনফার্মড
                  </div>
                  {outcome === 'confirmed' && (
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  গ্রাহক পার্সেল নিতে নিশ্চিত করেছেন
                </p>
              </button>

              {/* No Answer */}
              <button
                type="button"
                onClick={() => setOutcome('no_answer')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 ${
                  outcome === 'no_answer'
                    ? 'border-amber-500 bg-amber-50/80 dark:bg-amber-950/40 ring-2 ring-amber-500/20 shadow-xs'
                    : 'bg-card border-border/70 hover:border-amber-500/40 hover:bg-muted/30'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                    <PhoneMissed className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    কল ধরেননি
                  </div>
                  {outcome === 'no_answer' && (
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  ফোন রিং হয়েছে কিন্তু রিসিভ করেননি
                </p>
              </button>

              {/* Busy */}
              <button
                type="button"
                onClick={() => setOutcome('busy')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 ${
                  outcome === 'busy'
                    ? 'border-amber-500 bg-amber-50/80 dark:bg-amber-950/40 ring-2 ring-amber-500/20 shadow-xs'
                    : 'bg-card border-border/70 hover:border-amber-500/40 hover:bg-muted/30'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                    <PhoneOff className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    ব্যস্ত / বন্ধ
                  </div>
                  {outcome === 'busy' && (
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  কল ওয়েটিং বা সংযোগ বন্ধ ছিল
                </p>
              </button>

              {/* Rescheduled */}
              <button
                type="button"
                onClick={() => setOutcome('rescheduled')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 ${
                  outcome === 'rescheduled'
                    ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 ring-2 ring-blue-500/20 shadow-xs'
                    : 'bg-card border-border/70 hover:border-blue-500/40 hover:bg-muted/30'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                    <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    তারিখ পেছানো
                  </div>
                  {outcome === 'rescheduled' && (
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  নির্দিষ্ট দিন পর পার্সেল পাঠাতে চেয়েছেন
                </p>
              </button>

              {/* Cancelled */}
              <button
                type="button"
                onClick={() => setOutcome('cancelled')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 ${
                  outcome === 'cancelled'
                    ? 'border-rose-500 bg-rose-50/80 dark:bg-rose-950/40 ring-2 ring-rose-500/20 shadow-xs'
                    : 'bg-card border-border/70 hover:border-rose-500/40 hover:bg-muted/30'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                    <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                    কাস্টমার বাতিল
                  </div>
                  {outcome === 'cancelled' && (
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  অর্ডার বাতিল ও স্টক স্বয়ংক্রিয় রিস্টোর হবে
                </p>
              </button>

              {/* Fake / Wrong */}
              <button
                type="button"
                onClick={() => setOutcome('wrong_number')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 ${
                  outcome === 'wrong_number'
                    ? 'border-rose-500 bg-rose-50/80 dark:bg-rose-950/40 ring-2 ring-rose-500/20 shadow-xs'
                    : 'bg-card border-border/70 hover:border-rose-500/40 hover:bg-muted/30'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                    <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                    ভুল নম্বর / ফেক
                  </div>
                  {outcome === 'wrong_number' && (
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  ভুল নম্বর বা অন্য কারো নম্বর দেওয়া
                </p>
              </button>
            </div>
          </div>

          {/* Conditional Inputs */}
          {outcome === 'rescheduled' && (
            <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-200/80 dark:border-blue-900/40 space-y-1.5 animate-in fade-in slide-in-from-top-1">
              <Label className="text-xs font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> ডেলিভারির সম্ভাব্য তারিখ নির্ধারণ করুন:
              </Label>
              <Input
                type="date"
                value={rescheduledDate}
                onChange={(e) => setRescheduledDate(e.target.value)}
                className="bg-background text-xs h-9"
              />
            </div>
          )}

          {(outcome === 'cancelled' || outcome === 'wrong_number') && (
            <div className="p-3.5 bg-rose-50/60 dark:bg-rose-950/30 rounded-xl border border-rose-200/80 dark:border-rose-900/40 space-y-1.5 animate-in fade-in slide-in-from-top-1">
              <Label className="text-xs font-semibold text-rose-900 dark:text-rose-200 flex items-center gap-1.5">
                <XCircle className="h-3.5 w-3.5" /> বাতিলের কারণ লিখুন:
              </Label>
              <Input
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="যেমন: কাস্টমার অন্য জায়গা থেকে নিয়েছেন / ভুল অর্ডার"
                className="bg-background text-xs h-9"
              />
            </div>
          )}

          {/* Agent Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">
              এজেন্ট নোট (Internal Notes):
            </Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="যেমন: কাস্টমার বিকেল ৫টায় কল করতে বলেছেন..."
              className="text-xs h-9 rounded-lg"
            />
          </div>

          {/* Auto SMS Toggle */}
          <div className="flex items-center justify-between p-3.5 bg-card rounded-xl border border-border/70 shadow-xs">
            <div className="space-y-0.5 pr-2">
              <span className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                <Send className="h-3.5 w-3.5 text-primary" /> গ্রাহককে স্বয়ংক্রিয় SMS পাঠান
              </span>
              <p className="text-[11px] text-muted-foreground">
                {outcome === 'confirmed'
                  ? 'পার্সেল ট্র্যাকিং লিংকসহ অর্ডার কনফার্মেশন SMS পাঠানো হবে'
                  : outcome === 'no_answer' || outcome === 'busy'
                  ? '১-ক্লিক অনলাইন কনফার্মেশন লিংক সহ নো-অ্যানসার SMS পাঠানো হবে'
                  : 'SMS পাঠানো বন্ধ রাখা হবে'}
              </p>
            </div>
            <Switch checked={sendSms} onCheckedChange={setSendSms} />
          </div>

          {/* Past Call History */}
          {logs.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border/40">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> ইতিপূর্বে করা কলের হিস্ট্রি ({logs.length})
              </Label>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-lg bg-muted/40 border border-border/40 text-xs flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className="text-[10px] uppercase font-mono shrink-0">
                        {log.call_outcome}
                      </Badge>
                      <span className="text-foreground truncate">{log.notes || 'কোনো নোট নেই'}</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                      {new Date(log.created_at).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        <DialogFooter className="p-3 sm:p-4 border-t bg-background/95 backdrop-blur-md flex flex-row items-center justify-between sm:justify-end gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="h-9 px-4 text-xs font-medium"
          >
            বাতিল
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={saving}
            className="h-9 px-4 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> সংরক্ষণ হচ্ছে...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" /> রিপোর্ট সংরক্ষণ করুন
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
