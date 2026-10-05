'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  RotateCcw,
  Barcode,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Package,
  Truck,
  ArrowRight,
  RefreshCw,
  Search,
  History,
  Check,
  AlertCircle,
  FileCheck2,
} from 'lucide-react';
import { CameraBarcodeScannerModal } from '@/components/common/camera-barcode-scanner-modal';
import type { Order } from '@/types/commerce';
import { toast } from 'sonner';

interface ReturnReconciliationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: Order[];
  onOrderUpdated?: () => void;
}

interface ReconciledItem {
  orderId: string;
  invoiceNo: string;
  trackingCode: string;
  customerName: string;
  customerPhone: string;
  productName: string;
  quantity: number;
  totalAmount: number;
  timestamp: string;
}

export function ReturnReconciliationModal({
  open,
  onOpenChange,
  orders,
  onOrderUpdated,
}: ReturnReconciliationModalProps) {
  const [scanInput, setScanInput] = useState('');
  const [autoReconcile, setAutoReconcile] = useState(true);
  const [matchedOrder, setMatchedOrder] = useState<Order | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [sessionLogs, setSessionLogs] = useState<ReconciledItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sound effects generator
  const playSound = useCallback((type: 'success' | 'warning' | 'error') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.setValueAtTime(880.0, audioCtx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.35);
      } else if (type === 'warning') {
        osc.frequency.setValueAtTime(329.63, audioCtx.currentTime); // E4
        osc.frequency.setValueAtTime(311.13, audioCtx.currentTime + 0.15); // Eb4
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.4);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.4);
      }
    } catch {
      // Audio not permitted or supported
    }
  }, []);

  // Autofocus input whenever dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
    } else {
      setMatchedOrder(null);
      setScanInput('');
    }
  }, [open]);

  // Execute Order Return & Restock
  const executeReturn = async (order: Order) => {
    if (order.status === 'RETURNED') {
      playSound('warning');
      toast.warning(`অর্ডার #${order.invoice_no || order.id.slice(0, 8)} ইতিপূর্বে রিটার্ন হিসেবে গ্রহণ করা হয়েছিল!`);
      return;
    }

    try {
      setIsProcessing(true);
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: order.id,
          status: 'RETURNED',
          notes: `কুরিয়ার রিটার্ন পার্সেল স্ক্যানার থেকে গৃহীত (তারিখ: ${new Date().toLocaleDateString('bn-BD')})`,
        }),
      });

      if (res.ok) {
        playSound('success');
        toast.success(`অর্ডার #${order.invoice_no || order.id.slice(0, 8)} সফলভাবে রিটার্ন ও স্টক বৃদ্ধি করা হয়েছে!`);

        // Record session log
        const logItem: ReconciledItem = {
          orderId: order.id,
          invoiceNo: order.invoice_no || `INV-${order.id.slice(0, 8).toUpperCase()}`,
          trackingCode: order.courier_tracking_code || 'N/A',
          customerName: order.customer_name,
          customerPhone: order.customer_phone,
          productName: order.product_name,
          quantity: order.quantity || 1,
          totalAmount: Number(order.total_amount) || 0,
          timestamp: new Date().toLocaleTimeString('bn-BD'),
        };

        setSessionLogs((prev) => [logItem, ...prev]);
        setMatchedOrder(null);
        setScanInput('');

        if (onOrderUpdated) onOrderUpdated();
      } else {
        const data = await res.json();
        playSound('error');
        toast.error(data.error || 'রিটার্ন প্রসেস করতে ব্যর্থ');
      }
    } catch {
      playSound('error');
      toast.error('নেটওয়ার্ক সমস্যা');
    } finally {
      setIsProcessing(false);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  };

  // Find order by scanned code
  const handleScanLookup = (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;

    // Search order by tracking code, invoice no, ID, or phone
    const cleanDigits = code.replace(/\D/g, '');
    const found = orders.find((o) => {
      if (o.courier_tracking_code && o.courier_tracking_code.toLowerCase() === code.toLowerCase()) {
        return true;
      }
      if (o.invoice_no && o.invoice_no.toLowerCase() === code.toLowerCase()) {
        return true;
      }
      if (o.id.toLowerCase() === code.toLowerCase() || o.id.toLowerCase().startsWith(code.toLowerCase())) {
        return true;
      }
      if (cleanDigits.length >= 7 && o.customer_phone.replace(/\D/g, '').includes(cleanDigits)) {
        return true;
      }
      return false;
    });

    if (!found) {
      playSound('error');
      toast.error(`"${code}" দ্বারা কোন অর্ডার খুঁজে পাওয়া যায়নি!`);
      setMatchedOrder(null);
      return;
    }

    if (found.status === 'RETURNED') {
      playSound('warning');
      toast.warning(`⚠️ এই পার্সেলটি (${found.invoice_no || found.id.slice(0, 8)}) ইতিমধ্যে রিটার্ন ও স্টক-ইন করা হয়ে গেছে!`);
      setMatchedOrder(found);
      return;
    }

    setMatchedOrder(found);

    if (autoReconcile) {
      executeReturn(found);
    } else {
      playSound('success');
    }
  };

  const totalSessionAmount = sessionLogs.reduce((acc, it) => acc + it.totalAmount, 0);
  const totalSessionQty = sessionLogs.reduce((acc, it) => acc + it.quantity, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-background">
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-500/10 text-rose-600 rounded-xl">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  কুরিয়ার রিটার্ন রিকনসিলিয়েশন স্ক্যানার
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  কুরিয়ার ফেরত পার্সেল বারকোড বা ট্র্যাকিং কোড স্ক্যান করে ১-ক্লিকে স্টক রিস্টোর করুন
                </DialogDescription>
              </div>
            </div>

            {/* Auto Reconcile Switch */}
            <div className="flex items-center gap-2 bg-muted/50 border px-3 py-1.5 rounded-lg">
              <Switch
                id="auto-reconcile"
                checked={autoReconcile}
                onCheckedChange={setAutoReconcile}
              />
              <Label
                htmlFor="auto-reconcile"
                className="text-xs font-semibold cursor-pointer select-none"
              >
                স্ক্যান করলেই অটো-রিস্টক
              </Label>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* SCANNER INPUT BAR */}
          <div className="bg-card border-2 border-primary/30 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Barcode className="w-4 h-4 text-primary animate-pulse" />
                <span className="text-xs font-bold text-foreground">
                  বারকোড রিডার বা কিবোর্ড ইনপুট
                </span>
              </div>
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                বারকোড স্ক্যানার গান প্রস্তুত
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder="কুরিয়ার ট্র্যাকিং কোড, ইনভয়েস #, বা ফোন নাম্বার দিয়ে এন্টার চাপুন..."
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleScanLookup(scanInput);
                    }
                  }}
                  className="pl-9 h-11 text-sm font-mono border-primary/40 focus-visible:ring-primary"
                  autoFocus
                />
              </div>

              <Button
                type="button"
                variant="outline"
                className="h-11 px-4 gap-2 font-semibold text-xs border-primary/40 text-primary hover:bg-primary/10"
                onClick={() => setIsCameraOpen(true)}
              >
                <Camera className="w-4 h-4" />
                ক্যামেরা স্ক্যান
              </Button>

              <Button
                type="button"
                className="h-11 px-5 font-bold text-xs"
                onClick={() => handleScanLookup(scanInput)}
                disabled={!scanInput.trim()}
              >
                খুঁজুন
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              💡 টিপস: বারকোড স্ক্যানার দিয়ে পার্সেলের ইনভয়েস বা কুরিয়ার স্টিকারে ক্লিক করলেই তাৎক্ষণিক শনাক্ত হবে।
            </p>
          </div>

          {/* MATCHED ORDER CARD */}
          {matchedOrder && (
            <div
              className={`border-2 rounded-2xl p-5 shadow-md transition-all ${
                matchedOrder.status === 'RETURNED'
                  ? 'border-amber-500/50 bg-amber-500/5'
                  : 'border-emerald-500/60 bg-emerald-500/5'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-base text-foreground">
                      #{matchedOrder.invoice_no || matchedOrder.id.slice(0, 8)}
                    </span>
                    <Badge
                      variant={matchedOrder.status === 'RETURNED' ? 'secondary' : 'default'}
                      className="text-[10px] uppercase font-bold"
                    >
                      {matchedOrder.status}
                    </Badge>
                    {matchedOrder.courier_provider && (
                      <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                        <Truck className="w-3 h-3 mr-1 inline" />
                        {matchedOrder.courier_provider}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ট্র্যাকিং কোড:{' '}
                    <span className="font-mono font-bold text-foreground">
                      {matchedOrder.courier_tracking_code || 'নেই'}
                    </span>
                  </p>
                </div>

                {matchedOrder.status !== 'RETURNED' ? (
                  <Button
                    size="sm"
                    className="h-9 gap-1.5 font-bold bg-rose-600 hover:bg-rose-700 text-white"
                    onClick={() => executeReturn(matchedOrder)}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <RotateCcw className="w-4 h-4" />
                    )}
                    রিটার্ন নিশ্চিত ও স্টক-ইন করুন
                  </Button>
                ) : (
                  <Badge variant="outline" className="border-amber-500/40 text-amber-600 px-3 py-1 text-xs">
                    ইতিমধ্যে রিটার্ন গ্রহণ করা হয়েছে
                  </Badge>
                )}
              </div>

              {/* Order Item Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 text-xs">
                <div>
                  <p className="text-muted-foreground font-semibold">কাস্টমার তথ্য:</p>
                  <p className="font-bold text-foreground mt-0.5">{matchedOrder.customer_name}</p>
                  <p className="font-mono text-muted-foreground">{matchedOrder.customer_phone}</p>
                  <p className="text-muted-foreground/80 mt-1 line-clamp-1">{matchedOrder.customer_address}</p>
                </div>

                <div>
                  <p className="text-muted-foreground font-semibold">প্রোডাক্ট ও পার্সেল মান:</p>
                  <p className="font-bold text-foreground mt-0.5 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-primary" />
                    {matchedOrder.product_name}
                  </p>
                  <p className="text-muted-foreground">
                    পরিমাণ: <span className="font-bold text-foreground">{matchedOrder.quantity || 1} টি</span> • মোট মূল্য: <span className="font-bold font-mono text-foreground">৳{matchedOrder.total_amount?.toLocaleString()}</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SESSION LOGS / RECONCILED PARCELS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-emerald-600" />
                <h4 className="text-sm font-bold text-foreground">
                  এই সেশনে স্ক্যান করা পার্সেল ({sessionLogs.length} টি)
                </h4>
              </div>

              {sessionLogs.length > 0 && (
                <div className="text-right text-xs">
                  <span className="text-muted-foreground">রিস্টক মান: </span>
                  <span className="font-bold text-emerald-600 font-mono">
                    ৳{totalSessionAmount.toLocaleString()} ({totalSessionQty} pcs)
                  </span>
                </div>
              )}
            </div>

            {sessionLogs.length === 0 ? (
              <div className="py-8 border border-dashed rounded-xl text-center bg-muted/10">
                <RotateCcw className="w-8 h-8 text-muted-foreground/40 mx-auto mb-1.5" />
                <p className="text-xs font-medium text-foreground">
                  এখনো কোনো রিটার্ন পার্সেল স্ক্যান করা হয়নি
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  কুরিয়ার থেকে আসা পার্সেলগুলো একে একে স্ক্যান করুন।
                </p>
              </div>
            ) : (
              <div className="border rounded-xl divide-y bg-card overflow-hidden max-h-56 overflow-y-auto">
                {sessionLogs.map((log, idx) => (
                  <div
                    key={idx}
                    className="p-3 flex items-center justify-between text-xs hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-foreground">
                            #{log.invoiceNo}
                          </span>
                          <span className="text-muted-foreground text-[11px]">
                            ({log.trackingCode})
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {log.productName} × {log.quantity} pcs ({log.customerName})
                        </p>
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <p className="font-bold text-foreground">৳{log.totalAmount.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">{log.timestamp}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Live Camera Scanner Modal */}
        <CameraBarcodeScannerModal
          isOpen={isCameraOpen}
          onClose={() => setIsCameraOpen(false)}
          onScan={(scanned) => {
            setScanInput(scanned);
            handleScanLookup(scanned);
          }}
          title="রিটার্ন পার্সেল ক্যামেরা স্ক্যানার"
          description="কুরিয়ার পার্সেলের বারকোড বা ট্র্যাকিং কোডের দিকে ক্যামেরা তাক করুন"
        />
      </DialogContent>
    </Dialog>
  );
}
