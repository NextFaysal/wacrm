'use client';

import { useState, useEffect } from 'react';
import { Package, Send, Search, Sparkles, Shield, Tag, Layers } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Product } from '@/types/watch';
import type { BusinessSettings } from '@/types/business';

interface WatchShowcaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSendMessage: (text: string) => void;
  conversationId?: string;
}

export function WatchShowcaseDialog({
  open,
  onOpenChange,
  onSendMessage,
  conversationId,
}: WatchShowcaseDialogProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [business, setBusiness] = useState<BusinessSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [sendingInteractive, setSendingInteractive] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string>('');

  useEffect(() => {
    if (open) {
      setLoading(true);
      Promise.all([
        fetch('/api/products').then((res) => res.json()),
        fetch('/api/settings/business').then((res) => res.json()).catch(() => ({})),
      ])
        .then(([prodData, bizData]) => {
          setProducts(prodData.products || []);
          if (bizData?.settings) {
            setBusiness(bizData.settings);
          }
          if (prodData.products?.length > 0) {
            setSelectedProduct(prodData.products[0]);
            setSelectedVariant(prodData.products[0].colors?.[0] || '');
          }
        })
        .catch(() => toast.error('Failed to load products catalog'))
        .finally(() => setLoading(false));
    }
  }, [open]);

  // Extract unique categories from catalog
  const categories: string[] = [
    'all',
    ...Array.from(new Set(products.map((p) => p.category).filter((c): c is string => Boolean(c)))),
  ];

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSelectProduct = (prod: Product) => {
    setSelectedProduct(prod);
    setSelectedVariant(prod.colors?.[0] || '');
  };

  const handleSendToCustomer = () => {
    if (!selectedProduct) return;

    const spec1Label = business?.spec_label_1 || 'মডেল / কোড';
    const spec2Label = business?.spec_label_2 || 'উপাদান / গ্রেড';
    const spec3Label = business?.spec_label_3 || 'সাইজ / ভ্যারিয়েন্ট';
    const spec4Label = business?.spec_label_4 || 'ওয়ারেন্টি / সার্ভিস';

    const lines = [
      `🛍️ *${selectedProduct.name}*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `💰 *অফার প্রাইজ:* ৳${selectedProduct.price.toLocaleString('en-BD')}${selectedProduct.regular_price ? ` _(রেগুলার: ৳${selectedProduct.regular_price.toLocaleString('en-BD')})_` : ''}`,
      selectedVariant ? `🎨 *ভ্যারিয়েন্ট/কালার:* ${selectedVariant}` : '',
      `\n🔍 *পণ্যের বিবরণ ও স্পেসিফিকেশন:*`,
      selectedProduct.dial_size ? `• ${spec1Label}: ${selectedProduct.dial_size}` : '',
      selectedProduct.movement ? `• ${spec2Label}: ${selectedProduct.movement}` : '',
      selectedProduct.water_resistance || selectedProduct.strap_type ? `• ${spec3Label}: ${selectedProduct.water_resistance || selectedProduct.strap_type}` : '',
      selectedProduct.warranty_months
        ? `• ${spec4Label}: ${selectedProduct.warranty_months} মাসের অফিশিয়াল ওয়ারেন্টি 🛡️`
        : `• ${spec4Label}: ১০০% কোয়ালিটি নিশ্চয়তা ও চেক করে রিসিভ সুবিধা ✨`,
      selectedProduct.colors?.length ? `• এভেইলেবল অপশন: ${selectedProduct.colors.join(', ')}` : '',
      selectedProduct.description ? `\n📝 ${selectedProduct.description}` : '',
      selectedProduct.image_url ? `\n🖼️ *প্রোডাক্ট ইমেজ:* ${selectedProduct.image_url}` : '',
      `━━━━━━━━━━━━━━━━━━━━`,
      `📦 *সারা দেশে হোম ডেলিভারি ও ক্যাশ অন ডেলিভারি (COD) সুবিধা!*`,
      `অর্ডার কনফার্ম করতে অনুগ্রহ করে আপনার নাম, মোবাইল নম্বর এবং সম্পূর্ণ ঠিকানা লিখে পাঠান। ধন্যবাদ!`,
    ];

    const message = lines.filter(Boolean).join('\n');
    onSendMessage(message);
    onOpenChange(false);
    toast.success('Product details sent to chat composer');
  };

  const handleSendInteractiveCard = async () => {
    if (!selectedProduct || !conversationId) {
      toast.error('No conversation or product selected');
      return;
    }
    setSendingInteractive(true);
    try {
      const res = await fetch('/api/meta/product-card/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          productId: selectedProduct.id,
        }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to send product card');
      toast.success('ইন্টারঅ্যাক্টিভ প্রোডাক্ট কার্ড কাস্টমারকে পাঠানো হয়েছে!');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error sending product card');
    } finally {
      setSendingInteractive(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Package className="size-5 text-primary" />
            Product Catalog & Showcase (পণ্য ক্যাটালগ ও বিবরণ)
          </DialogTitle>
          <DialogDescription>
            ক্যাটালগ থেকে যেকোনো পণ্য সিলেক্ট করে ১ ক্লিকেই কাস্টমারকে ফুল স্পেসিফিকেশন ও অফার প্রাইজ হোয়াটসঅ্যাপে পাঠান।
          </DialogDescription>
        </DialogHeader>

        {/* Search & Categories */}
        <div className="flex flex-col sm:flex-row gap-2 mt-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="পণ্য বা SKU দিয়ে খুঁজুন..."
              className="pl-8 text-xs h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
            {categories.slice(0, 7).map((cat) => (
              <Button
                key={cat}
                type="button"
                variant={selectedCategory === cat ? 'default' : 'outline'}
                size="sm"
                className="text-xs h-9 capitalize whitespace-nowrap"
                onClick={() => setSelectedCategory(cat)}
              >
                {cat === 'all' ? 'সব পণ্য' : cat}
              </Button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 overflow-hidden mt-3">
          {/* Left Product List */}
          <ScrollArea className="md:col-span-5 h-[360px] pr-2">
            <div className="space-y-2">
              {loading ? (
                <p className="text-xs text-muted-foreground p-4 text-center">Loading products...</p>
              ) : filteredProducts.length === 0 ? (
                <p className="text-xs text-muted-foreground p-4 text-center">কোনো পণ্য পাওয়া যায়নি</p>
              ) : (
                filteredProducts.map((prod) => {
                  const isSelected = selectedProduct?.id === prod.id;
                  return (
                    <div
                      key={prod.id}
                      onClick={() => handleSelectProduct(prod)}
                      className={`flex gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10 shadow-sm'
                          : 'border-border bg-card hover:bg-muted/40'
                      }`}
                    >
                      {prod.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={prod.image_url}
                          alt={prod.name}
                          className="w-14 h-14 object-cover rounded-md shrink-0 bg-muted"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-md bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
                          <Package className="size-6" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">
                          {prod.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs font-bold text-primary">
                            ৳{prod.price.toLocaleString('en-BD')}
                          </span>
                          {prod.regular_price && (
                            <span className="text-[10px] text-muted-foreground line-through">
                              ৳{prod.regular_price.toLocaleString('en-BD')}
                            </span>
                          )}
                        </div>
                        {prod.category && (
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                            {prod.category}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          {/* Right Selected Product Preview */}
          <div className="md:col-span-7 rounded-xl border border-border bg-muted/20 p-4 flex flex-col justify-between overflow-y-auto max-h-[360px]">
            {selectedProduct ? (
              <div className="space-y-3">
                <div className="flex gap-3">
                  {selectedProduct.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedProduct.image_url}
                      alt={selectedProduct.name}
                      className="w-20 h-20 object-cover rounded-lg border border-border shadow-sm shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center shrink-0 border border-border">
                      <Package className="size-8 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      {selectedProduct.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-base font-extrabold text-primary">
                        ৳{selectedProduct.price.toLocaleString('en-BD')}
                      </span>
                      {selectedProduct.regular_price && (
                        <span className="text-xs text-muted-foreground line-through">
                          ৳{selectedProduct.regular_price.toLocaleString('en-BD')}
                        </span>
                      )}
                      {selectedProduct.category && (
                        <Badge variant="secondary" className="text-[10px] uppercase">
                          {selectedProduct.category}
                        </Badge>
                      )}
                    </div>
                    {selectedProduct.sku && (
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        SKU: {selectedProduct.sku}
                      </p>
                    )}
                  </div>
                </div>

                {/* Dynamic Specs Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 p-1.5 rounded bg-background border border-border/60">
                    <Tag className="size-3.5 text-primary shrink-0" />
                    <span className="text-muted-foreground">{business?.spec_label_1 || 'মডেল'}:</span>
                    <span className="font-medium text-foreground truncate">{selectedProduct.dial_size || selectedProduct.sku || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-1.5 rounded bg-background border border-border/60">
                    <Sparkles className="size-3.5 text-amber-500 shrink-0" />
                    <span className="text-muted-foreground">{business?.spec_label_2 || 'উপাদান'}:</span>
                    <span className="font-medium text-foreground truncate">{selectedProduct.movement || 'স্ট্যান্ডার্ড'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-1.5 rounded bg-background border border-border/60">
                    <Layers className="size-3.5 text-blue-500 shrink-0" />
                    <span className="text-muted-foreground">{business?.spec_label_3 || 'সাইজ'}:</span>
                    <span className="font-medium text-foreground truncate">{selectedProduct.water_resistance || selectedProduct.strap_type || 'স্ট্যান্ডার্ড'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-1.5 rounded bg-background border border-border/60">
                    <Shield className="size-3.5 text-emerald-500 shrink-0" />
                    <span className="text-muted-foreground">{business?.spec_label_4 || 'ওয়ারেন্টি'}:</span>
                    <span className="font-medium text-foreground truncate">
                      {selectedProduct.warranty_months ? `${selectedProduct.warranty_months} Months` : 'কোয়ালিটি চেকড'}
                    </span>
                  </div>
                </div>

                {/* Color Variants */}
                {selectedProduct.colors && selectedProduct.colors.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground">
                      ভ্যারিয়েন্ট সিলেক্ট করুন:
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedProduct.colors.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setSelectedVariant(color)}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                            selectedVariant === color
                              ? 'bg-primary text-primary-foreground border-primary font-medium'
                              : 'bg-background hover:bg-muted text-foreground border-border'
                          }`}
                        >
                          {color}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center my-auto">
                যেকোনো পণ্য সিলেক্ট করুন
              </p>
            )}

            <div className="pt-3 border-t border-border mt-3 flex flex-col sm:flex-row gap-2">
              {conversationId && (
                <Button
                  onClick={handleSendInteractiveCard}
                  disabled={!selectedProduct || sendingInteractive}
                  className="flex-1 gap-2 font-medium bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  <Sparkles className="size-4" />
                  {sendingInteractive ? 'পাঠানো হচ্ছে...' : '⚡ ১-ক্লিক কার্ড পাঠান'}
                </Button>
              )}
              <Button
                onClick={handleSendToCustomer}
                disabled={!selectedProduct}
                variant="outline"
                className="flex-1 gap-2 font-medium"
              >
                <Send className="size-4" />
                চ্যাটে বিবরণ টেক্সট পাঠান
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
