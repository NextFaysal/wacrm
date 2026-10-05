'use client';

import React, { useState, useEffect } from 'react';
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
import { CreditCard, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface AdvancePaymentDialogProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const PAYMENT_METHODS = [
  { id: 'bkash', label: 'bKash (বিকাশ)' },
  { id: 'nagad', label: 'Nagad (নগদ)' },
  { id: 'rocket', label: 'Rocket (রকেট)' },
  { id: 'bank', label: 'Bank Transfer' },
  { id: 'cash', label: 'Cash / Other' },
];

export function AdvancePaymentDialog({
  order,
  open,
  onOpenChange,
  onSuccess,
}: AdvancePaymentDialogProps) {
  const [advancePaid, setAdvancePaid] = useState('');
  const [advanceMethod, setAdvanceMethod] = useState('bkash');
  const [advanceTrxId, setAdvanceTrxId] = useState('');
  const [advanceStatus, setAdvanceStatus] = useState('verified');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (order) {
      setAdvancePaid(order.advance_paid ? String(order.advance_paid) : '150');
      setAdvanceMethod(order.advance_method || 'bkash');
      setAdvanceTrxId(order.advance_trx_id || '');
      setAdvanceStatus(order.advance_status || 'verified');
    }
  }, [order]);

  if (!order) return null;

  const totalAmount = Number(order.total_amount) || 0;
  const numPaid = Number(advancePaid) || 0;
  const remainingCod = Math.max(0, totalAmount - numPaid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: order.id,
          advance_paid: numPaid,
          advance_method: advanceMethod,
          advance_trx_id: advanceTrxId.trim(),
          advance_status: advanceStatus,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Advance payment of ৳${numPaid} saved successfully!`);
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(data.error || 'Failed to update advance payment');
      }
    } catch {
      toast.error('Network error saving advance payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[95vw] rounded-2xl">
        <DialogHeader className="pb-1">
          <DialogTitle className="flex items-center gap-2.5 text-base">
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <CreditCard className="h-4 w-4" />
            </div>
            Advance Payment
          </DialogTitle>
          <DialogDescription className="text-xs ml-10.5">
            অর্ডার #{order.invoice_no || order.id.slice(0, 8)} — {order.customer_name} এর অগ্রিম পেমেন্ট।
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          {/* Summary Bar */}
          <div className="bg-muted/50 border border-border/60 p-3 rounded-xl grid grid-cols-3 gap-2 text-xs">
            <div className="text-center">
              <span className="text-muted-foreground block mb-0.5">Order Total</span>
              <p className="font-bold text-sm">৳{totalAmount.toLocaleString('en-BD')}</p>
            </div>
            <div className="text-center border-x border-border/50">
              <span className="text-muted-foreground block mb-0.5">Advance</span>
              <p className="font-bold text-sm text-emerald-600">৳{numPaid.toLocaleString('en-BD')}</p>
            </div>
            <div className="text-center">
              <span className="text-muted-foreground block mb-0.5">COD Due</span>
              <p className="font-black text-sm text-primary">৳{remainingCod.toLocaleString('en-BD')}</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="advanceAmount" className="text-xs font-semibold">Advance Amount (৳)</Label>
            <Input
              id="advanceAmount"
              type="number"
              min="0"
              max={totalAmount}
              value={advancePaid}
              onChange={(e) => setAdvancePaid(e.target.value)}
              placeholder="e.g. 150"
              required
              className="h-9 font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Payment Method</Label>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setAdvanceMethod(m.id)}
                  className={`text-xs py-2 px-3 rounded-lg border text-left transition-all flex items-center justify-between ${
                    advanceMethod === m.id
                      ? 'border-primary bg-primary/10 font-bold text-primary'
                      : 'border-input hover:bg-muted/50 text-foreground'
                  }`}
                >
                  {m.label}
                  {advanceMethod === m.id && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="trxId" className="text-xs font-semibold">Transaction ID (Optional)</Label>
            <Input
              id="trxId"
              value={advanceTrxId}
              onChange={(e) => setAdvanceTrxId(e.target.value)}
              placeholder="e.g. 9L184K39"
              className="h-9 font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Verification Status</Label>
            <div className="flex gap-2">
              <Button
                type="button" size="sm"
                variant={advanceStatus === 'verified' ? 'default' : 'outline'}
                className="flex-1 text-xs h-9"
                onClick={() => setAdvanceStatus('verified')}
              >
                ✅ Verified
              </Button>
              <Button
                type="button" size="sm"
                variant={advanceStatus === 'pending' ? 'secondary' : 'outline'}
                className="flex-1 text-xs h-9"
                onClick={() => setAdvanceStatus('pending')}
              >
                ⏳ Pending
              </Button>
            </div>
          </div>

          <DialogFooter className="pt-1 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none">
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading} className="flex-1 sm:flex-none gap-1.5">
              {loading ? (
                <><AlertCircle className="h-3.5 w-3.5 animate-pulse" /> Saving...</>
              ) : (
                <><CheckCircle2 className="h-3.5 w-3.5" /> Save Payment</>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

