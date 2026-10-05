'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  PlusCircle,
  Package,
  Phone,
  User,
  MapPin,
  CreditCard,
  ShieldAlert,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  Barcode,
  Sparkles,
  Camera,
  Truck,
  FileText,
  X,
  Minus,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { CameraBarcodeScannerModal } from '@/components/common/camera-barcode-scanner-modal';

interface ProductItem {
  id: string;
  name: string;
  price: number;
  sku?: string | null;
  barcode?: string | null;
  stock_quantity?: number;
  variants?: Array<{ id: string; name: string; price?: number; barcode?: string | null; sku?: string | null }>;
  colors?: string[];
  tier_pricing?: Array<{ quantity: number; price: number; label?: string; badge?: string }>;
}

interface CreateOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateOrderDialog({ open, onOpenChange, onSuccess }: CreateOrderDialogProps) {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Form fields
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [thana, setThana] = useState('');
  const [district, setDistrict] = useState('Dhaka');

  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedProductName, setSelectedProductName] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [variant, setVariant] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [deliveryCharge, setDeliveryCharge] = useState<number>(60);

  // Advance Payment
  const [hasAdvance, setHasAdvance] = useState(false);
  const [advancePaid, setAdvancePaid] = useState<number>(0);
  const [advanceMethod, setAdvanceMethod] = useState('bkash');
  const [advanceTrxId, setAdvanceTrxId] = useState('');

  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fraud check
  const [fraudScore, setFraudScore] = useState<any>(null);
  const [checkingFraud, setCheckingFraud] = useState(false);

  // Load products
  useEffect(() => {
    if (open) {
      setLoadingProducts(true);
      fetch('/api/products')
        .then((res) => res.json())
        .then((data) => {
          if (data?.products) {
            setProducts(data.products);
            if (data.products.length > 0 && !selectedProductId) {
              const first = data.products[0];
              setSelectedProductId(first.id);
              setSelectedProductName(first.name);
              setUnitPrice(Number(first.price) || 0);
              if (first.variants && first.variants.length > 0) {
                setVariant(first.variants[0].name);
              } else if (first.colors && first.colors.length > 0) {
                setVariant(first.colors[0]);
              }
            }
          }
        })
        .catch(() => {})
        .finally(() => setLoadingProducts(false));
    }
  }, [open, selectedProductId]);

  // Phone Fraud Check
  const checkCustomerFraud = useCallback(async (num: string) => {
    const clean = num.replace(/\D/g, '').replace(/^(8801|880)/, (m) => (m === '8801' ? '01' : '0'));
    if (!clean || clean.length < 11) {
      setFraudScore(null);
      return;
    }

    setCheckingFraud(true);
    try {
      const res = await fetch(`/api/courier/fraud-check?phone=${encodeURIComponent(clean)}`);
      const data = await res.json();
      if (res.ok && data.fraud_check) {
        setFraudScore(data.fraud_check);
      } else {
        setFraudScore(null);
      }
    } catch {
      setFraudScore(null);
    } finally {
      setCheckingFraud(false);
    }
  }, []);

  const handlePhoneChange = (val: string) => {
    setCustomerPhone(val);
    const clean = val.replace(/\D/g, '');
    if (clean.length === 11) {
      checkCustomerFraud(val);
    }
  };

  const handleProductSelect = (prodId: string) => {
    setSelectedProductId(prodId);
    const prod = products.find((p) => p.id === prodId);
    if (prod) {
      setSelectedProductName(prod.name);
      let initialPrice = Number(prod.price) || 0;
      if (prod.variants && prod.variants.length > 0) {
        setVariant(prod.variants[0].name);
        if (prod.variants[0].price) {
          initialPrice = Number(prod.variants[0].price);
        }
      } else if (prod.colors && prod.colors.length > 0) {
        setVariant(prod.colors[0]);
      } else {
        setVariant('Standard');
      }
      setUnitPrice(initialPrice);
    }
  };

  const handleBarcodeScan = (code: string) => {
    setBarcodeInput(code);
    const clean = code.trim().toLowerCase();
    if (!clean) return;

    for (const p of products) {
      if (p.barcode?.toLowerCase() === clean || p.sku?.toLowerCase() === clean) {
        handleProductSelect(p.id);
        toast.success(`🎯 বারকোড ম্যাচ: ${p.name}`);
        return;
      }
      if (p.variants) {
        const vMatch = p.variants.find(
          (v) => v.barcode?.toLowerCase() === clean || v.sku?.toLowerCase() === clean
        );
        if (vMatch) {
          setSelectedProductId(p.id);
          setSelectedProductName(p.name);
          setVariant(vMatch.name);
          setUnitPrice(vMatch.price ? Number(vMatch.price) : Number(p.price));
          toast.success(`🎯 ভ্যারিয়েন্ট ম্যাচ: ${p.name} (${vMatch.name})`);
          return;
        }
      }
    }
  };

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  // Active Tier Pricing
  const matchedTier = useMemo(() => {
    if (!selectedProduct?.tier_pricing || selectedProduct.tier_pricing.length === 0) return null;
    const sorted = [...selectedProduct.tier_pricing].sort((a, b) => Number(b.quantity) - Number(a.quantity));
    return sorted.find((t) => quantity >= Number(t.quantity)) || null;
  }, [selectedProduct, quantity]);

  useEffect(() => {
    if (selectedProduct && matchedTier && Number(matchedTier.price) > 0) {
      setUnitPrice(Number(matchedTier.price));
    }
  }, [matchedTier, selectedProduct]);

  // Calculations
  const subtotal = unitPrice * quantity;
  const totalAmount = subtotal + Number(deliveryCharge || 0);
  const codDue = Math.max(0, totalAmount - (hasAdvance ? Number(advancePaid || 0) : 0));

  const resetForm = () => {
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setThana('');
    setDistrict('Dhaka');
    setQuantity(1);
    setDeliveryCharge(60);
    setHasAdvance(false);
    setAdvancePaid(0);
    setAdvanceTrxId('');
    setNotes('');
    setFraudScore(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerPhone.trim()) {
      toast.error('Customer phone number is required');
      return;
    }
    if (!customerName.trim()) {
      toast.error('Customer name is required');
      return;
    }
    if (!selectedProductName.trim()) {
      toast.error('Please select or specify a product');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerAddress: customerAddress.trim(),
          thana: thana.trim() || null,
          district: district.trim() || null,
          productId: selectedProductId || null,
          productName: selectedProductName.trim(),
          variant: variant.trim() || 'Standard',
          quantity,
          unitPrice,
          deliveryCharge: Number(deliveryCharge || 0),
          advancePaid: hasAdvance ? Number(advancePaid || 0) : 0,
          advanceMethod: hasAdvance ? advanceMethod : null,
          advanceTrxId: hasAdvance ? advanceTrxId.trim() : null,
          status: 'NEW',
          notes: notes.trim() || null,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`অর্ডার তৈরি সম্পন্ন হয়েছে! (#${data.order?.invoice_no || data.order?.id?.slice(0, 8)})`);
        resetForm();
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(data.error || 'Failed to create order');
      }
    } catch {
      toast.error('Network error creating order');
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
              <PlusCircle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                নতুন অর্ডার তৈরি করুন
                <Badge variant="outline" className="hidden sm:inline-flex text-[10px] font-semibold text-primary border-primary/30">
                  Manual Entry
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground truncate mt-0.5">
                গ্রাহকের নাম, ঠিকানা, পণ্য নির্বাচন ও ডেলিভারি হিসাব
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Form Body */}
        <form id="create-order-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Section 1: Customer Details */}
          <div className="rounded-xl border border-border/70 bg-card p-3.5 sm:p-4 space-y-3.5 shadow-xs">
            <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-primary" /> গ্রাহকের বিবরণ
              </span>

              {/* Fraud Check Indicator */}
              {checkingFraud ? (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1.5 animate-pulse">
                  <Loader2 className="h-3 w-3 animate-spin text-primary" /> ফ্রড যাচাই হচ্ছে...
                </span>
              ) : fraudScore ? (
                <Badge
                  variant="outline"
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    fraudScore.level === 'high' || fraudScore.doubtful_reports > 0
                      ? 'border-red-500 bg-red-500/10 text-red-600 dark:text-red-400'
                      : fraudScore.level === 'medium'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      : 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {fraudScore.level === 'high' ? (
                    <ShieldAlert className="mr-1 h-3 w-3" />
                  ) : (
                    <ShieldCheck className="mr-1 h-3 w-3" />
                  )}
                  {fraudScore.level?.toUpperCase()} RISK (Steadfast)
                </Badge>
              ) : null}
            </div>

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
                    placeholder="017XXXXXXXX"
                    value={customerPhone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    required
                    className="pl-9 h-9 text-xs font-mono rounded-lg"
                  />
                </div>
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  গ্রাহকের পূর্ণ নাম <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="যেমন: Rahim Ahmed"
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
                  placeholder="বাড়ি/ফ্ল্যাট নম্বর, রোড, এলাকা..."
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
                <select
                  value={district}
                  onChange={(e) => {
                    const d = e.target.value;
                    setDistrict(d);
                    if (d.toLowerCase() === 'dhaka') {
                      setDeliveryCharge(60);
                    } else {
                      setDeliveryCharge(120);
                    }
                  }}
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="Dhaka">Dhaka (ঢাকা - ৳৬০)</option>
                  <option value="Gazipur">Gazipur (গাজীপুর - ৳১২০)</option>
                  <option value="Narayanganj">Narayanganj (নারায়ণগঞ্জ - ৳১২০)</option>
                  <option value="Chattogram">Chattogram (চট্টগ্রাম - ৳১২০)</option>
                  <option value="Sylhet">Sylhet (সিলেট - ৳১২০)</option>
                  <option value="Rajshahi">Rajshahi (রাজশাহী - ৳১২০)</option>
                  <option value="Khulna">Khulna (খুলনা - ৳১২০)</option>
                  <option value="Barishal">Barishal (বরিশাল - ৳১২০)</option>
                  <option value="Rangpur">Rangpur (রংপুর - ৳১২০)</option>
                  <option value="Mymensingh">Mymensingh (ময়মনসিংহ - ৳১২০)</option>
                  <option value="Cumilla">Cumilla (কুমিল্লা - ৳১২০)</option>
                  <option value="Bogura">Bogura (বগুড়া - ৳১২০)</option>
                  <option value="Other">Other / অন্যান্য জেলা (৳১২০)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">থানা / উপজেলা (Thana)</Label>
                <Input
                  placeholder="যেমন: Mirpur / Dhanmondi"
                  value={thana}
                  onChange={(e) => setThana(e.target.value)}
                  className="h-9 text-xs rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Product & Pricing */}
          <div className="rounded-xl border border-border/70 bg-card p-3.5 sm:p-4 space-y-3.5 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2 border-b border-border/40 pb-2">
              <Package className="h-3.5 w-3.5 text-primary" /> প্রোডাক্ট ও মূল্য
            </span>

            {/* Quick Barcode Scan Bar */}
            <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="font-semibold flex items-center gap-1.5 text-foreground">
                  <Barcode className="h-3.5 w-3.5 text-primary" /> দ্রুত বারকোড / SKU স্ক্যানার:
                </span>
                <span>লেজার ও ক্যামেরা সাপোর্টেড</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="বারকোড স্ক্যান বা SKU লিখুন..."
                    value={barcodeInput}
                    onChange={(e) => handleBarcodeScan(e.target.value)}
                    className="pl-9 pr-8 h-8 text-xs font-mono bg-background rounded-md"
                  />
                  {barcodeInput && (
                    <button
                      type="button"
                      onClick={() => setBarcodeInput('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCameraOpen(true)}
                  className="h-8 text-xs gap-1 border-primary/40 text-primary hover:bg-primary/10 shrink-0"
                >
                  <Camera className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">ক্যামেরা স্ক্যান</span>
                </Button>
              </div>
            </div>

            {/* Product selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1">
                প্রোডাক্ট নির্বাচন করুন <span className="text-red-500">*</span>
              </Label>
              {loadingProducts ? (
                <div className="h-9 flex items-center px-3 rounded-lg border bg-muted/30 text-xs text-muted-foreground gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> প্রোডাক্ট লোড হচ্ছে...
                </div>
              ) : products.length > 0 ? (
                <select
                  value={selectedProductId}
                  onChange={(e) => handleProductSelect(e.target.value)}
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring font-medium"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — ৳{p.price} {p.stock_quantity !== undefined ? `(স্টক: ${p.stock_quantity})` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  placeholder="প্রোডাক্টের নাম"
                  value={selectedProductName}
                  onChange={(e) => setSelectedProductName(e.target.value)}
                  required
                  className="h-9 text-xs rounded-lg"
                />
              )}
            </div>

            {/* Variant, Quantity, Unit Price Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Variant */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">ভ্যারিয়েন্ট / সাইজ</Label>
                {selectedProduct?.variants && selectedProduct.variants.length > 0 ? (
                  <select
                    value={variant}
                    onChange={(e) => setVariant(e.target.value)}
                    className="w-full h-9 rounded-lg border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {selectedProduct.variants.map((v) => (
                      <option key={v.id} value={v.name}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                ) : selectedProduct?.colors && selectedProduct.colors.length > 0 ? (
                  <select
                    value={variant}
                    onChange={(e) => setVariant(e.target.value)}
                    className="w-full h-9 rounded-lg border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {selectedProduct.colors.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    placeholder="Standard"
                    value={variant}
                    onChange={(e) => setVariant(e.target.value)}
                    className="h-9 text-xs rounded-lg"
                  />
                )}
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

            {/* Active Tier Pricing Notification */}
            {matchedTier && (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2.5 flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 shrink-0" />
                  <div>
                    <span className="font-bold">টিয়ার ডিসকাউন্ট প্রয়োগ হয়েছে!</span>
                    <p className="text-[11px] opacity-90">
                      {matchedTier.label || `${matchedTier.quantity}+ টি নিলে বিশেষ হোলসেল মূল্য`}
                    </p>
                  </div>
                </div>
                <span className="font-mono font-bold text-xs bg-emerald-500/20 px-2 py-0.5 rounded-full">
                  ৳{matchedTier.price} /পিস
                </span>
              </div>
            )}

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

          {/* Section 3: Advance Payment */}
          <div className="rounded-xl border border-border/70 bg-card p-3.5 sm:p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer text-foreground">
                <input
                  type="checkbox"
                  checked={hasAdvance}
                  onChange={(e) => {
                    setHasAdvance(e.target.checked);
                    if (e.target.checked && advancePaid === 0) setAdvancePaid(100);
                  }}
                  className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                />
                <CreditCard className="h-3.5 w-3.5 text-emerald-600" />
                অগ্রিম পেমেন্ট আছে (Advance Payment)
              </label>
              {hasAdvance && (
                <span className="text-xs text-emerald-600 font-bold font-mono">
                  - ৳{advancePaid}
                </span>
              )}
            </div>

            {hasAdvance && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 animate-in fade-in slide-in-from-top-1">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold">অগ্রিম টাকা (৳)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={advancePaid}
                    onChange={(e) => setAdvancePaid(Number(e.target.value) || 0)}
                    className="h-8 text-xs font-mono font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold">পেমেন্ট মেথড</Label>
                  <select
                    value={advanceMethod}
                    onChange={(e) => setAdvanceMethod(e.target.value)}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs font-medium"
                  >
                    <option value="bkash">bKash (বিকাশ)</option>
                    <option value="nagad">Nagad (নগদ)</option>
                    <option value="rocket">Rocket (রকেট)</option>
                    <option value="bank">Bank / Other</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold">TrxID (ঐচ্ছিক)</Label>
                  <Input
                    placeholder="যেমন: 9J7K3L2P"
                    value={advanceTrxId}
                    onChange={(e) => setAdvanceTrxId(e.target.value)}
                    className="h-8 text-xs font-mono uppercase"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
              <FileText className="h-3.5 w-3.5" /> অর্ডার নোট / নির্দেশনা (Optional)
            </Label>
            <Input
              placeholder="যেমন: বিকেলে ডেলিভারি দিতে হবে / কাস্টমার কল রিসিভ করবেন ৫টায়..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-8 text-xs rounded-lg"
            />
          </div>

          {/* Section 5: Real-time Calculation Summary Bar */}
          <div className="rounded-xl bg-primary/10 border border-primary/20 p-3 sm:p-4 space-y-2 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>সাবটোটাল ({quantity} × ৳{unitPrice}):</span>
              <span className="font-mono text-foreground font-semibold">৳{subtotal.toLocaleString('en-BD')}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>ডেলিভারি চার্জ:</span>
              <span className="font-mono text-foreground">৳{deliveryCharge}</span>
            </div>
            {hasAdvance && advancePaid > 0 && (
              <div className="flex justify-between text-emerald-600 font-semibold">
                <span>অগ্রিম পরিশোধ:</span>
                <span className="font-mono">- ৳{advancePaid}</span>
              </div>
            )}
            <div className="flex justify-between items-center border-t border-primary/20 pt-2 font-bold text-sm">
              <span className="text-foreground">কুরিয়ারে আদায়যোগ্য (Net COD):</span>
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
            form="create-order-form"
            size="sm"
            disabled={submitting}
            className="h-9 px-4 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> তৈরি হচ্ছে...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" /> নিশ্চিত করুন ও অর্ডার সেভ করুন
              </>
            )}
          </Button>
        </DialogFooter>

        <CameraBarcodeScannerModal
          isOpen={isCameraOpen}
          onClose={() => setIsCameraOpen(false)}
          onScan={(code) => {
            handleBarcodeScan(code);
          }}
          title="অর্ডার প্রোডাক্ট বারকোড স্ক্যানার"
          description="পণ্যের বক্স বা ট্যাগের বারকোড স্ক্যান করুন"
        />
      </DialogContent>
    </Dialog>
  );
}
