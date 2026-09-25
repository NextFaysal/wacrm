'use client';

import { useState } from 'react';
import { Star, Send, Gift, Video } from 'lucide-react';
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

interface ReviewRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact | null;
  onSendMessage: (text: string) => void;
}

export function ReviewRequestDialog({
  open,
  onOpenChange,
  contact,
  onSendMessage,
}: ReviewRequestDialogProps) {
  const [discountAmount, setDiscountAmount] = useState('200');

  const handleSendReviewRequest = () => {
    const lines = [
      `⭐ *আপনার নতুন ঘড়িটি কেমন লেগেছে?*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `সম্মানিত গ্রাহক, আশা করি আমাদের ঘড়িটি আপনার হাতে নিরাপদে পৌঁছেছে এবং ঘড়িটি আপনার দারুণ পছন্দ হয়েছে! ⌚✨`,
      `\n🎁 *আপনার জন্য একটি স্পেশাল গিফট অফার:*`,
      `ঘড়িটির একটি ছোট সুন্দর আনবক্সিং ভিডিও অথবা হাতে পরা একটি ছবি তুলে আমাদের এই হোয়াটসঅ্যাপে শেয়ার করলে আপনার পরবর্তী যেকোনা অর্ডারে পেয়ে যাবেন *ফ্ল্যাট ৳${discountAmount} ডিসকাউন্ট ভাউচার*!`,
      `\nআপনার মূল্যবান মতামত আমাদের ফেসবুক ও সোশ্যাল পেজে শেয়ার করে অন্য ভাইদের সিদ্ধান্ত নিতে সাহায্য করবে।`,
      `যেকোনো সার্ভিসিং বা টেকনিক্যাল প্রয়োজনে আমরা সার্বক্ষণিক পাশে আছি। ধন্যবাদ!`,
      `━━━━━━━━━━━━━━━━━━━━`,
    ];

    const message = lines.filter(Boolean).join('\n');
    onSendMessage(message);
    onOpenChange(false);
    toast.success('Review & unboxing incentive sent to chat!');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Gift className="size-5 text-pink-500" />
            Unboxing Review & Reward Incentive (রিভিউ অফার)
          </DialogTitle>
          <DialogDescription>
            Send post-delivery check-in to delivered customers offering a discount coupon in exchange for unboxing videos and social reviews.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-2">
          <div className="space-y-1.5">
            <Label>Next Order Discount Voucher Amount</Label>
            <div className="grid grid-cols-3 gap-2">
              {['100', '200', '300'].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setDiscountAmount(amt)}
                  className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                    discountAmount === amt
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card hover:bg-muted text-foreground'
                  }`}
                >
                  ৳{amt} Off
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg p-3 bg-pink-500/10 border border-pink-500/20 text-xs text-pink-400">
            <div className="font-semibold flex items-center gap-1.5">
              <Video className="size-3.5 shrink-0" />
              Social Proof & UGC
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Customers love sharing unboxing videos when promised a discount. These videos become your highest-converting Facebook ad assets!
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSendReviewRequest} className="gap-1.5 bg-pink-600 hover:bg-pink-700">
            <Send className="size-4" />
            Send Review Offer on WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
