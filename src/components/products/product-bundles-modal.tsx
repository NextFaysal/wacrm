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
import { Badge } from '@/components/ui/badge';
import { Layers, Plus, Trash2, Package, RefreshCw, X, Sparkles } from 'lucide-react';
import type { Product, ProductBundle, BundleItem } from '@/types/watch';
import { toast } from 'sonner';

interface ProductBundlesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
}

export function ProductBundlesModal({
  open,
  onOpenChange,
  products,
}: ProductBundlesModalProps) {
  const [bundles, setBundles] = useState<ProductBundle[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // New Bundle Form State
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [regularPrice, setRegularPrice] = useState('');
  const [badgeText, setBadgeText] = useState('COMBO DEAL');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [selectedItems, setSelectedItems] = useState<BundleItem[]>([]);

  const fetchBundles = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/products/bundles');
      const data = await res.json();
      if (res.ok && data.bundles) {
        setBundles(data.bundles);
      }
    } catch {
      toast.error('Failed to load product bundles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchBundles();
      setIsCreating(false);
    }
  }, [open, fetchBundles]);

  const handleAddItemToBundle = (productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    if (selectedItems.some((i) => i.product_id === productId)) {
      toast.error('Product already in bundle');
      return;
    }

    setSelectedItems((prev) => [
      ...prev,
      {
        product_id: prod.id,
        product_name: prod.name,
        quantity: 1,
        unit_price: prod.price,
      },
    ]);
  };

  const handleRemoveItemFromBundle = (productId: string) => {
    setSelectedItems((prev) => prev.filter((i) => i.product_id !== productId));
  };

  const handleCreateBundle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price.trim()) {
      toast.error('Bundle name and price are required');
      return;
    }

    if (selectedItems.length < 2) {
      toast.error('A combo bundle must include at least 2 items');
      return;
    }

    try {
      setIsSaving(true);
      const res = await fetch('/api/products/bundles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          price: parseFloat(price) || 0,
          regular_price: regularPrice.trim() ? parseFloat(regularPrice) : null,
          badge_text: badgeText.trim() || 'COMBO DEAL',
          description: description.trim() || null,
          image_url: imageUrl.trim() || (products.find((p) => p.id === selectedItems[0]?.product_id)?.image_url || null),
          items: selectedItems,
          is_active: true,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('Combo Deal / Bundle created successfully!');
        setName('');
        setPrice('');
        setRegularPrice('');
        setSelectedItems([]);
        setIsCreating(false);
        fetchBundles();
      } else {
        toast.error(data.error || 'Failed to create bundle');
      }
    } catch {
      toast.error('Network error creating bundle');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBundle = async (id: string) => {
    try {
      const res = await fetch(`/api/products/bundles?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Bundle deleted');
        setBundles((prev) => prev.filter((b) => b.id !== id));
      } else {
        toast.error('Failed to delete bundle');
      }
    } catch {
      toast.error('Network error deleting bundle');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[88vh] flex flex-col p-4 sm:p-6 rounded-2xl border shadow-2xl bg-card">
        <DialogHeader className="border-b pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">
                  প্রোডাক্ট বান্ডেল ও কম্বো অফার (AOV Booster)
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  একাধিক পণ্য মিলিয়ে প্যাকেজ বা কম্বো ডিল তৈরি করুন (যেমন: ঘড়ি + অতিরিক্ত বেল্ট)
                </DialogDescription>
              </div>
            </div>
            {!isCreating && (
              <Button
                size="sm"
                onClick={() => setIsCreating(true)}
                className="gap-1.5 h-8 text-xs self-start sm:self-auto font-semibold shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>নতুন বান্ডেল</span>
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4 my-2 flex-1 overflow-y-auto pr-1">
          {/* Create Bundle Form */}
          {isCreating && (
            <form onSubmit={handleCreateBundle} className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span>Configure Combo Pack</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="text-muted-foreground hover:text-foreground p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="b_name" className="text-[11px]">Bundle Name *</Label>
                  <Input
                    id="b_name"
                    placeholder="e.g. Luxury Duo: Royal Quartz Watch + Extra Genuine Leather Strap"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-8 text-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="b_price" className="text-[11px]">Combo Offer Price (৳ BDT) *</Label>
                  <Input
                    id="b_price"
                    type="number"
                    placeholder="2650"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="h-8 text-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="b_reg_price" className="text-[11px]">Regular Combined Price (৳ BDT)</Label>
                  <Input
                    id="b_reg_price"
                    type="number"
                    placeholder="3400 (for discount strikethrough)"
                    value={regularPrice}
                    onChange={(e) => setRegularPrice(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="b_badge" className="text-[11px]">Promo Badge</Label>
                  <Input
                    id="b_badge"
                    placeholder="e.g. SAVE ৳750, COMBO SPECIAL"
                    value={badgeText}
                    onChange={(e) => setBadgeText(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="b_img" className="text-[11px]">Bundle Image URL (Optional)</Label>
                  <Input
                    id="b_img"
                    placeholder="https://... (or defaults to 1st item image)"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {/* Items in Bundle */}
              <div className="space-y-2 pt-2 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Included Products ({selectedItems.length})</Label>
                  <span className="text-[11px] text-muted-foreground">Select from active catalog</span>
                </div>

                {/* Product Selector Dropdown */}
                <div className="flex items-center gap-2">
                  <select
                    className="flex-1 h-8 rounded-md border border-input bg-background px-3 py-1 text-xs"
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddItemToBundle(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>+ Choose product to add to bundle...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (৳{p.price})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selected Items List */}
                {selectedItems.length > 0 && (
                  <div className="space-y-1.5 mt-2">
                    {selectedItems.map((item) => (
                      <div key={item.product_id} className="p-2 rounded-lg border bg-background flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Package className="h-3.5 w-3.5 text-primary" />
                          <span className="font-semibold text-foreground">{item.product_name}</span>
                          <span className="text-[10px] text-muted-foreground">Qty: {item.quantity}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground font-mono">৳{item.unit_price}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItemFromBundle(item.product_id)}
                            className="text-destructive hover:bg-destructive/10 p-1 rounded"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="ghost" size="sm" onClick={() => setIsCreating(false)} className="h-8 text-xs">
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isSaving} className="h-8 text-xs gap-1.5">
                  {isSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  <span>Save Bundle</span>
                </Button>
              </div>
            </form>
          )}

          {/* Bundles List */}
          {loading ? (
            <div className="py-12 text-center text-muted-foreground text-xs">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary/60" />
              <span>Loading combo bundles...</span>
            </div>
          ) : bundles.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-xs text-muted-foreground">
              <Layers className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="font-semibold text-foreground">No combo bundles created yet</p>
              <p className="mt-1 text-[11px]">Bundle complementary items together to boost conversions and basket size.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {bundles.map((b) => (
                <div key={b.id} className="p-3.5 rounded-xl border bg-card text-xs space-y-2 hover:border-primary/40 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {b.badge_text && (
                        <Badge className="bg-amber-500 text-neutral-950 font-bold text-[9px] uppercase px-1.5 py-0 mb-1">
                          {b.badge_text}
                        </Badge>
                      )}
                      <h4 className="font-semibold text-foreground line-clamp-1">{b.name}</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteBundle(b.id)}
                      className="text-muted-foreground hover:text-destructive p-1 rounded"
                      title="Delete bundle"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-base font-bold text-foreground">৳{b.price.toLocaleString('en-BD')}</span>
                    {b.regular_price && b.regular_price > b.price && (
                      <span className="text-xs text-muted-foreground line-through">
                        ৳{b.regular_price.toLocaleString('en-BD')}
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-muted-foreground space-y-1 bg-muted/40 p-2 rounded-lg">
                    <span className="font-medium text-foreground">Included Items:</span>
                    <ul className="list-disc list-inside space-y-0.5 pl-0.5">
                      {b.items.map((item, idx) => (
                        <li key={idx} className="truncate">
                          {item.quantity}x {item.product_name || 'Product Item'}
                        </li>
                      ))}
                    </ul>
                  </div>
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
