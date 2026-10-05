'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Product, ProductStockLog } from '@/types/watch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  History,
  Package,
  PlusCircle,
  MinusCircle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Calendar,
  User,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';

interface StockAuditModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onStockUpdated: (productId: string, newStock: number) => void;
}

const REASON_LABELS: Record<string, { label: string; color: string }> = {
  bulk_restock: { label: 'নতুন রিস্টক (Restock)', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  order_placed: { label: 'অর্ডার প্লেসড', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  return: { label: 'কাস্টমার রিটার্ন', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  manual_adjustment: { label: 'ম্যানুয়াল সংশোধন', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  damage_loss: { label: 'ড্যামেজ বা নষ্ট', color: 'bg-red-500/10 text-red-400 border-red-500/30' },
};

export function StockAuditModal({
  product,
  isOpen,
  onClose,
  onStockUpdated,
}: StockAuditModalProps) {
  const [logs, setLogs] = useState<ProductStockLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [adjustMode, setAdjustMode] = useState<'add' | 'subtract'>('add');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState<string>('bulk_restock');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchLogs = useCallback(async () => {
    if (!product?.id) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/products/stock-logs?productId=${product.id}`);
      const data = await res.json();
      if (res.ok && data.logs) {
        setLogs(data.logs);
      }
    } catch {
      toast.error('স্টক অডিট হিস্ট্রি লোড করতে ব্যর্থ হয়েছে');
    } finally {
      setLoading(false);
    }
  }, [product?.id]);

  useEffect(() => {
    if (isOpen && product) {
      void fetchLogs();
      setAdjustQty('');
      setAdjustMode('add');
      setAdjustReason('bulk_restock');
    }
  }, [isOpen, product, fetchLogs]);

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;

    const qtyNum = parseInt(adjustQty, 10);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      toast.error('সঠিক পরিমাণ সংখ্যা লিখুন');
      return;
    }

    const finalChangeQty = adjustMode === 'add' ? qtyNum : -qtyNum;

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/products/stock-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          changeQty: finalChangeQty,
          reason: adjustReason,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`স্টক সফলভাবে আপডেট হয়েছে! বর্তমান স্টক: ${data.newStock} পিস`);
        onStockUpdated(product.id, data.newStock);
        setAdjustQty('');
        void fetchLogs();
      } else {
        toast.error(data.error || 'স্টক আপডেট করতে ব্যর্থ হয়েছে');
      }
    } catch {
      toast.error('সার্ভার এরর');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!product) return null;

  const currentStock = product.stock_quantity ?? 0;
  const parsedQty = parseInt(adjustQty, 10) || 0;
  const projectedStock = adjustMode === 'add'
    ? currentStock + parsedQty
    : Math.max(0, currentStock - parsedQty);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[88vh] overflow-y-auto bg-card border text-card-foreground p-4 sm:p-6 rounded-2xl shadow-2xl">
        <DialogHeader className="border-b pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                <History className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2 truncate">
                  <span>ইনভেন্টরি স্টক অডিট লেজার</span>
                  <Badge variant="outline" className="text-xs shrink-0 max-w-[140px] truncate">
                    {product.name}
                  </Badge>
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  রিয়েল-টাইম স্টক মুভমেন্ট হিস্ট্রি ও তাৎক্ষণিক স্টক অ্যাডজাস্টমেন্ট
                </p>
              </div>
            </div>
            <div className="text-left sm:text-right shrink-0 bg-muted/40 sm:bg-transparent p-2.5 sm:p-0 rounded-xl">
              <span className="text-[10px] text-muted-foreground block uppercase tracking-wider font-semibold">
                বর্তমান স্টক
              </span>
              <span className="text-xl font-black text-amber-500 font-mono">
                {currentStock} <span className="text-xs text-muted-foreground font-normal">পিস</span>
              </span>
            </div>
          </div>
        </DialogHeader>

        {/* Quick Stock Adjustment Form */}
        <form
          onSubmit={handleAdjustStock}
          className="rounded-xl border bg-muted/30 p-4 space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Package className="h-4 w-4 text-amber-500" />
              কুইক স্টক অ্যাডজাস্টমেন্ট (Quick Restock):
            </span>
            <div className="flex rounded-lg bg-background p-1 border">
              <button
                type="button"
                onClick={() => {
                  setAdjustMode('add');
                  setAdjustReason('bulk_restock');
                }}
                className={`flex-1 sm:flex-none px-3 py-1 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  adjustMode === 'add'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <PlusCircle className="h-3.5 w-3.5" />
                স্টক বৃদ্ধি (+)
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdjustMode('subtract');
                  setAdjustReason('manual_adjustment');
                }}
                className={`flex-1 sm:flex-none px-3 py-1 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  adjustMode === 'subtract'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <MinusCircle className="h-3.5 w-3.5" />
                স্টক হ্রাস (-)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-4 space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">পরিমাণ (পিস):</label>
              <Input
                type="number"
                min="1"
                placeholder="যেমন: 50"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                className="h-9 text-xs font-mono"
              />
            </div>

            <div className="sm:col-span-5 space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">কারণ (Reason):</label>
              <select
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="w-full h-9 rounded-md bg-background border border-input text-foreground text-xs px-2.5 focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {adjustMode === 'add' ? (
                  <>
                    <option value="bulk_restock">নতুন রিস্টক / চালান প্রাপ্তি</option>
                    <option value="return">কাস্টমার পার্সেল রিটার্ন</option>
                    <option value="manual_adjustment">ম্যানুয়াল হিসাব সংশোধন</option>
                  </>
                ) : (
                  <>
                    <option value="manual_adjustment">ম্যানুয়াল হিসাব সংশোধন</option>
                    <option value="damage_loss">ড্যামেজ / নষ্ট / হারিয়ে যাওয়া</option>
                  </>
                )}
              </select>
            </div>

            <div className="sm:col-span-3">
              <Button
                type="submit"
                disabled={isSubmitting || !parsedQty}
                className="w-full h-9 font-bold text-xs shadow-xs"
              >
                {isSubmitting ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  'আপডেট করুন'
                )}
              </Button>
            </div>
          </div>

          {parsedQty > 0 && (
            <div className="flex items-center gap-2 text-xs pt-1 border-t">
              <span className="text-muted-foreground">পূর্বের স্টক: <strong className="text-foreground">{currentStock}</strong></span>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">
                নতুন প্রত্যাশিত স্টক:{' '}
                <strong className={adjustMode === 'add' ? 'text-emerald-600 dark:text-emerald-400 font-mono' : 'text-amber-600 font-mono'}>
                  {projectedStock} পিস ({adjustMode === 'add' ? `+${parsedQty}` : `-${parsedQty}`})
                </strong>
              </span>
            </div>
          )}
        </form>

        {/* Audit Log Table */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              বিগত ট্রানজেকশন হিস্ট্রি ({logs.length})
            </h4>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={fetchLogs}
              disabled={loading}
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
              রিফ্রেশ
            </Button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-muted-foreground text-xs flex flex-col items-center gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
              <span>স্টক লগ লোড হচ্ছে...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-xs border border-dashed rounded-xl">
              এখনো কোনো স্টক ট্রানজেকশন রেকর্ড পাওয়া যায়নি।
            </div>
          ) : (
            <div className="rounded-xl border overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[500px]">
                <thead className="bg-muted/50 border-b text-muted-foreground text-[11px]">
                  <tr>
                    <th className="p-3">তারিখ ও সময়</th>
                    <th className="p-3">ট্রানজেকশন কারণ</th>
                    <th className="p-3 text-right">পরিবর্তন (Qty)</th>
                    <th className="p-3 text-right">নতুন স্টক</th>
                    <th className="p-3 text-right">রেফারেন্স / ইউজার</th>
                  </tr>
                </thead>
                <tbody className="divide-y bg-card">
                  {logs.map((log) => {
                    const isPositive = log.change_qty > 0;
                    const reasonMeta = REASON_LABELS[log.reason] || {
                      label: log.reason,
                      color: 'bg-muted text-muted-foreground',
                    };
                    const formattedDate = new Date(log.created_at).toLocaleDateString('bn-BD', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <tr key={log.id} className="hover:bg-muted/40 transition-colors">
                        <td className="p-3 text-muted-foreground text-[11px] font-mono">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {formattedDate}
                          </div>
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${reasonMeta.color}`}
                          >
                            {reasonMeta.label}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-bold">
                          <span
                            className={`inline-flex items-center gap-0.5 ${
                              isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {isPositive ? (
                              <TrendingUp className="h-3 w-3 inline" />
                            ) : (
                              <TrendingDown className="h-3 w-3 inline" />
                            )}
                            {isPositive ? `+${log.change_qty}` : log.change_qty}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono text-foreground">
                          {log.new_stock}
                          <span className="text-[10px] text-muted-foreground ml-1">
                            (পূর্বে: {log.previous_stock})
                          </span>
                        </td>
                        <td className="p-3 text-right text-[11px] text-muted-foreground font-mono">
                          {log.order_id ? (
                            <span className="text-primary hover:underline font-semibold">
                              #{log.order_id.slice(0, 8)}
                            </span>
                          ) : (
                            <span className="flex items-center justify-end gap-1 text-muted-foreground">
                              <User className="h-3 w-3" />
                              {log.created_by ? log.created_by.slice(0, 10) : 'System'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
