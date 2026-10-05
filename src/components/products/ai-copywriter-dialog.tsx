'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
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
import {
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  Send,
  Flame,
  ShoppingBag,
  FileText,
} from 'lucide-react';
import type { Product } from '@/types/watch';

interface AiCopywriterDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyToDescription?: (text: string) => void;
}

export function AiCopywriterDialog({
  product,
  open,
  onOpenChange,
  onApplyToDescription,
}: AiCopywriterDialogProps) {
  const [productName, setProductName] = useState(product?.name || '');
  const [category, setCategory] = useState(product?.category || 'general');
  const [price, setPrice] = useState(product?.price ? String(product.price) : '');
  const [regularPrice, setRegularPrice] = useState(
    product?.regular_price ? String(product.regular_price) : ''
  );
  const [specs, setSpecs] = useState(
    [
      product?.strap_type ? `ম্যাটেরিয়াল: ${product.strap_type}` : '',
      product?.colors?.length ? `কালার: ${product.colors.join(', ')}` : '',
      product?.dial_size ? `সাইজ: ${product.dial_size}` : '',
    ]
      .filter(Boolean)
      .join(', ')
  );
  const [tone, setTone] = useState<'persuasive' | 'urgent' | 'premium'>('persuasive');

  const [loading, setLoading] = useState(false);
  const [generatedCopy, setGeneratedCopy] = useState('');
  const [copied, setCopied] = useState(false);

  // Sync when product changes
  useEffect(() => {
    if (product) {
      setProductName(product.name);
      setCategory(product.category || 'general');
      setPrice(product.price ? String(product.price) : '');
      setRegularPrice(product.regular_price ? String(product.regular_price) : '');
      setSpecs(
        [
          product.strap_type ? `ম্যাটেরিয়াল: ${product.strap_type}` : '',
          product.colors?.length ? `কালার: ${product.colors.join(', ')}` : '',
          product.dial_size ? `সাইজ: ${product.dial_size}` : '',
        ]
          .filter(Boolean)
          .join(', ')
      );
    }
  }, [product]);

  const handleGenerate = async () => {
    if (!productName.trim()) {
      toast.error('Product name is required');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/ai/copywriter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: productName.trim(),
          category,
          price: Number(price) || undefined,
          regularPrice: Number(regularPrice) || undefined,
          specs,
          tone,
        }),
      });

      const data = await res.json();
      if (res.ok && data.copy) {
        setGeneratedCopy(data.copy);
        toast.success('High-converting sales copy generated!');
      } else {
        toast.error(data.error || 'Failed to generate copy');
      }
    } catch {
      toast.error('Network error generating sales copy');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!generatedCopy) return;
    navigator.clipboard.writeText(generatedCopy);
    setCopied(true);
    toast.success('Copied full sales pitch to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[88vh] overflow-y-auto p-4 sm:p-6 rounded-2xl border shadow-2xl">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold">
                AI Sales Copy & Landing Page Copywriter
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                ফেসবুক অ্যাড, হোয়াটসঅ্যাপ ক্যাম্পেইন ও ল্যান্ডিং পেজের জন্য আকর্ষণীয় বাংলা সেলস কপি তৈরি করুন
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-muted/40 p-3 rounded-lg border">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-semibold">Product Name *</Label>
              <Input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g. Naviforce NF9153 Luxury Dual Display Watch"
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Offer Price (৳)</Label>
              <Input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. 1850"
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Regular / Old Price (৳)</Label>
              <Input
                type="number"
                value={regularPrice}
                onChange={(e) => setRegularPrice(e.target.value)}
                placeholder="e.g. 2400"
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-semibold">Writing Tone</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'persuasive', label: '🔥 আকর্ষক ও অফার', sub: 'High conversion' },
                  { id: 'urgent', label: '⚡ লিমিটেড স্টক', sub: 'Urgency & FOMO' },
                  { id: 'premium', label: '💎 লাক্সারি ও প্রিমিয়াম', sub: 'Classy & Trust' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTone(t.id as any)}
                    className={`p-2 rounded-lg border text-left text-xs transition-all ${
                      tone === t.id
                        ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                        : 'border-border bg-card text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <div>{t.label}</div>
                    <div className="text-[10px] opacity-75 font-normal">{t.sub}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleGenerate}
              disabled={loading}
              className="gap-2 font-semibold text-xs h-9"
            >
              <Sparkles className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'AI তৈরি করছে...' : 'Generate Bengali Copy'}
            </Button>
          </div>

          {/* Result Output */}
          {generatedCopy && (
            <div className="space-y-2 border rounded-xl p-4 bg-muted/20 animate-in fade-in-50">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Flame className="h-4 w-4 text-amber-500" />
                  Generated Sales Pitch
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    className="h-7 text-xs gap-1 border-primary/40 text-primary"
                  >
                    {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    {copied ? 'Copied!' : 'Copy Copy'}
                  </Button>
                  {onApplyToDescription && (
                    <Button
                      size="sm"
                      onClick={() => {
                        onApplyToDescription(generatedCopy);
                        toast.success('Inserted into product description!');
                        onOpenChange(false);
                      }}
                      className="h-7 text-xs gap-1"
                    >
                      <FileText className="h-3 w-3" />
                      Use in Description
                    </Button>
                  )}
                </div>
              </div>

              <div className="whitespace-pre-line text-xs sm:text-sm text-foreground font-sans leading-relaxed pt-2">
                {generatedCopy}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
