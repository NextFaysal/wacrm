'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, Copy, Check, RefreshCw, Feather, Target, Flame, Gem, FileText, Send, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export function AiCopywriterStudio() {
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [productName, setProductName] = useState('');
  const [price, setPrice] = useState('');
  const [regularPrice, setRegularPrice] = useState('');
  const [specs, setSpecs] = useState('');
  const [tone, setTone] = useState<'persuasive' | 'urgent' | 'premium'>('persuasive');
  const [formatType, setFormatType] = useState<'landing' | 'facebook' | 'whatsapp'>('landing');
  const [generatedCopy, setGeneratedCopy] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/products')
      .then((res) => res.json())
      .then((data) => {
        if (data?.products && Array.isArray(data.products)) {
          setProducts(data.products);
        }
      })
      .catch(() => {});
  }, []);

  const handleSelectProduct = (productId: string) => {
    setSelectedProductId(productId);
    if (!productId) return;
    const prod = products.find((p) => p.id === productId);
    if (prod) {
      setProductName(prod.name || '');
      setPrice(prod.price ? String(prod.price) : '');
      setRegularPrice(prod.regular_price ? String(prod.regular_price) : '');
      setSpecs(
        [
          prod.description,
          prod.colors?.length ? `কালার/ভ্যারিয়েন্ট: ${prod.colors.join(', ')}` : '',
        ]
          .filter(Boolean)
          .join('\n')
      );
    }
  };

  const handleGenerate = async () => {
    if (!productName.trim()) {
      toast.error('প্রোডাক্টের নাম লিখুন অথবা তালিকা থেকে সিলেক্ট করুন');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/ai/copywriter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName,
          price: price ? Number(price) : undefined,
          regularPrice: regularPrice ? Number(regularPrice) : undefined,
          specs: `${specs}\nFormat: ${formatType}`,
          tone,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'কপি তৈরি করতে ব্যর্থ হয়েছে');
      }

      setGeneratedCopy(data.copy);
      toast.success('উচ্চ-কনভার্সন বাংলা সেলস কপি তৈরি হয়েছে!');
    } catch (err: any) {
      toast.error(err.message || 'কপিরাইটার রান করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!generatedCopy) return;
    navigator.clipboard.writeText(generatedCopy);
    setCopied(true);
    toast.success('কপি ক্লিপবোর্ডে কপি করা হয়েছে!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Input Column */}
      <div className="lg:col-span-5 space-y-4">
        <Card className="border shadow-none">
          <CardHeader className="p-4 sm:p-5 border-b">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Feather className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  AI Sales Copywriter (বাংলা কপিরাইটার স্টুডিও)
                </CardTitle>
                <CardDescription className="text-xs">
                  ফেসবুক বিজ্ঞাপন, ল্যান্ডিং পেজ ও হোয়াটসঅ্যাপ ব্রডকাস্টের জন্য কনভার্টিং বাংলা টেক্সট
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-5 space-y-4">
            {/* Product Quick Select */}
            {products.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">বিদ্যমান প্রোডাক্ট থেকে বেছে নিন</Label>
                <select
                  value={selectedProductId}
                  onChange={(e) => handleSelectProduct(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs sm:text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">-- যেকোনো একটি সিলেক্ট করুন (ঐচ্ছিক) --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.price ? `(৳${p.price})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Product Title */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">প্রোডাক্টের নাম *</Label>
              <Input
                placeholder="যেমন: Curren Chronograph Luxury Watch"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="h-9 text-xs sm:text-sm"
              />
            </div>

            {/* Price Inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">অফার মূল্য (৳)</Label>
                <Input
                  type="number"
                  placeholder="যেমন: 1450"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="h-9 text-xs sm:text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">আগের মূল্য (৳)</Label>
                <Input
                  type="number"
                  placeholder="যেমন: 2200"
                  value={regularPrice}
                  onChange={(e) => setRegularPrice(e.target.value)}
                  className="h-9 text-xs sm:text-sm"
                />
              </div>
            </div>

            {/* Specs / Features */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">প্রোডাক্টের বৈশিষ্ট্য / সুবিধা</Label>
              <Textarea
                rows={3}
                placeholder="যেমন: ১০০% ওয়াটারপ্রুফ, ১ বছরের কালার গ্যারান্টি, প্রিমিয়াম লেদার বেল্ট"
                value={specs}
                onChange={(e) => setSpecs(e.target.value)}
                className="text-xs sm:text-sm"
              />
            </div>

            {/* Tone Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">লেখার ধরন (Tone)</Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setTone('persuasive')}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all ${
                    tone === 'persuasive'
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-border text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  <Target className="h-4 w-4 mb-1" />
                  <span className="text-[11px]">Persuasive</span>
                  <span className="text-[9px] text-muted-foreground">আকর্ষণীয়</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTone('urgent')}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all ${
                    tone === 'urgent'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold'
                      : 'border-border text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  <Flame className="h-4 w-4 mb-1 text-amber-500" />
                  <span className="text-[11px]">Urgent</span>
                  <span className="text-[9px] text-muted-foreground">অফার ভিত্তিক</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTone('premium')}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all ${
                    tone === 'premium'
                      ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold'
                      : 'border-border text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  <Gem className="h-4 w-4 mb-1 text-purple-500" />
                  <span className="text-[11px]">Premium</span>
                  <span className="text-[9px] text-muted-foreground">অভিজাত</span>
                </button>
              </div>
            </div>

            {/* Target Output Format */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">কপি ব্যবহারের প্ল্যাটফর্ম</Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setFormatType('landing')}
                  className={`p-2 rounded-lg border text-center text-xs transition-all ${
                    formatType === 'landing'
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5 mx-auto mb-1" />
                  Landing Page
                </button>
                <button
                  type="button"
                  onClick={() => setFormatType('facebook')}
                  className={`p-2 rounded-lg border text-center text-xs transition-all ${
                    formatType === 'facebook'
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  <Share2 className="h-3.5 w-3.5 mx-auto mb-1" />
                  Facebook Ad
                </button>
                <button
                  type="button"
                  onClick={() => setFormatType('whatsapp')}
                  className={`p-2 rounded-lg border text-center text-xs transition-all ${
                    formatType === 'whatsapp'
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  <Send className="h-3.5 w-3.5 mx-auto mb-1" />
                  WhatsApp
                </button>
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={loading || !productName.trim()}
              className="w-full gap-2 mt-2"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {loading ? 'AI কপি তৈরি করছে...' : 'Generate Sales Copy'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Right Output Column */}
      <div className="lg:col-span-7">
        <Card className="border shadow-none h-full flex flex-col">
          <CardHeader className="p-4 sm:p-5 border-b flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                Generated Sales Copy (তৈরিকৃত সেলস কপি)
              </CardTitle>
              <CardDescription className="text-xs">
                এক ক্লিকে কপি করে আপনার ফেসবুক অ্যাড বা ল্যান্ডিং পেজে পেস্ট করুন
              </CardDescription>
            </div>
            {generatedCopy && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="gap-1.5 text-xs h-8"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied!' : 'Copy Text'}
              </Button>
            )}
          </CardHeader>

          <CardContent className="p-4 sm:p-5 flex-1 flex flex-col">
            {generatedCopy ? (
              <div className="flex-1 overflow-y-auto max-h-[550px] p-4 rounded-lg bg-muted/40 border font-sans text-xs sm:text-sm whitespace-pre-wrap leading-relaxed text-foreground select-text">
                {generatedCopy}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center border-2 border-dashed rounded-lg bg-muted/20">
                <div className="p-3 bg-primary/10 rounded-full text-primary mb-3">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-semibold text-foreground">
                  কোনো কপি তৈরি হয়নি এখনো
                </h4>
                <p className="text-xs text-muted-foreground max-w-sm mt-1">
                  বামের ফর্মে প্রোডাক্টের নাম ও অফার লিখে &quot;Generate Sales Copy&quot; বাটনে ক্লিক করলেই AI প্রফেশনাল বাংলা সেলস কপি তৈরি করে দিবে।
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
