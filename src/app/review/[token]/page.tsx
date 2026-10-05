'use client';

import { useState, useEffect, use } from 'react';
import {
  Star,
  CheckCircle2,
  Gift,
  Copy,
  Upload,
  Camera,
  Heart,
  Loader2,
  ShieldCheck,
  Package,
} from 'lucide-react';
import { toast } from 'sonner';

export default function CustomerReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);

  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerCity, setCustomerCity] = useState('ঢাকা');
  const [imageUrl, setImageUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [rewardCoupon, setRewardCoupon] = useState('THANKYOU100');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewText.trim()) {
      toast.error('অনুগ্রহ করে রিভিউ মতামত লিখুন');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/public/reviews/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          rating,
          reviewText: reviewText.trim(),
          customerName: customerName.trim() || undefined,
          customerCity: customerCity.trim() || 'ঢাকা',
          imageUrl: imageUrl.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Review submission failed');

      setSubmitted(true);
      if (data.rewardCoupon) setRewardCoupon(data.rewardCoupon);
      toast.success('আপনার মূল্যবান রিভিউ সফলভাবে গ্রহণ করা হয়েছে!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error submitting review');
    } finally {
      setSubmitting(false);
    }
  };

  const copyCoupon = () => {
    navigator.clipboard.writeText(rewardCoupon);
    toast.success('ডিসকাউন্ট কোড কপি করা হয়েছে!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 py-8">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium mb-3">
            <Heart className="size-3.5 fill-amber-400" />
            কাস্টমার সন্তুষ্টি ও ফিডব্যাক
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">আপনার অভিজ্ঞতা কেমন ছিল?</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            পণ্যটি আপনার কেমন লেগেছে তা জানালে আমরা অত্যন্ত আনন্দিত হব।
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 backdrop-blur shadow-2xl p-6">
          {submitted ? (
            <div className="text-center space-y-5 animate-in zoom-in duration-300">
              <div className="mx-auto size-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="size-8" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">অনেক ধন্যবাদ! ❤️</h2>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  আপনার রিভিউটি সফলভাবে প্রকাশিত হয়েছে। রিভিউ দেওয়ার কৃতজ্ঞতাস্বরূপ আপনার জন্য রয়েছে একটি বিশেষ উপহার!
                </p>
              </div>

              {/* Reward Coupon Box */}
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-center space-y-2">
                <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block">
                  🎁 পরবর্তী অর্ডারে ৳১০০ ডিসকাউন্ট ভাউচার
                </span>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-lg font-mono font-extrabold text-white bg-slate-950 px-3 py-1.5 rounded-lg border border-amber-500/30">
                    {rewardCoupon}
                  </span>
                  <button
                    type="button"
                    onClick={copyCoupon}
                    className="p-2 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors"
                    title="কপি করুন"
                  >
                    <Copy className="size-4" />
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">
                  পরবর্তী কেনাকাটায় চেকআউটে এই কোডটি ব্যবহার করলেই ১০০ টাকা ছাড় পাবেন।
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Star Rating Selector */}
              <div className="text-center space-y-2">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                  রেটিং দিন
                </label>
                <div className="flex items-center justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(star)}
                      className="p-1 transition-transform hover:scale-125 focus:outline-none"
                    >
                      <Star
                        className={`size-8 transition-colors ${
                          (hoverRating || rating) >= star
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-700'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <span className="text-xs font-medium text-amber-400 block">
                  {rating === 5 && '🌟 অসাধারণ ও দারুণ কোয়ালিটি!'}
                  {rating === 4 && '👍 খুবই ভালো লেগেছে'}
                  {rating === 3 && '👌 ঠিকঠাক আছে'}
                  {rating === 2 && '👎 আশানুরূপ হয়নি'}
                  {rating === 1 && '⚠️ অত্যন্ত অসন্তুষ্ট'}
                </span>
              </div>

              {/* Text Review */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 block">
                  আপনার মতামত বা আনবক্সিং অভিজ্ঞতা *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="পণ্যটি হাতে পাওয়ার পর কেমন লাগল? ফিনিশিং, কোয়ালিটি ও ডেলিভারি নিয়ে আপনার মতামত লিখুন..."
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 leading-relaxed"
                />
              </div>

              {/* Image URL / Unboxing Photo */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                  <span>পণ্যের ছবি বা আনবক্সিং ফটো (ঐচ্ছিক)</span>
                  <span className="text-[10px] text-amber-400">ছবি দিলে স্পেশাল গিফট!</span>
                </label>
                <div className="relative">
                  <Camera className="absolute left-3 top-3 size-4 text-slate-500" />
                  <input
                    type="url"
                    placeholder="ছবির লিংক (যেমন: imgur বা ফেসবুক ফটো লিংক)"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Name & City */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-400 block">আপনার নাম</label>
                  <input
                    type="text"
                    placeholder="নাম"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-400 block">আপনার শহর / জেলা</label>
                  <input
                    type="text"
                    placeholder="ঢাকা"
                    value={customerCity}
                    onChange={(e) => setCustomerCity(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all disabled:opacity-70 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    সাবমিট হচ্ছে...
                  </>
                ) : (
                  <>
                    <Gift className="size-4" />
                    রিভিউ সাবমিট করুন ও ৳১০০ ভাউচার পান
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
