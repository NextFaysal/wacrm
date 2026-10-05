'use client';

import { useState } from 'react';
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
import { Copy, Check, Share2, ExternalLink, Rss, Layers, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface MetaCatalogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId?: string;
}

export function MetaCatalogModal({
  open,
  onOpenChange,
  accountId,
}: MetaCatalogModalProps) {
  const [copiedType, setCopiedType] = useState<string | null>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const xmlUrl = `${origin}/api/public/catalog${accountId ? `?account_id=${accountId}` : ''}`;
  const csvUrl = `${origin}/api/public/catalog?format=csv${accountId ? `&account_id=${accountId}` : ''}`;
  const jsonUrl = `${origin}/api/public/catalog?format=json${accountId ? `&account_id=${accountId}` : ''}`;

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    toast.success(`${type} feed URL copied to clipboard!`);
    setTimeout(() => setCopiedType(null), 2500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-xl max-h-[88vh] overflow-y-auto p-4 sm:p-6 rounded-2xl border shadow-2xl bg-card">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 shrink-0">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Meta Commerce ও WhatsApp ক্যাটালগ ডাটা ফিড
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                হোয়াটসঅ্যাপ ক্যাটালগ, ফেসবুক শপ ও ইনস্টাগ্রাম শপিংয়ের জন্য স্বয়ংক্রিয় রিয়েল-টাইম প্রোডাক্ট সিঙ্ক
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 my-2 text-xs">
          {/* XML Feed (Recommended) */}
          <div className="space-y-1.5 p-3 rounded-xl border border-blue-500/30 bg-blue-500/5">
            <div className="flex items-center justify-between">
              <Label className="font-semibold text-foreground flex items-center gap-1.5">
                <Rss className="h-3.5 w-3.5 text-blue-500" />
                <span>XML / RSS Scheduled Feed (Recommended for Meta)</span>
              </Label>
              <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                Live Hourly Sync
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Input
                readOnly
                value={xmlUrl}
                className="font-mono text-xs bg-background h-8"
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 shrink-0"
                onClick={() => copyToClipboard(xmlUrl, 'XML')}
              >
                {copiedType === 'XML' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                <span>Copy</span>
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Standard Google Merchant / Meta Catalog RSS 2.0 format compatible with Meta Commerce Manager.
            </p>
          </div>

          {/* CSV Feed */}
          <div className="space-y-1.5 p-3 rounded-xl border bg-muted/30">
            <div className="flex items-center justify-between">
              <Label className="font-semibold text-foreground flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-amber-500" />
                <span>CSV Direct Feed</span>
              </Label>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Input
                readOnly
                value={csvUrl}
                className="font-mono text-xs bg-background h-8"
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 shrink-0"
                onClick={() => copyToClipboard(csvUrl, 'CSV')}
              >
                {copiedType === 'CSV' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                <span>Copy</span>
              </Button>
            </div>
          </div>

          {/* Quick Setup Instructions */}
          <div className="rounded-xl border p-3 bg-card space-y-2">
            <h4 className="font-semibold text-foreground text-xs flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>How to connect with WhatsApp & Facebook Shop:</span>
            </h4>
            <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-muted-foreground pl-1 leading-relaxed">
              <li>
                Open <strong className="text-foreground">Meta Commerce Manager</strong> (<a href="https://business.facebook.com/commerce" target="_blank" rel="noreferrer" className="text-primary underline">business.facebook.com/commerce</a>).
              </li>
              <li>Go to <strong className="text-foreground">Catalog &gt; Data Sources &gt; Add Items</strong>.</li>
              <li>Select <strong className="text-foreground">Data Feed (Scheduled Feed)</strong>.</li>
              <li>Paste the <strong className="text-foreground">XML Feed URL</strong> above and choose sync frequency (e.g. Hourly / Daily).</li>
              <li>Done! Your products will automatically appear in your Facebook Shop, Instagram Shop, and WhatsApp Catalog!</li>
            </ol>
          </div>
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
