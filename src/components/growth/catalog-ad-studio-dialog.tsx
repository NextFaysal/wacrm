'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, Copy, Check, RefreshCw, Layers, Zap, Video, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

interface AdCopyVariant {
  angle: 'PAS' | 'FOMO' | 'LIFESTYLE' | 'OFFER_FOCUSED';
  angleLabel: string;
  headline: string;
  primaryTextBn: string;
  primaryTextEn: string;
  recommendedCTA: string;
  suggestedCreativeFormat: string;
  suggestedHashtags: string[];
}

interface CatalogAdStudioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: {
    id?: string;
    name: string;
    price?: number | null;
    regular_price?: number | null;
    category?: string | null;
  } | null;
}

export function CatalogAdStudioDialog({
  open,
  onOpenChange,
  product,
}: CatalogAdStudioDialogProps) {
  const [platform, setPlatform] = useState<'meta' | 'tiktok' | 'google'>('meta');
  const [loading, setLoading] = useState(false);
  const [variants, setVariants] = useState<AdCopyVariant[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const generateAdCopies = async () => {
    if (!product?.name) return;
    try {
      setLoading(true);
      const res = await fetch('/api/marketing/catalog-ad-studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          productName: product.name,
          category: product.category,
          price: product.price,
          regularPrice: product.regular_price,
          platform,
        }),
      });

      const data = await res.json();
      if (res.ok && data.variants) {
        setVariants(data.variants);
        toast.success('৩টি ভিন্ন অ্যাঙ্গেলের হাই-কনভার্টিং অ্যাড কপি জেনারেট হয়েছে!');
      } else {
        toast.error(data.error || 'Failed to generate ad copy');
      }
    } catch {
      toast.error('Network error during AI generation');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    toast.success('অ্যাড কপি ক্লিপবোর্ডে কপি করা হয়েছে!');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] sm:max-w-3xl max-h-[90vh] flex flex-col p-0 rounded-2xl overflow-hidden border shadow-2xl bg-background">
        <DialogHeader className="p-4 sm:p-5 border-b bg-muted/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 space-y-0 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0 ring-1 ring-violet-500/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                AI Dynamic Catalog Ad Copy Studio
                <Badge variant="outline" className="text-xs border-violet-500/30 text-violet-600 dark:text-violet-400">
                  PAS • FOMO • Lifestyle
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {product?.name ? `"${product.name}"-এর জন্য প্ল্যাটফর্ম-অপটিমাইজড অ্যাড কপি তৈরি করুন` : 'ক্যাটালগ প্রোডাক্ট নির্বাচন করুন'}
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Tabs value={platform} onValueChange={(v: any) => setPlatform(v)}>
              <TabsList className="h-8">
                <TabsTrigger value="meta" className="text-xs px-2.5">Meta Ads</TabsTrigger>
                <TabsTrigger value="tiktok" className="text-xs px-2.5">TikTok</TabsTrigger>
                <TabsTrigger value="google" className="text-xs px-2.5">Google Ads</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              size="sm"
              onClick={generateAdCopies}
              disabled={loading || !product?.name}
              className="h-8 gap-1.5 text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              {variants.length > 0 ? 'Re-Generate' : 'Generate'}
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {variants.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-muted mx-auto flex items-center justify-center text-muted-foreground">
                <Layers className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-foreground">কোনো অ্যাড কপি এখনও জেনারেট করা হয়নি</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                উপরে ডানপাশে <strong>&quot;Generate&quot;</strong> বাটনে ক্লিক করে Meta, TikTok বা Google-এর জন্য ৩টি ভিন্ন সাইকোলজিক্যাল অ্যাঙ্গেলে কপি তৈরি করুন।
              </p>
              <Button
                size="sm"
                onClick={generateAdCopies}
                disabled={loading || !product?.name}
                className="mt-2 text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700"
              >
                <Zap className="h-3.5 w-3.5 mr-1" /> শুরু করুন
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {variants.map((v, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-border/80 bg-card p-4 space-y-3 shadow-xs hover:border-violet-500/40 transition-all"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20 text-xs">
                        Angle {idx + 1}: {v.angle}
                      </Badge>
                      <span className="text-xs font-semibold text-muted-foreground">
                        {v.angleLabel}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md">
                        {v.suggestedCreativeFormat.includes('Video') ? <Video className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                        {v.suggestedCreativeFormat}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(`${v.headline}\n\n${v.primaryTextBn}\n\nCTA: ${v.recommendedCTA}\n\n${(v.suggestedHashtags || []).join(' ')}`, idx)}
                        className="h-7 px-2 text-xs gap-1 text-violet-600 hover:text-violet-700"
                      >
                        {copiedIndex === idx ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedIndex === idx ? 'Copied' : 'Copy Full Ad'}
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-lg bg-muted/30 p-3 border border-border/40 space-y-2">
                    <p className="text-sm font-bold text-foreground">
                      {v.headline}
                    </p>
                    <p className="text-xs text-foreground/90 whitespace-pre-line leading-relaxed">
                      {v.primaryTextBn}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
                    <div>
                      <strong>CTA Button:</strong> <span className="text-primary font-semibold">{v.recommendedCTA}</span>
                    </div>
                    {v.suggestedHashtags && v.suggestedHashtags.length > 0 && (
                      <div className="text-[11px] text-muted-foreground truncate max-w-[280px]">
                        {v.suggestedHashtags.join(' ')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
