'use client';

import { useState, useEffect } from 'react';
import { Watch, Send, Search, Check, Sparkles, Shield, Droplets, Compass } from 'lucide-react';
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

interface WatchShowcaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSendMessage: (text: string) => void;
}

export function WatchShowcaseDialog({
  open,
  onOpenChange,
  onSendMessage,
}: WatchShowcaseDialogProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedWatch, setSelectedWatch] = useState<Product | null>(null);
  const [selectedColor, setSelectedColor] = useState<string>('');

  useEffect(() => {
    if (open) {
      setLoading(true);
      fetch('/api/products')
        .then((res) => res.json())
        .then((data) => {
          setProducts(data.products || []);
          if (data.products?.length > 0) {
            setSelectedWatch(data.products[0]);
            setSelectedColor(data.products[0].colors?.[0] || '');
          }
        })
        .catch(() => toast.error('Failed to load watches catalog'))
        .finally(() => setLoading(false));
    }
  }, [open]);

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSelectWatch = (watch: Product) => {
    setSelectedWatch(watch);
    setSelectedColor(watch.colors?.[0] || '');
  };

  const handleSendToCustomer = () => {
    if (!selectedWatch) return;

    const lines = [
      `⌚ *${selectedWatch.name}*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `💰 *অফার প্রাইজ:* ৳${selectedWatch.price.toLocaleString()}${selectedWatch.regular_price ? ` _(রেগুলার: ৳${selectedWatch.regular_price.toLocaleString()})_` : ''}`,
      selectedColor ? `🎨 *কালার ভ্যারিয়েন্ট:* ${selectedColor}` : '',
      `\n🔍 *ঘড়ির স্পেসিফিকেশন:*`,
      selectedWatch.dial_size ? `• ডায়াল সাইজ: ${selectedWatch.dial_size}` : '',
      selectedWatch.movement ? `• মুভমেন্ট: ${selectedWatch.movement}` : '',
      selectedWatch.water_resistance ? `• ওয়াটার রেজিস্ট্যান্স: ${selectedWatch.water_resistance}` : '',
      selectedWatch.strap_type ? `• স্ট্র্যাপ টাইপ: ${selectedWatch.strap_type}` : '',
      selectedWatch.colors?.length ? `• এভেইলেবল কালার: ${selectedWatch.colors.join(', ')}` : '',
      `• ওয়ারেন্টি: ${selectedWatch.warranty_months} মাসের অফিসিয়াল মেশিন ওয়ারেন্টি 🛡️`,
      selectedWatch.description ? `\n📝 ${selectedWatch.description}` : '',
      selectedWatch.image_url ? `\n🖼️ *প্রোডাক্ট ইমেজ:* ${selectedWatch.image_url}` : '',
      `━━━━━━━━━━━━━━━━━━━━`,
      `📦 *সারা বাংলাদেশে হোম ডেলিভারি ও ক্যাশ অন ডেলিভারি (COD) সুবিধা!*`,
      `অর্ডার কনফার্ম করতে অনুগ্রহ করে আপনার নাম, মোবাইল নম্বর এবং সম্পূর্ণ ঠিকানা লিখে পাঠান। ধন্যবাদ!`,
    ];

    const message = lines.filter(Boolean).join('\n');
    onSendMessage(message);
    onOpenChange(false);
    toast.success('Watch details sent to chat composer');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Watch className="size-5 text-primary" />
            Watch Product Catalog & Showcase (ঘড়ি ক্যাটালগ ও স্পেক্স)
          </DialogTitle>
          <DialogDescription>
            Select a watch from your collection and send complete specifications, pricing, and warranty to customer in one click.
          </DialogDescription>
        </DialogHeader>

        {/* Search & Categories */}
        <div className="flex flex-col sm:flex-row gap-2 mt-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search watch by name or SKU..."
              className="pl-8 text-xs h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
            {['all', 'quartz', 'chronograph', 'automatic', 'chain', 'smartwatch'].map((cat) => (
              <Button
                key={cat}
                type="button"
                variant={selectedCategory === cat ? 'default' : 'outline'}
                size="sm"
                className="text-xs h-9 capitalize whitespace-nowrap"
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 overflow-hidden mt-3">
          {/* Left Watch List */}
          <ScrollArea className="md:col-span-5 h-[360px] pr-2">
            <div className="space-y-2">
              {loading ? (
                <p className="text-xs text-muted-foreground p-4 text-center">Loading watches...</p>
              ) : filteredProducts.length === 0 ? (
                <p className="text-xs text-muted-foreground p-4 text-center">No watches found</p>
              ) : (
                filteredProducts.map((watch) => {
                  const isSelected = selectedWatch?.id === watch.id;
                  return (
                    <div
                      key={watch.id}
                      onClick={() => handleSelectWatch(watch)}
                      className={`flex gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10 shadow-sm'
                          : 'border-border bg-card hover:bg-muted/40'
                      }`}
                    >
                      <img
                        src={watch.image_url || 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=150&q=80'}
                        alt={watch.name}
                        className="w-14 h-14 object-cover rounded-md shrink-0 bg-muted"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">
                          {watch.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs font-bold text-primary">
                            ৳{watch.price.toLocaleString()}
                          </span>
                          {watch.regular_price && (
                            <span className="text-[10px] text-muted-foreground line-through">
                              ৳{watch.regular_price.toLocaleString()}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                          {watch.dial_size} • {watch.movement}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          {/* Right Selected Watch Preview */}
          <div className="md:col-span-7 rounded-xl border border-border bg-muted/20 p-4 flex flex-col justify-between overflow-y-auto max-h-[360px]">
            {selectedWatch ? (
              <div className="space-y-3">
                <div className="flex gap-3">
                  <img
                    src={selectedWatch.image_url || 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=300&q=80'}
                    alt={selectedWatch.name}
                    className="w-20 h-20 object-cover rounded-lg border border-border shadow-sm shrink-0"
                  />
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      {selectedWatch.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-base font-extrabold text-primary">
                        ৳{selectedWatch.price.toLocaleString()}
                      </span>
                      {selectedWatch.regular_price && (
                        <span className="text-xs text-muted-foreground line-through">
                          ৳{selectedWatch.regular_price.toLocaleString()}
                        </span>
                      )}
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        {selectedWatch.category}
                      </Badge>
                    </div>
                    {selectedWatch.sku && (
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        SKU: {selectedWatch.sku}
                      </p>
                    )}
                  </div>
                </div>

                {/* Specs Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 p-1.5 rounded bg-background border border-border/60">
                    <Compass className="size-3.5 text-primary shrink-0" />
                    <span className="text-muted-foreground">Dial:</span>
                    <span className="font-medium text-foreground truncate">{selectedWatch.dial_size}</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-1.5 rounded bg-background border border-border/60">
                    <Droplets className="size-3.5 text-blue-500 shrink-0" />
                    <span className="text-muted-foreground">Water:</span>
                    <span className="font-medium text-foreground truncate">{selectedWatch.water_resistance}</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-1.5 rounded bg-background border border-border/60">
                    <Sparkles className="size-3.5 text-amber-500 shrink-0" />
                    <span className="text-muted-foreground">Movement:</span>
                    <span className="font-medium text-foreground truncate">{selectedWatch.movement}</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-1.5 rounded bg-background border border-border/60">
                    <Shield className="size-3.5 text-emerald-500 shrink-0" />
                    <span className="text-muted-foreground">Warranty:</span>
                    <span className="font-medium text-foreground truncate">{selectedWatch.warranty_months} Months</span>
                  </div>
                </div>

                {/* Color Variants */}
                {selectedWatch.colors && selectedWatch.colors.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground">
                      Select Color Variant to Send:
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedWatch.colors.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setSelectedColor(color)}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                            selectedColor === color
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
                Select a watch to preview specifications
              </p>
            )}

            <div className="pt-3 border-t border-border mt-3">
              <Button
                onClick={handleSendToCustomer}
                disabled={!selectedWatch}
                className="w-full gap-2 font-medium"
              >
                <Send className="size-4" />
                Send Watch Details to Customer on WhatsApp
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
