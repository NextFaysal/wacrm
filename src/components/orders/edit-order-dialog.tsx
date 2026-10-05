'use client';

import React, { useState, useEffect } from 'react';
import type { Order } from '@/types/commerce';
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
import { Badge } from '@/components/ui/badge';
import {
  Edit3,
  Package,
  Phone,
  User,
  MapPin,
  Loader2,
  CheckCircle2,
  Truck,
  FileText,
  Minus,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';

interface EditOrderDialogProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditOrderDialog({ order, open, onOpenChange, onSuccess }: EditOrderDialogProps) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [thana, setThana] = useState('');
  const [district, setDistrict] = useState('Dhaka');
  const [productName, setProductName] = useState('');
  const [variant, setVariant] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [deliveryCharge, setDeliveryCharge] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (order) {
      setCustomerName(order.customer_name || '');
      setCustomerPhone(order.customer_phone || '');
      setCustomerAddress(order.customer_address || '');
      setThana(order.thana || '');
      setDistrict(order.district || 'Dhaka');
      setProductName(order.product_name || '');
      setVariant(order.variant || 'Standard');
      setQuantity(Number(order.quantity) || 1);
      setUnitPrice(Number(order.unit_price) || 0);
      setDeliveryCharge(Number(order.delivery_charge) || 0);
      setNotes(order.notes || '');
    }
  }, [order]);

  if (!order) return null;

  const invoiceNo = order.invoice_no || `INV-${order.id.slice(0, 8).toUpperCase()}`;
  const advancePaid = Number(order.advance_paid) || 0;
  const subtotal = unitPrice * quantity;
  const totalAmount = subtotal + Number(deliveryCharge || 0);
  const codDue = Math.max(0, totalAmount - advancePaid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerPhone.trim() || !customerName.trim() || !productName.trim()) {
      toast.error('গ্রাহকের নাম, মোবাইল নম্বর এবং প্রোডাক্টের নাম আবশ্যক');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: order.id,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          customer_address: customerAddress.trim(),
          thana: thana.trim() || null,
          district: district.trim() || null,
          product_name: productName.trim(),
          variant: variant.trim() || null,
          quantity,
          unit_price: unitPrice,
          delivery_charge: deliveryCharge,
          total_amount: totalAmount,
          notes: notes.trim() || null,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`অর্ডার #${invoiceNo} সফলভাবে আপডেট করা হয়েছে!`);
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(data.error || 'Failed to update order');
      }
    } catch {
      toast.error('Network error updating order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] sm:max-w-2xl max-h-[92vh] flex flex-col p-0 rounded-2xl overflow-hidden border-border/80 shadow-2xl bg-background">
        {/* Header */}
        <DialogHeader className="p-4 sm:p-5 border-b bg-muted/20 flex flex-row items-center justify-between gap-3 space-y-0 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 ring-1 ring-primary/20">
              <Edit3 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                অর্ডার তথ্য সম্পাদনা
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {invoiceNo}
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground truncate mt-0.5">
                গ্রাহকের নাম, ঠিকানা, পণ্যের পরিমাণ ও ডেলিভারি ফি পরিবর্তন করুন
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Form Body */}
        <form id="edit-order-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Section 1: Customer Details */}
          <div className="rounded-xl border border-border/70 bg-card p-3.5 sm:p-4 space-y-3.5 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2 border-b border-border/40 pb-2">
              <User className="h-3.5 w-3.5 text-primary" /> গ্রাহকের বিবরণ
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Phone */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  মোবাইল নম্বর <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    required
                    className="pl-9 h-9 text-xs font-mono rounded-lg"
                  />
                </div>
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  গ্রাহকের নাম <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    required
                    className="pl-9 h-9 text-xs rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">ডেলিভারি ঠিকানা (Full Address)</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <textarea
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  rows={2}
                  className="w-full pl-9 p-2 rounded-lg border border-input bg-background text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none leading-relaxed"
                />
              </div>
            </div>

            {/* District & Thana */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">জেলা (District)</Label>
                <Input
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="h-9 text-xs rounded-lg"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">থানা / উপজেলা (Thana)</Label>
                <Input
                  value={thana}
                  onChange={(e) => setThana(e.target.value)}
                  className="h-9 text-xs rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Product & Pricing Details */}
          <div className="rounded-xl border border-border/70 bg-card p-3.5 sm:p-4 space-y-3.5 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2 border-b border-border/40 pb-2">
              <Package className="h-3.5 w-3.5 text-primary" /> প্রোডাক্ট ও বিলিং
            </span>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1">
                প্রোডাক্টের নাম <span className="text-red-500">*</span>
              </Label>
              <Input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                required
                className="h-9 text-xs rounded-lg font-medium"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Variant */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">ভ্যারিয়েন্ট / সাইজ</Label>
                <Input
                  value={variant}
                  onChange={(e) => setVariant(e.target.value)}
                  className="h-9 text-xs rounded-lg"
                />
              </div>

              {/* Quantity Stepper */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">পরিমাণ (Quantity)</Label>
                <div className="flex items-center rounded-lg border border-input bg-background p-0.5">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full text-center text-xs font-bold bg-transparent border-0 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Unit Price */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">প্রতি পিস মূল্য (৳)</Label>
                <Input
                  type="number"
                  min={0}
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(Number(e.target.value) || 0)}
                  className="h-9 text-xs font-mono font-bold rounded-lg"
                />
              </div>
            </div>

            {/* Delivery Charge Presets */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs">
                <Label className="font-semibold flex items-center gap-1">
                  <Truck className="h-3.5 w-3.5 text-muted-foreground" /> ডেলিভারি চার্জ (৳)
                </Label>
                <div className="flex items-center gap-1">
                  {[
                    { label: 'ঢাকা (৳৬০)', val: 60 },
                    { label: 'বাইরে (৳১২০)', val: 120 },
                    { label: 'ফ্রি (৳০)', val: 0 },
                  ].map((p) => (
                    <button
                      key={p.val}
                      type="button"
                      onClick={() => setDeliveryCharge(p.val)}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition-colors ${
                        deliveryCharge === p.val
                          ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                          : 'bg-muted/70 hover:bg-muted text-muted-foreground'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <Input
                type="number"
                min={0}
                value={deliveryCharge}
                onChange={(e) => setDeliveryCharge(Number(e.target.value) || 0)}
                className="h-9 text-xs font-mono rounded-lg"
              />
            </div>
          </div>

          {/* Section 3: Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
              <FileText className="h-3.5 w-3.5" /> অর্ডার নোট / নির্দেশনা (Optional)
            </Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="বিশেষ নির্দেশনা বা ডেলিভারি নোট..."
              className="h-8 text-xs rounded-lg"
            />
          </div>

          {/* Section 4: Live Recalculation Bar */}
          <div className="rounded-xl bg-primary/10 border border-primary/20 p-3 sm:p-4 space-y-2 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>সাবটোটাল ({quantity} × ৳{unitPrice}):</span>
              <span className="font-mono text-foreground font-semibold">৳{subtotal.toLocaleString('en-BD')}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>ডেলিভারি চার্জ:</span>
              <span className="font-mono text-foreground">৳{deliveryCharge}</span>
            </div>
            {advancePaid > 0 && (
              <div className="flex justify-between text-emerald-600 font-semibold">
                <span>অগ্রিম পরিশোধিত:</span>
                <span className="font-mono">- ৳{advancePaid}</span>
              </div>
            )}
            <div className="flex justify-between items-center border-t border-primary/20 pt-2 font-bold text-sm">
              <span className="text-foreground">সংশোধিত কুরিয়ার COD:</span>
              <span className="text-primary font-mono text-lg font-black tracking-tight">
                ৳{codDue.toLocaleString('en-BD')}
              </span>
            </div>
          </div>
        </form>

        {/* Sticky Footer */}
        <DialogFooter className="p-3 sm:p-4 border-t bg-background/95 backdrop-blur-md flex flex-row items-center justify-between sm:justify-end gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-9 px-4 text-xs font-medium"
          >
            বাতিল
          </Button>
          <Button
            type="submit"
            form="edit-order-form"
            size="sm"
            disabled={submitting}
            className="h-9 px-4 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> সেভ হচ্ছে...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" /> পরিবর্তন সেভ করুন
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
