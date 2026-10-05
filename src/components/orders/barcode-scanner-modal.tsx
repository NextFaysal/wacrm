'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Scan,
  Barcode,
  Truck,
  CheckCircle2,
  Package,
  Printer,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Volume2,
  VolumeX,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Order } from '@/types/commerce';

interface BarcodeScannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderUpdated?: () => void;
  onPrintInvoice?: (order: Order) => void;
}

export function BarcodeScannerModal({
  open,
  onOpenChange,
  onOrderUpdated,
  onPrintInvoice,
}: BarcodeScannerModalProps) {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scannedOrder, setScannedOrder] = useState<Order | null>(null);
  const [verifiedItems, setVerifiedItems] = useState<Record<string, boolean>>({});
  const [dispatching, setDispatching] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<Array<{ invoice: string; name: string; time: string; status: string }>>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  // Play audio beep for barcode gun
  const playBeep = (type: 'success' | 'error') => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(880, ctx.currentTime); // High pitch beep
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else {
        osc.frequency.setValueAtTime(220, ctx.currentTime); // Low buzz
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch {
      // AudioContext not allowed or unsupported
    }
  };

  // Keep input focused so barcode gun sends input directly
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [open, scannedOrder]);

  const handleLookup = async (code: string) => {
    const clean = code.trim();
    if (!clean) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/public/track/${encodeURIComponent(clean)}`);
      const data = await res.json();

      if (!res.ok || !data.order) {
        playBeep('error');
        toast.error(`অর্ডার পাওয়া যায়নি: ${clean}`);
        setBarcodeInput('');
        return;
      }

      playBeep('success');
      const order = data.order as Order;
      setScannedOrder(order);
      setVerifiedItems({});
      setBarcodeInput('');

      // Add to session history
      setSessionHistory((prev) => [
        {
          invoice: order.invoice_no || order.id.slice(0, 8),
          name: order.customer_name || 'Customer',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: order.courier_status || order.status || 'CONFIRMED',
        },
        ...prev.slice(0, 9),
      ]);
      toast.success(`অর্ডার স্ক্যান সম্পন্ন: ${order.invoice_no}`);
    } catch {
      playBeep('error');
      toast.error('সার্ভারে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleLookup(barcodeInput);
    }
  };

  const handleToggleItemVerify = (key: string) => {
    setVerifiedItems((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleQuickDispatch = async (provider: 'steadfast' | 'pathao') => {
    if (!scannedOrder) return;
    setDispatching(true);

    try {
      const res = await fetch('/api/courier/fraud-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: scannedOrder.id,
          provider,
        }),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Dispatch failed');

      playBeep('success');
      toast.success(`পার্সেল ${provider.toUpperCase()}-এ বুকিং ও ডিসপ্যাচ হয়েছে!`);

      // Refresh order data
      setScannedOrder((prev) =>
        prev
          ? {
              ...prev,
              courier_provider: provider,
              courier_tracking_code: resData.tracking_code || prev.courier_tracking_code,
              status: 'SHIPPED',
            }
          : null
      );

      if (onOrderUpdated) onOrderUpdated();
    } catch (err) {
      playBeep('error');
      toast.error(err instanceof Error ? err.message : 'কুরিয়ার বুকিং ব্যর্থ হয়েছে');
    } finally {
      setDispatching(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-foreground text-base sm:text-lg">
              <Barcode className="size-5 text-primary" />
              Warehouse Barcode & Express Dispatch Station
            </DialogTitle>
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              title={soundEnabled ? 'সাউন্ড অন' : 'মিউট'}
            >
              {soundEnabled ? <Volume2 className="size-4 text-emerald-500" /> : <VolumeX className="size-4" />}
            </button>
          </div>
          <DialogDescription className="text-xs">
            বারকোড স্ক্যানার গান দিয়ে ইনভয়েসের বারকোড স্ক্যান করুন অথবা ইনভয়েস কোড লিখে এন্টার চাপুন।
          </DialogDescription>
        </DialogHeader>

        {/* Barcode Scanner Input */}
        <div className="space-y-4 py-2">
          <div className="relative">
            <Scan className="absolute left-3.5 top-3.5 size-5 text-primary animate-pulse" />
            <Input
              ref={inputRef}
              placeholder="বারকোড স্ক্যান করুন (যেমন: INV-2610-XXXX বা CID-XXXX)..."
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-11 pr-24 py-6 text-sm font-mono tracking-wider font-bold border-2 border-primary/40 focus:border-primary shadow-sm"
            />
            <Button
              size="sm"
              onClick={() => handleLookup(barcodeInput)}
              disabled={loading || !barcodeInput.trim()}
              className="absolute right-2 top-2 h-8 text-xs font-semibold gap-1"
            >
              {loading ? <RefreshCw className="size-3.5 animate-spin" /> : 'খুঁজুন'}
            </Button>
          </div>

          {/* Scanned Order Card */}
          {scannedOrder ? (
            <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-sm animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-border">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-foreground">
                      {scannedOrder.invoice_no || scannedOrder.id.slice(0, 8)}
                    </span>
                    <Badge variant="outline" className="text-[10px] uppercase font-bold text-primary border-primary/30">
                      {scannedOrder.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    গ্রাহক: <strong className="text-foreground">{scannedOrder.customer_name}</strong> ({scannedOrder.customer_phone})
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-muted-foreground block">ক্যাশ অন ডেলিভারি (COD):</span>
                  <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                    ৳{Math.max(0, Number(scannedOrder.total_amount || 0) - Number(scannedOrder.advance_paid || 0))}
                  </span>
                </div>
              </div>

              {/* Items Packing Checklist */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                  প্যাকেজিং আইটেম চেকলিস্ট (Item Checklist)
                </span>
                <div
                  onClick={() => handleToggleItemVerify('main_product')}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                    verifiedItems['main_product']
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-foreground'
                      : 'border-border bg-muted/40 hover:bg-muted text-muted-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`size-4 rounded flex items-center justify-center border ${
                        verifiedItems['main_product']
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : 'border-muted-foreground'
                      }`}
                    >
                      {verifiedItems['main_product'] && <CheckCircle2 className="size-3" />}
                    </div>
                    <span className="text-xs font-medium text-foreground">
                      {scannedOrder.product_name || 'অর্ডারকৃত পণ্য'} (পরিমাণ: {scannedOrder.quantity || 1})
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    {verifiedItems['main_product'] ? 'চেকড ✓' : 'ক্লিক করে টিক দিন'}
                  </Badge>
                </div>
              </div>

              {/* Address Preview */}
              <div className="text-xs bg-muted/50 p-2.5 rounded-lg border border-border/80">
                <span className="text-muted-foreground block text-[11px] mb-0.5">📍 ডেলিভারি ঠিকানা:</span>
                <span className="text-foreground">{scannedOrder.customer_address || 'ঠিকানা পাওয়া যায়নি'}</span>
              </div>

              {/* Quick Actions */}
              <div className="pt-2 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => handleQuickDispatch('steadfast')}
                  disabled={dispatching || !!scannedOrder.courier_tracking_code}
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs"
                >
                  <Truck className="size-3.5" />
                  {dispatching ? 'বুকিং হচ্ছে...' : 'Steadfast বুকিং ও ডিসপ্যাচ'}
                </Button>

                {onPrintInvoice && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onPrintInvoice(scannedOrder)}
                    className="gap-1.5 text-xs"
                  >
                    <Printer className="size-3.5" />
                    ইনভয়েস প্রিন্ট
                  </Button>
                )}

                <a
                  href={`/track/${encodeURIComponent(scannedOrder.courier_tracking_code || scannedOrder.invoice_no || scannedOrder.id)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center"
                >
                  <Button size="sm" variant="ghost" className="gap-1 text-xs text-primary">
                    <ExternalLink className="size-3" />
                    লাইভ ট্র্যাকিং পেজ
                  </Button>
                </a>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground space-y-2">
              <Barcode className="size-10 mx-auto text-muted-foreground/60" />
              <p className="text-xs font-medium">যেকোনো পার্সেল ইনভয়েসের বারকোড স্ক্যান করুন</p>
              <p className="text-[11px] text-muted-foreground/80">
                স্ক্যান করলেই সাথে সাথে অর্ডারের বিবরণ চলে আসবে এবং ১-ক্লিকে কুরিয়ারে বুকিং দেওয়া যাবে।
              </p>
            </div>
          )}

          {/* Session Scan History Stream */}
          {sessionHistory.length > 0 && (
            <div className="pt-3 border-t border-border space-y-2">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                এই সেশনে স্ক্যান করা পার্সেলসমূহ ({sessionHistory.length}টি)
              </span>
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {sessionHistory.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-md bg-muted/40 text-xs border border-border/60"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-foreground">{item.invoice}</span>
                      <span className="text-muted-foreground truncate max-w-[140px]">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{item.time}</span>
                      <Badge variant="outline" className="text-[10px] py-0">
                        {item.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
