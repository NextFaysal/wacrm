'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Star,
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle2,
  MessageSquare,
  ShieldCheck,
  Package,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { format } from 'date-fns';

export interface ReviewItem {
  id: string;
  product_id: string;
  customer_name: string;
  customer_city: string;
  rating: number;
  review_text: string;
  image_url: string | null;
  is_verified_purchase: boolean;
  is_active: boolean;
  created_at: string;
  product?: {
    id: string;
    name: string;
    sku: string;
    image_url?: string;
  };
}

export function ReviewManager() {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProductFilter, setSelectedProductFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formProductId, setFormProductId] = useState('');
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formCustomerCity, setFormCustomerCity] = useState('Dhaka');
  const [formRating, setFormRating] = useState(5);
  const [formReviewText, setFormReviewText] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formIsVerified, setFormIsVerified] = useState(true);

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/reviews');
      const data = await res.json();
      if (res.ok && data.reviews) {
        setReviews(data.reviews);
      }
    } catch {
      toast.error('Failed to load reviews');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (res.ok && data.products) {
        setProducts(data.products);
        if (data.products.length > 0 && !formProductId) {
          setFormProductId(data.products[0].id);
        }
      }
    } catch {
      // ignore
    }
  }, [formProductId]);

  useEffect(() => {
    fetchReviews();
    fetchProducts();
  }, [fetchReviews, fetchProducts]);

  const handleCreateReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProductId || !formCustomerName.trim() || !formReviewText.trim()) {
      toast.error('Please fill in product, customer name and review text');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: formProductId,
          customer_name: formCustomerName.trim(),
          customer_city: formCustomerCity.trim(),
          rating: Number(formRating),
          review_text: formReviewText.trim(),
          image_url: formImageUrl.trim() || null,
          is_verified_purchase: formIsVerified,
          is_active: true,
        }),
      });

      const data = await res.json();
      if (res.ok && data.review) {
        toast.success('Customer review added successfully!');
        setReviews((prev) => [data.review, ...prev]);
        setDialogOpen(false);
        // Reset form
        setFormCustomerName('');
        setFormReviewText('');
        setFormImageUrl('');
      } else {
        toast.error(data.error || 'Failed to add review');
      }
    } catch {
      toast.error('Network error creating review');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (id: string, currentState: boolean) => {
    try {
      const res = await fetch('/api/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !currentState }),
      });
      if (res.ok) {
        setReviews((prev) =>
          prev.map((r) => (r.id === id ? { ...r, is_active: !currentState } : r))
        );
        toast.success(`Review ${!currentState ? 'approved & published' : 'hidden'}`);
      } else {
        toast.error('Failed to update review status');
      }
    } catch {
      toast.error('Error updating review');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this review?')) return;
    try {
      const res = await fetch(`/api/reviews?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setReviews((prev) => prev.filter((r) => r.id !== id));
        toast.success('Review deleted');
      } else {
        toast.error('Failed to delete review');
      }
    } catch {
      toast.error('Error deleting review');
    }
  };

  const filteredReviews = reviews.filter((r) => {
    if (selectedProductFilter === 'all') return true;
    return r.product_id === selectedProductFilter;
  });

  return (
    <Card className="border border-border/70 shadow-none">
      <CardHeader className="p-4 sm:p-6 pb-3 flex flex-row items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold sm:text-lg flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
              Customer Reviews & Social Proof
            </CardTitle>
            <Badge variant="outline" className="border-amber-500/40 text-amber-500 text-[11px]">
              {reviews.filter((r) => r.is_active).length} Published
            </Badge>
          </div>
          <CardDescription className="text-xs text-muted-foreground mt-1">
            Manage customer feedback displayed on your product landing pages and online store.
          </CardDescription>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchReviews}
            disabled={loading}
            className="h-8 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setDialogOpen(true)}
            className="h-8 text-xs gap-1.5 font-medium"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Review
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 pt-2">
        {/* Product Filter Bar */}
        {products.length > 0 && (
          <div className="mb-4 flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Filter by Product:</Label>
            <select
              value={selectedProductFilter}
              onChange={(e) => setSelectedProductFilter(e.target.value)}
              className="rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs focus:ring-1 focus:ring-ring max-w-xs truncate"
            >
              <option value="all">All Products ({reviews.length})</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground text-xs gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-primary" />
            Loading reviews...
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="text-center py-10 border border-dashed rounded-lg bg-muted/20">
            <Star className="h-10 w-10 mx-auto text-muted-foreground/60 mb-2" />
            <h4 className="text-sm font-medium text-foreground">No customer reviews yet</h4>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Add genuine customer testimonials and photos to display social proof on your product landing pages.
            </p>
            <Button
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="mt-4 h-8 text-xs gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add First Review
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredReviews.map((r) => (
              <div
                key={r.id}
                className={`rounded-xl border p-4 transition-all ${
                  r.is_active
                    ? 'border-border/80 bg-card hover:border-amber-500/40'
                    : 'border-border/40 bg-muted/30 opacity-70'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">{r.customer_name}</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground/70" />
                        {r.customer_city}
                      </span>
                      {r.is_verified_purchase && (
                        <Badge
                          variant="secondary"
                          className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] gap-1 py-0"
                        >
                          <ShieldCheck className="h-3 w-3" /> Verified Buyer
                        </Badge>
                      )}
                    </div>

                    {/* Star Rating */}
                    <div className="flex items-center gap-0.5 mt-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`h-3.5 w-3.5 ${
                            s <= r.rating
                              ? 'text-amber-500 fill-amber-500'
                              : 'text-muted-foreground/30'
                          }`}
                        />
                      ))}
                      <span className="text-xs font-semibold text-muted-foreground ml-1.5">
                        {r.rating}.0
                      </span>
                    </div>

                    {/* Review text */}
                    <p className="text-xs text-foreground mt-2 leading-relaxed whitespace-pre-line">
                      "{r.review_text}"
                    </p>

                    {/* Product Tag */}
                    <div className="mt-2.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Package className="h-3.5 w-3.5 text-primary" />
                      <span>Product: <strong className="text-foreground">{r.product?.name || 'Assigned Product'}</strong></span>
                      <span>•</span>
                      <span>{r.created_at ? format(new Date(r.created_at), 'dd MMM yyyy') : ''}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:justify-between shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">
                        {r.is_active ? 'Published' : 'Hidden'}
                      </span>
                      <Switch
                        checked={r.is_active}
                        onCheckedChange={() => handleToggleActive(r.id, r.is_active)}
                      />
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(r.id)}
                      className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10 px-2"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Review Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                Add Customer Review
              </DialogTitle>
              <DialogDescription>
                Add verified customer feedback and ratings to feature on your product landing pages.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateReview} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Select Product *</Label>
                <select
                  value={formProductId}
                  onChange={(e) => setFormProductId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus:ring-1 focus:ring-ring"
                  required
                >
                  <option value="" disabled>
                    Choose a product...
                  </option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="custName" className="text-xs font-semibold">
                    Customer Name *
                  </Label>
                  <Input
                    id="custName"
                    placeholder="e.g. তানভীর হাসান"
                    value={formCustomerName}
                    onChange={(e) => setFormCustomerName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="custCity" className="text-xs font-semibold">
                    City / Area
                  </Label>
                  <Input
                    id="custCity"
                    placeholder="e.g. মিরপুর, ঢাকা"
                    value={formCustomerCity}
                    onChange={(e) => setFormCustomerCity(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Rating (1 to 5 Stars)</Label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setFormRating(star)}
                      className="p-1 focus:outline-hidden"
                    >
                      <Star
                        className={`h-6 w-6 transition-all ${
                          star <= formRating
                            ? 'text-amber-500 fill-amber-500 scale-110'
                            : 'text-muted-foreground/30 hover:text-amber-300'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-sm font-bold text-foreground ml-2">
                    {formRating} Star{formRating > 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reviewText" className="text-xs font-semibold">
                  Review Text / ফিডব্যাক *
                </Label>
                <Textarea
                  id="reviewText"
                  rows={3}
                  placeholder="e.g. প্রোডাক্টের কোয়ালিটি অনেক ভালো, ২ দিনের মধ্যে ডেলিভারি পেয়েছি। ধন্যবাদ!"
                  value={formReviewText}
                  onChange={(e) => setFormReviewText(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="imgUrl" className="text-xs font-semibold">
                  Customer Image / Unboxing Photo URL (Optional)
                </Label>
                <Input
                  id="imgUrl"
                  placeholder="https://..."
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label className="text-xs font-medium">Verified Purchase Badge</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Display green 'Verified Buyer' trust mark
                  </p>
                </div>
                <Switch
                  checked={formIsVerified}
                  onCheckedChange={setFormIsVerified}
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Add Review'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
