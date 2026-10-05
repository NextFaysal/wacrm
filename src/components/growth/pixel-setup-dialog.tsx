'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Code2, Copy, Check, Radio, Sparkles, CheckCircle2, Globe, ShoppingBag, Layers, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface PixelSetupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  accountId?: string;
}

export function PixelSetupDialog({ isOpen, onClose, accountId }: PixelSetupDialogProps) {
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState<boolean | null>(null);

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://app.wacrm.com';
  const targetAccountId = accountId || 'default';

  const scriptTag = `<script 
  src="${siteUrl}/tracker.js" 
  data-account-id="${targetAccountId}" 
  async
></script>`;

  const shopifyCode = `<!-- WACRM Growth Intelligence First-Party Tracking Pixel -->
<script 
  src="${siteUrl}/tracker.js" 
  data-account-id="${targetAccountId}" 
  async
></script>
<!-- End WACRM Tracker -->`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('কোড কপি করা হয়েছে!');
    setTimeout(() => setCopied(false), 2000);
  };

  const testConnection = async () => {
    setTesting(true);
    setTestSuccess(null);
    try {
      const res = await fetch('/api/public/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: targetAccountId !== 'default' ? targetAccountId : undefined,
          visitorToken: `verify_${Date.now()}`,
          sessionToken: `verify_sess_${Date.now()}`,
          eventName: 'PageView',
          pageUrl: `${siteUrl}/verify-test`,
          channel: 'direct',
        }),
      });

      if (res.ok) {
        setTestSuccess(true);
        toast.success('লাইভ সিগন্যাল সফলভাবে রিসিভ হয়েছে!');
      } else {
        setTestSuccess(false);
        toast.error('সিগন্যাল ভেরিফাই করা যায়নি');
      }
    } catch (e) {
      setTestSuccess(false);
      toast.error('কানেকশন টেস্টে সমস্যা হয়েছে');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-indigo-600 animate-pulse" />
            <DialogTitle>First-Party ট্র্যাকিং পিক্সেল ইনস্টল করুন</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            আপনার Shopify, WooCommerce বা কাস্টম ওয়েবসাইটে এই লাইটওয়েট স্ক্রিপ্টটি যুক্ত করুন। এটি ৩৬৫-দিনের কুকিজের মাধ্যমে প্রতিটি ট্রাফিক সোর্স, অ্যাড ক্লিক (UTM, fbclid, gclid) এবং অর্ডার ট্র্যাক করবে।
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Quick Snippet Box */}
          <div className="p-3.5 bg-slate-900 text-slate-100 rounded-xl relative group font-mono text-xs overflow-x-auto border border-slate-800">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <Code2 className="h-3.5 w-3.5 text-indigo-400" />
                Universal JavaScript Tracker (2.8 KB)
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(scriptTag)}
                className="h-6 px-2 text-slate-300 hover:text-white hover:bg-slate-800 gap-1 text-[11px]"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Copied' : 'Copy Snippet'}
              </Button>
            </div>
            <pre className="text-emerald-400 leading-relaxed whitespace-pre-wrap">{scriptTag}</pre>
          </div>

          {/* Test Signal Box */}
          <div className="p-3.5 rounded-xl border bg-muted/30 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs font-semibold text-foreground">পিক্সেল ও CAPI সিগন্যাল ভেরিফিকেশন</p>
              <p className="text-[11px] text-muted-foreground">
                First-Party ব্রাউজার ইভেন্ট ও Meta Conversions API (CAPI) সার্ভার কানেকশন টেস্ট করুন।
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={testConnection}
                disabled={testing}
                className="gap-1.5 shrink-0 text-xs border-indigo-500/30 text-indigo-600 hover:bg-indigo-500/10"
              >
                {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {testing ? 'Testing...' : 'Test Browser Pixel'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const res = await fetch('/api/marketing/capi-test', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ eventName: 'Purchase', value: 1500 }),
                    });
                    const d = await res.json();
                    if (res.ok && d.success) {
                      toast.success(`Meta CAPI ইভেন্ট পাঠানো হয়েছে! (Code: ${d.testEventCode})`);
                    } else {
                      toast.error(d.error || 'Meta CAPI কনফিগারেশন চেক করুন');
                    }
                  } catch {
                    toast.error('CAPI সিগন্যাল পাঠাতে ব্যর্থ হয়েছে');
                  }
                }}
                className="gap-1.5 shrink-0 text-xs border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Test Meta CAPI
              </Button>
            </div>
          </div>

          {testSuccess === true && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>
                <strong>সিগন্যাল সক্রিয়!</strong> ট্র্যাকিং এপিআই সফলভাবে সংযুক্ত হয়েছে এবং ইভেন্ট প্রসেস করছে।
              </span>
            </div>
          )}

          {/* Installation Instructions by Platform */}
          <Tabs defaultValue="shopify" className="space-y-3">
            <TabsList className="grid grid-cols-4 w-full text-xs">
              <TabsTrigger value="shopify" className="gap-1 text-[11px]">
                <ShoppingBag className="h-3 w-3" /> Shopify
              </TabsTrigger>
              <TabsTrigger value="woocommerce" className="gap-1 text-[11px]">
                <Globe className="h-3 w-3" /> WordPress
              </TabsTrigger>
              <TabsTrigger value="gtm" className="gap-1 text-[11px]">
                <Layers className="h-3 w-3" /> GTM
              </TabsTrigger>
              <TabsTrigger value="custom" className="gap-1 text-[11px]">
                <Code2 className="h-3 w-3" /> Custom
              </TabsTrigger>
            </TabsList>

            <TabsContent value="shopify" className="space-y-2 text-xs text-muted-foreground p-3 border rounded-xl bg-card">
              <h5 className="font-semibold text-foreground">Shopify থিমে সেটআপ নির্দেশিকা:</h5>
              <ol className="list-decimal list-inside space-y-1 pl-1">
                <li>আপনার Shopify Admin $\to$ <strong>Online Store $\to$ Themes</strong> এ যান।</li>
                <li>আপনার কারেন্ট থিমের পাশের <strong>··· (Actions) $\to$ Edit code</strong> সিলেক্ট করুন।</li>
                <li>বাম পাশের ফাইল মেনু থেকে <strong>theme.liquid</strong> ফাইলটি ওপেন করুন।</li>
                <li><code>&lt;/head&gt;</code> ট্যাগের ঠিক উপরে উপরের ট্র্যাকার কোডটি পেস্ট করে <strong>Save</strong> করুন।</li>
              </ol>
            </TabsContent>

            <TabsContent value="woocommerce" className="space-y-2 text-xs text-muted-foreground p-3 border rounded-xl bg-card">
              <h5 className="font-semibold text-foreground">WooCommerce / WordPress নির্দেশিকা:</h5>
              <ol className="list-decimal list-inside space-y-1 pl-1">
                <li>WordPress ড্যাশবোর্ড $\to$ <strong>Plugins $\to$ Add New</strong> এ যান।</li>
                <li><strong>WPCode</strong> বা <strong>Insert Headers and Footers</strong> প্লাগইন ইনস্টল করুন।</li>
                <li><strong>Header</strong> সেকশনে ট্র্যাকার কোডটি পেস্ট করে <strong>Save Changes</strong> করুন।</li>
              </ol>
            </TabsContent>

            <TabsContent value="gtm" className="space-y-2 text-xs text-muted-foreground p-3 border rounded-xl bg-card">
              <h5 className="font-semibold text-foreground">Google Tag Manager (GTM) নির্দেশিকা:</h5>
              <ol className="list-decimal list-inside space-y-1 pl-1">
                <li>GTM Workspace এ গিয়ে <strong>Tags $\to$ New</strong> এ ক্লিক করুন।</li>
                <li>Tag Configuration এ <strong>Custom HTML</strong> সিলেক্ট করুন এবং কোড পেস্ট করুন।</li>
                <li>Triggering এ <strong>Initialization - All Pages</strong> বা <strong>All Pages</strong> সিলেক্ট করে <strong>Submit</strong> করুন।</li>
              </ol>
            </TabsContent>

            <TabsContent value="custom" className="space-y-2 text-xs text-muted-foreground p-3 border rounded-xl bg-card">
              <h5 className="font-semibold text-foreground">Custom React / Next.js / HTML নির্দেশিকা:</h5>
              <p>
                আপনার রুট HTML লেআউটে <code>&lt;head&gt;</code> এর মধ্যে <code>&lt;script src="..." async&gt;</code> হিসেবে অন্তর্ভুক্ত করুন।
              </p>
              <p className="text-[11px] text-indigo-600 font-mono">
                window._wacrm.track('AddToCart', &#123; productId: '123', price: 1500 &#125;)
              </p>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
