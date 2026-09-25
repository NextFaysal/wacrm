'use client';

import { useState } from 'react';
import { CreditCard, Send, CheckCircle2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

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
import type { Contact } from '@/types';

interface AdvanceChargeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact | null;
  onSendMessage: (text: string) => void;
}

export function AdvanceChargeDialog({
  open,
  onOpenChange,
  contact,
  onSendMessage,
}: AdvanceChargeDialogProps) {
  const [amount, setAmount] = useState('150');
  const [bkashNumber, setBkashNumber] = useState('017XXXXXXXX');
  const [nagadNumber, setNagadNumber] = useState('018XXXXXXXX');
  const [customNote, setCustomNote] = useState('');

  const handleSendPaymentRequest = () => {
    const lines = [
      `💳 *অর্ডার কনফার্মেশন ও অগ্রিম ডেলিভারি চার্জ*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `সম্মানিত গ্রাহক, আপনার ঘড়ির অর্ডারটি কনফার্ম করে দ্রুত কুরিয়ারে হস্তান্তরের জন্য ডেলিভারি চার্জটি অগ্রিম পরিশোধ করার অনুরোধ করা হচ্ছে:`,
      `\n💰 *অগ্রিম ডেলিভারি ফি:* ৳${amount}`,
      `\n📱 *পেমেন্ট মেথড (Send Money):*`,
      bkashNumber ? `• bKash Personal: \`${bkashNumber}\`` : '',
      nagadNumber ? `• Nagad Personal: \`${nagadNumber}\`` : '',
      `\nটাকা পাঠানোর পর ফিরতি মেসেজে আপনার ট্রানজেকশন আইডি (TrxID) অথবা মোবাইল নম্বরের শেষের ৪ ডিজিট লিখে পাঠান।`,
      `টাকা কনফার্ম হওয়ার সাথে সাথেই আপনার পার্সেলটি কুরিয়ারে বুক করে লাইভ ট্র্যাকিং কোড দেওয়া হবে।`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `ধন্যবাদ! ⌚`,
    ];

    const message = lines.filter(Boolean).join('\n');
    onSendMessage(message);
    onOpenChange(false);
    toast.success('Advance charge payment instructions sent to chat!');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <CreditCard className="size-5 text-amber-500" />
            Advance Delivery Charge Request (অগ্রিম ডেলিভারি ফি)
          </DialogTitle>
          <DialogDescription>
            Ask customer for a nominal advance delivery fee (bKash/Nagad) to secure order confirmation and prevent parcel returns.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-2">
          <div className="space-y-1.5">
            <Label>Select Advance Amount</Label>
            <div className="grid grid-cols-3 gap-2">
              {['100', '150', '200'].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmount(amt)}
                  className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                    amount === amt
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card hover:bg-muted text-foreground'
                  }`}
                >
                  ৳{amt} {amt === '100' ? '(Dhaka)' : '(Outside)'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>bKash Personal Number</Label>
              <Input
                value={bkashNumber}
                onChange={(e) => setBkashNumber(e.target.value)}
                placeholder="017XXXXXXXX"
              />
            </div>
            <div className="space-y-1">
              <Label>Nagad Personal Number</Label>
              <Input
                value={nagadNumber}
                onChange={(e) => setNagadNumber(e.target.value)}
                placeholder="018XXXXXXXX"
              />
            </div>
          </div>

          <div className="rounded-lg p-2.5 bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
            <div className="font-semibold flex items-center gap-1.5">
              <ShieldAlert className="size-3.5 shrink-0" />
              RTO Protection Tip
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Taking ৳100–150 advance delivery charge eliminates 95% of fake and casual orders for watch sellers in Bangladesh.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSendPaymentRequest} className="gap-1.5 bg-amber-600 hover:bg-amber-700">
            <Send className="size-4" />
            Send bKash/Nagad Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
