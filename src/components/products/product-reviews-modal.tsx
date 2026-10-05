'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Star, Plus, Trash2, CheckCircle2, MessageSquare, RefreshCw, X } from 'lucide-react';
import type { Product, ProductReview } from '@/types/watch';
import { toast } from 'sonner';

interface ProductReviewsModalProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductReviewsModal({
  product,
  open,
  onOpenChange,
}: ProductReviewsModalProps) {
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // New review form state
  const [customerName, setCustomerName] = useState('');
  const [customerCity, setCustomerCity] = useState('Dhaka');
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isVerified, setIsVerified] = useState(true);

  const fetchReviews = useCallback(async () => {
    if (!product) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/reviews?product_id=${product.id}`);
      const data = await res.json();
      if (res.ok && data.reviews) {
        setReviews(data.reviews);
      }
    } catch {
      toast.error('Failed to load reviews');
    } finally {
      setLoading(false);
    }
  }, [product]);

  useEffect(() => {
    if (open && product) {
      fetchReviews();
      setIsAdding(false);
    }
  }, [open, product, fetchReviews]);

  const handleCreateReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    if (!customerName.trim() || !reviewText.trim()) {
      toast.error('Customer name and review text are required');
      return;
    }

    try {
      setIsSaving(true);
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: product.id,
          customer_name: customerName.trim(),
          customer_city: customerCity.trim(),
          rating,
          review_text: reviewText.trim(),
          image_url: imageUrl.trim() || null,
          is_verified_purchase: isVerified,
          is_active: true,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('Customer review added successfully');
        setCustomerName('');
        setReviewText('');
        setImageUrl('');
        setIsAdding(false);
        fetchReviews();
      } else {
        toast.error(data.error || 'Failed to add review');
      }
    } catch {
      toast.error('Network error creating review');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteReview = async (id: string) => {
    try {
      const res = await fetch(`/api/reviews?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Review deleted');
        setReviews((prev) => prev.filter((r) => r.id !== id));
      } else {
        toast.error('Failed to delete review');
      }
    } catch {
      toast.error('Network error deleting review');
    }
  };

  if (!product) return null;

  const averageRating =
    reviews.length > 0
      ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
      : '5.0';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-xl max-h-[88vh] flex flex-col p-4 sm:p-6 rounded-2xl border shadow-2xl bg-card">
        <DialogHeader className="border-b pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 shrink-0">
                <Star className="h-5 w-5 fill-amber-500 text-amber-500" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base font-bold truncate">
                  কাস্টমার রিভিউ ও সোশ্যাল প্রুফ
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5 truncate">
                  {product.name} ({reviews.length} টি রিভিউ • ★ {averageRating})
                </DialogDescription>
              </div>
            </div>
            {!isAdding && (
              <Button
                size="sm"
                onClick={() => setIsAdding(true)}
                className="gap-1.5 h-8 text-xs self-start sm:self-auto font-semibold shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>রিভিউ যোগ করুন</span>
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4 my-2 flex-1 overflow-y-auto pr-1">
          {/* Add Review Form */}
          {isAdding && (
            <form onSubmit={handleCreateReview} className="p-3.5 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-primary" />
                  <span>New Customer Testimonial</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="text-muted-foreground hover:text-foreground p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="space-y-1">
                  <Label htmlFor="rev_name" className="text-[11px]">Customer Name *</Label>
                  <Input
                    id="rev_name"
                    placeholder="e.g. তানভীর আহমেদ"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="h-7 text-xs"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="rev_city" className="text-[11px]">City / Location</Label>
                  <Input
                    id="rev_city"
                    placeholder="e.g. ধানমন্ডি, ঢাকা"
                    value={customerCity}
                    onChange={(e) => setCustomerCity(e.target.value)}
                    className="h-7 text-xs"
                  />
                </div>
              </div>

              {/* Rating selection */}
              <div className="space-y-1">
                <Label className="text-[11px]">Rating (Stars)</Label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setRating(s)}
                      className="p-1 text-amber-500 hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`h-5 w-5 ${
                          s <= rating ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground/30'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs font-semibold ml-2 text-foreground">{rating} / 5 Stars</span>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="rev_text" className="text-[11px]">Review Message *</Label>
                <Textarea
                  id="rev_text"
                  placeholder="e.g. অসাধারণ প্রোডাক্ট! ডেলিভারি অনেক দ্রুত পেয়েছি, ধন্যবাদ।"
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  rows={2}
                  className="text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="rev_img" className="text-[11px]">Review Photo URL (Optional)</Label>
                <Input
                  id="rev_img"
                  placeholder="https://... (customer unboxing photo)"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="h-7 text-xs"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <Switch id="rev_verified" checked={isVerified} onCheckedChange={setIsVerified} />
                  <Label htmlFor="rev_verified" className="text-xs font-normal">Show Verified Buyer Badge</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setIsAdding(false)} className="h-7 text-xs">
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={isSaving} className="h-7 text-xs gap-1">
                    {isSaving ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    <span>Save Review</span>
                  </Button>
                </div>
              </div>
            </form>
          )}

          {/* Reviews List */}
          {loading ? (
            <div className="py-12 text-center text-muted-foreground text-xs">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary/60" />
              <span>Loading reviews...</span>
            </div>
          ) : reviews.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-xs text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="font-semibold text-foreground">No customer reviews yet</p>
              <p className="mt-1 text-[11px]">Add testimonials to boost conversions on your single product landing page.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {reviews.map((rev) => (
                <div key={rev.id} className="p-3 rounded-lg border bg-card text-xs space-y-1.5 hover:border-primary/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{rev.customer_name}</span>
                      <span className="text-[10px] text-muted-foreground">({rev.customer_city || 'Bangladesh'})</span>
                      {rev.is_verified_purchase && (
                        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 text-[9px] px-1 py-0 gap-0.5">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          <span>Verified</span>
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="flex text-amber-500">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3 w-3 ${
                              i < rev.rating ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground/20'
                            }`}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteReview(rev.id)}
                        className="text-muted-foreground hover:text-destructive p-1 rounded ml-1"
                        title="Delete review"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">{rev.review_text}</p>
                  {rev.image_url && (
                    <div className="mt-2 h-16 w-16 rounded-md overflow-hidden border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={rev.image_url} alt="Customer photo" className="h-full w-full object-cover" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
