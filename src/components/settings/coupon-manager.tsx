'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Tag,
  Plus,
  Percent,
  CircleDollarSign,
  Calendar,
  Copy,
  Trash2,
  RefreshCw,
  CheckCircle2,
  Clock,
  Sparkles,
  Ticket,
} from 'lucide-react';
import { format } from 'date-fns';

export interface CouponItem {
  id: string;
  code: string;
  discount_type: 'fixed' | 'percentage';
  discount_value: number;
  min_order_amount: number;
  max_discount: number | null;
  usage_limit: number;
  used_count: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

export function CouponManager() {
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [discountValue, setDiscountValue] = useState('100');
  const [minOrderAmount, setMinOrderAmount] = useState('0');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [usageLimit, setUsageLimit] = useState('500');
  const [expiresAt, setExpiresAt] = useState('');

  const fetchCoupons = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/coupons');
      const data = await res.json();
      if (res.ok && data.coupons) {
        setCoupons(data.coupons);
      }
    } catch {
      toast.error('Failed to load coupons');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      toast.error('Coupon code is required');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          discount_type: discountType,
          discount_value: Number(discountValue) || 0,
          min_order_amount: Number(minOrderAmount) || 0,
          max_discount: maxDiscount ? Number(maxDiscount) : null,
          usage_limit: Number(usageLimit) || 500,
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
          is_active: true,
        }),
      });

      const data = await res.json();
      if (res.ok && data.coupon) {
        toast.success(`Coupon '${data.coupon.code}' created successfully!`);
        setCoupons((prev) => [data.coupon, ...prev]);
        setDialogOpen(false);
        // reset form
        setCode('');
        setDiscountValue('100');
        setMinOrderAmount('0');
        setMaxDiscount('');
      } else {
        toast.error(data.error || 'Failed to create coupon');
      }
    } catch {
      toast.error('Network error creating coupon');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (id: string, currentState: boolean) => {
    try {
      const res = await fetch('/api/coupons', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !currentState }),
      });
      if (res.ok) {
        setCoupons((prev) =>
          prev.map((c) => (c.id === id ? { ...c, is_active: !currentState } : c))
        );
        toast.success(`Coupon ${!currentState ? 'activated' : 'deactivated'}`);
      } else {
        toast.error('Failed to update coupon');
      }
    } catch {
      toast.error('Error updating coupon');
    }
  };

  const handleDelete = async (id: string, codeName: string) => {
    if (!confirm(`Are you sure you want to delete coupon '${codeName}'?`)) return;
    try {
      const res = await fetch(`/api/coupons?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setCoupons((prev) => prev.filter((c) => c.id !== id));
        toast.success(`Coupon '${codeName}' deleted`);
      } else {
        toast.error('Failed to delete coupon');
      }
    } catch {
      toast.error('Error deleting coupon');
    }
  };

  const copyCode = (codeText: string) => {
    navigator.clipboard.writeText(codeText);
    toast.success(`Copied '${codeText}' to clipboard!`);
  };

  return (
    <Card className="border border-border/70 shadow-none">
      <CardHeader className="p-4 sm:p-6 pb-3 flex flex-row items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold sm:text-lg flex items-center gap-2">
              <Ticket className="h-5 w-5 text-primary" />
              Coupons & Promo Codes
            </CardTitle>
            <Badge variant="outline" className="border-primary/40 text-primary text-[11px]">
              {coupons.length} Active
            </Badge>
          </div>
          <CardDescription className="text-xs text-muted-foreground mt-1">
            Create discount vouchers that customers can apply at checkout or through WhatsApp.
          </CardDescription>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCoupons}
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
            Add Coupon
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 pt-2">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground text-xs gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-primary" />
            Loading coupons...
          </div>
        ) : coupons.length === 0 ? (
          <div className="text-center py-10 border border-dashed rounded-lg bg-muted/20">
            <Ticket className="h-10 w-10 mx-auto text-muted-foreground/60 mb-2" />
            <h4 className="text-sm font-medium text-foreground">No coupons found</h4>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Create your first promotional discount coupon to boost landing page and WhatsApp conversions.
            </p>
            <Button
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="mt-4 h-8 text-xs gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Coupon
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {coupons.map((c) => (
              <div
                key={c.id}
                className={`relative rounded-xl border p-4 transition-all ${
                  c.is_active
                    ? 'border-border/80 bg-card hover:border-primary/50'
                    : 'border-border/40 bg-muted/30 opacity-70'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyCode(c.code)}
                      className="font-mono text-base font-black tracking-wider text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                      title="Click to copy code"
                    >
                      {c.code}
                      <Copy className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                  <Switch
                    checked={c.is_active}
                    onCheckedChange={() => handleToggleActive(c.id, c.is_active)}
                  />
                </div>

                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-primary">
                    {c.discount_type === 'fixed'
                      ? `৳${c.discount_value}`
                      : `${c.discount_value}% OFF`}
                  </span>
                  {c.discount_type === 'percentage' && c.max_discount && (
                    <span className="text-[11px] text-muted-foreground">
                      (Up to ৳{c.max_discount})
                    </span>
                  )}
                </div>

                <div className="mt-3 space-y-1 text-xs text-muted-foreground border-t pt-2.5">
                  {c.min_order_amount > 0 && (
                    <p className="flex justify-between">
                      <span>Min Order:</span>
                      <span className="font-medium text-foreground">৳{c.min_order_amount}</span>
                    </p>
                  )}
                  <p className="flex justify-between">
                    <span>Usage:</span>
                    <span className="font-medium text-foreground">
                      {c.used_count} / {c.usage_limit || '∞'} used
                    </span>
                  </p>
                  {c.expires_at && (
                    <p className="flex justify-between">
                      <span>Expires:</span>
                      <span className="font-medium text-foreground">
                        {format(new Date(c.expires_at), 'dd MMM yyyy')}
                      </span>
                    </p>
                  )}
                </div>

                <div className="mt-3 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(c.id, c.code)}
                    className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10 px-2"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Coupon Modal */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Ticket className="h-5 w-5 text-primary" />
                Create New Coupon
              </DialogTitle>
              <DialogDescription>
                Define code, discount rules, and optional validity period.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateCoupon} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="code" className="text-xs font-semibold">
                  Coupon Code *
                </Label>
                <Input
                  id="code"
                  placeholder="e.g. EID2026, SAVE100, FIRSTBUY"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="font-mono uppercase font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Discount Type</Label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus:ring-1 focus:ring-ring"
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as any)}
                  >
                    <option value="fixed">Fixed BDT (৳)</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="discountValue" className="text-xs font-semibold">
                    {discountType === 'fixed' ? 'Discount Amount (৳)' : 'Discount Percent (%)'} *
                  </Label>
                  <Input
                    id="discountValue"
                    type="number"
                    min="1"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="minOrderAmount" className="text-xs font-semibold">
                    Min Order Amount (৳)
                  </Label>
                  <Input
                    id="minOrderAmount"
                    type="number"
                    placeholder="0 = No minimum"
                    value={minOrderAmount}
                    onChange={(e) => setMinOrderAmount(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="usageLimit" className="text-xs font-semibold">
                    Usage Limit
                  </Label>
                  <Input
                    id="usageLimit"
                    type="number"
                    value={usageLimit}
                    onChange={(e) => setUsageLimit(e.target.value)}
                  />
                </div>
              </div>

              {discountType === 'percentage' && (
                <div className="space-y-1.5">
                  <Label htmlFor="maxDiscount" className="text-xs font-semibold">
                    Max Discount Cap in ৳ (Optional)
                  </Label>
                  <Input
                    id="maxDiscount"
                    type="number"
                    placeholder="e.g. 500"
                    value={maxDiscount}
                    onChange={(e) => setMaxDiscount(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="expiresAt" className="text-xs font-semibold">
                  Expiry Date (Optional)
                </Label>
                <Input
                  id="expiresAt"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
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
                  {submitting ? 'Creating...' : 'Create Coupon'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
