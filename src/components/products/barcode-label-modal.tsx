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
import { Printer, Copy, Check, Barcode as BarcodeIcon, Tag } from 'lucide-react';
import type { Product } from '@/types/watch';
import { toast } from 'sonner';

interface BarcodeLabelModalProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeName?: string;
}

/**
 * Generates an SVG barcode pattern based on string characters (Code 128 style representation)
 */
function renderBarcodeSvg(code: string) {
  // Deterministic bar widths based on char codes
  const bars: { width: number; isBlack: boolean }[] = [];
  bars.push({ width: 2, isBlack: true });
  bars.push({ width: 1, isBlack: false });
  bars.push({ width: 2, isBlack: true });
  bars.push({ width: 1, isBlack: false });

  for (let i = 0; i < code.length; i++) {
    const val = code.charCodeAt(i);
    const w1 = (val % 3) + 1;
    const w2 = ((val >> 2) % 3) + 1;
    const w3 = ((val >> 4) % 3) + 1;
    bars.push({ width: w1, isBlack: true });
    bars.push({ width: w2, isBlack: false });
    bars.push({ width: w3, isBlack: true });
    bars.push({ width: 1, isBlack: false });
  }

  bars.push({ width: 2, isBlack: true });
  bars.push({ width: 1, isBlack: false });
  bars.push({ width: 3, isBlack: true });

  let x = 10;
  const rects = bars.map((b, idx) => {
    const currentX = x;
    x += b.width * 2;
    if (!b.isBlack) return null;
    return (
      <rect
        key={idx}
        x={currentX}
        y="5"
        width={b.width * 2}
        height="50"
        fill="currentColor"
      />
    );
  });

  return (
    <svg viewBox={`0 0 ${x + 10} 60`} className="w-full h-12 text-neutral-900 dark:text-neutral-100">
      {rects}
    </svg>
  );
}

export function BarcodeLabelModal({
  product,
  open,
  onOpenChange,
  storeName = 'Online Store',
}: BarcodeLabelModalProps) {
  const [copied, setCopied] = useState(false);
  const [printCopies, setPrintCopies] = useState(1);

  if (!product) return null;

  const barcodeValue = product.barcode || product.sku || `PRD-${product.id.substring(0, 8).toUpperCase()}`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(barcodeValue);
    setCopied(true);
    toast.success('Barcode/SKU copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-md rounded-2xl p-4 sm:p-6 border shadow-2xl bg-card">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
              <BarcodeIcon className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">প্রোডাক্ট বারকোড ও থার্মাল লেবেল</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                ওয়্যারহাউস প্যাকেজিং ও থার্মাল স্টিকার প্রিন্টার (50x30mm / A4) রেডি
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Printable Sticker Preview */}
        <div className="my-2 p-5 rounded-2xl border border-dashed border-border bg-muted/30 flex flex-col items-center justify-center">
          <div
            id="printable-barcode-label"
            className="w-[260px] max-w-full bg-white text-neutral-900 p-3.5 rounded-xl border border-neutral-200 shadow-md flex flex-col items-center text-center font-sans print:shadow-none print:border-none"
          >
            <div className="text-[10px] font-bold tracking-wider uppercase text-neutral-500 line-clamp-1">
              {storeName}
            </div>

            <h4 className="text-xs font-bold text-neutral-900 mt-1 line-clamp-2 leading-tight">
              {product.name}
            </h4>

            {/* Barcode graphic */}
            <div className="my-2 w-full px-2">
              {renderBarcodeSvg(barcodeValue)}
            </div>

            <div className="font-mono text-[11px] font-bold tracking-widest text-neutral-800">
              {barcodeValue}
            </div>

            <div className="w-full border-t border-dashed border-neutral-300 mt-2 pt-1.5 flex items-center justify-between px-1">
              <span className="text-[10px] text-neutral-500 font-medium">PRICE</span>
              <span className="text-sm font-black text-neutral-950">
                ৳{product.price.toLocaleString('en-BD')}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between text-xs px-1 py-1 bg-muted/40 rounded-lg border">
          <div className="flex items-center gap-1.5 text-muted-foreground px-2">
            <Tag className="h-3.5 w-3.5" />
            <span>কোড: <code className="font-mono font-bold text-foreground">{barcodeValue}</code></span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleCopyCode} className="h-7 text-xs gap-1">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? 'কপি হয়েছে' : 'কপি'}</span>
          </Button>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t flex-col sm:flex-row">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            বন্ধ করুন
          </Button>
          <Button size="sm" onClick={handlePrint} className="w-full sm:w-auto gap-1.5 shadow-sm font-semibold">
            <Printer className="h-4 w-4" />
            <span>প্রিন্ট লেবেল স্টিকার</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
