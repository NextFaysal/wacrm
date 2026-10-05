'use client';

import React, { useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FlaskConical, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ExperimentCreatorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function ExperimentCreatorDialog({
  isOpen,
  onClose,
  onCreated,
}: ExperimentCreatorDialogProps) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [testType, setTestType] = useState('price');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !hypothesis.trim()) {
      toast.error('নাম এবং হাইপোথিসিস পূরণ করুন');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/marketing/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          hypothesis: hypothesis.trim(),
          testType,
          status: 'running',
          baselineMetrics: {
            visitors: 250,
            conversions: 8,
            revenue: 11600,
          },
          testMetrics: {
            visitors: 260,
            conversions: 14,
            revenue: 19800,
          },
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('গ্রোথ এক্সপেরিমেন্ট সফলভাবে তৈরি করা হয়েছে!');
        setName('');
        setHypothesis('');
        onCreated();
        onClose();
      } else {
        toast.error(data.error || 'এক্সপেরিমেন্ট তৈরি করতে সমস্যা হয়েছে');
      }
    } catch (err: any) {
      toast.error('সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-indigo-600" />
            <DialogTitle>নতুন A/B গ্রোথ টেস্ট চালু করুন</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            মূল্য, ফ্রি ডেলিভারি, ল্যান্ডিং পেজ বা হোয়াটসঅ্যাপ অফার টেস্ট করে সর্বোচ্চ কনভার্সন রেট নিশ্চিত করুন।
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">টেস্টের নাম (Experiment Name)</Label>
            <Input
              placeholder="e.g. Free Delivery vs ৳100 Discount on Checkouts"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">টেস্টের ধরন (Experiment Type)</Label>
            <Select value={testType} onValueChange={(val) => val && setTestType(val)}>
              <SelectTrigger>
                <SelectValue placeholder="সিলেক্ট করুন" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="price">মূল্য নির্ধারণ (Price Elasticity Test)</SelectItem>
                <SelectItem value="bundle_offer">বান্ডিল অফার (Buy 1 Get 1 vs Discount)</SelectItem>
                <SelectItem value="landing_page">ল্যান্ডিং পেজ (Single Page vs Storefront)</SelectItem>
                <SelectItem value="creative">অ্যাড ক্রিয়েটিভ (UGC Video vs Image Carousel)</SelectItem>
                <SelectItem value="cta">কল-টু-অ্যাকশন (WhatsApp Chat vs Direct Buy)</SelectItem>
                <SelectItem value="script">সেলস স্ক্রিপ্ট (AI Closing Objection Script)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">হাইপোথিসিস (Hypothesis & Expected Outcome)</Label>
            <Textarea
              rows={3}
              placeholder="e.g. ফ্রি ডেলিভারি অফার দিলে ড্রপ-অফ ৩০% কমবে এবং কনভার্সন রেট ৩.৫% থেকে ৪.৫% এ বৃদ্ধি পাবে..."
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
              required
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              বাতিল
            </Button>
            <Button type="submit" disabled={loading} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <Sparkles className="h-4 w-4" />
              টেস্ট শুরু করুন
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
