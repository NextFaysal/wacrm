'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Truck,
  Building2,
  Plus,
  Trash2,
  PackageCheck,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  Ban,
  FileText,
  DollarSign,
  AlertCircle,
  Eye,
} from 'lucide-react';
import type { Product } from '@/types/watch';
import { toast } from 'sonner';

export interface Supplier {
  id: string;
  name: string;
  company_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  total_orders?: number;
  created_at?: string;
}

export interface PurchaseOrderItem {
  product_id: string;
  product_name: string;
  variant_id?: string | null;
  variant_name?: string | null;
  sku?: string | null;
  quantity: number;
  unit_cost: number;
  total_cost: number;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id?: string | null;
  suppliers?: {
    id: string;
    name: string;
    company_name?: string | null;
    phone?: string | null;
  } | null;
  status: 'draft' | 'ordered' | 'received' | 'cancelled';
  items: PurchaseOrderItem[];
  subtotal: number;
  shipping_cost: number;
  tax: number;
  total_amount: number;
  paid_amount: number;
  payment_status: 'unpaid' | 'partially_paid' | 'paid';
  expected_delivery_date?: string | null;
  received_at?: string | null;
  notes?: string | null;
  created_at: string;
}

interface SupplierPoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  onStockUpdated?: () => void;
}

export function SupplierPoModal({
  open,
  onOpenChange,
  products,
  onStockUpdated,
}: SupplierPoModalProps) {
  const [activeTab, setActiveTab] = useState<'pos' | 'suppliers'>('pos');
  const [loading, setLoading] = useState(false);

  // Suppliers state
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    company_name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  });

  // POs state
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [poFilterStatus, setPoFilterStatus] = useState<string>('all');
  const [isCreatingPo, setIsCreatingPo] = useState(false);
  const [viewingPo, setViewingPo] = useState<PurchaseOrder | null>(null);

  // PO Form state
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [poItems, setPoItems] = useState<PurchaseOrderItem[]>([]);
  const [shippingCost, setShippingCost] = useState('0');
  const [paidAmount, setPaidAmount] = useState('0');
  const [poNotes, setPoNotes] = useState('');
  const [selectedProductToAdd, setSelectedProductToAdd] = useState('');
  const [selectedVariantToAdd, setSelectedVariantToAdd] = useState('');
  const [itemQuantity, setItemQuantity] = useState('10');
  const [itemUnitCost, setItemUnitCost] = useState('');

  // Fetch Suppliers
  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await fetch('/api/suppliers');
      const data = await res.json();
      if (res.ok && data.suppliers) {
        setSuppliers(data.suppliers);
      }
    } catch {
      toast.error('সাপ্লায়ার লিস্ট লোড করা সম্ভব হয়নি');
    }
  }, []);

  // Fetch Purchase Orders
  const fetchPurchaseOrders = useCallback(async () => {
    try {
      setLoading(true);
      const url =
        poFilterStatus === 'all'
          ? '/api/purchase-orders'
          : `/api/purchase-orders?status=${poFilterStatus}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && data.purchaseOrders) {
        setPurchaseOrders(data.purchaseOrders);
      }
    } catch {
      toast.error('পারচেজ অর্ডার লোড করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  }, [poFilterStatus]);

  useEffect(() => {
    if (open) {
      fetchSuppliers();
      fetchPurchaseOrders();
    }
  }, [open, fetchSuppliers, fetchPurchaseOrders]);

  // Create Supplier
  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierForm.name.trim()) {
      toast.error('সাপ্লায়ারের নাম প্রদান করুন');
      return;
    }

    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(supplierForm),
      });

      if (res.ok) {
        toast.success('সাপ্লায়ার সফলভাবে সংরক্ষণ করা হয়েছে');
        setIsAddingSupplier(false);
        setSupplierForm({ name: '', company_name: '', phone: '', email: '', address: '', notes: '' });
        fetchSuppliers();
      } else {
        const data = await res.json();
        toast.error(data.error || 'সাপ্লায়ার সেভ করতে ব্যর্থ');
      }
    } catch {
      toast.error('নেটওয়ার্ক সমস্যা');
    }
  };

  // Add Item to PO
  const handleAddItemToPo = () => {
    const prod = products.find((p) => p.id === selectedProductToAdd);
    if (!prod) {
      toast.error('প্রোডাক্ট সিলেক্ট করুন');
      return;
    }

    const qty = parseInt(itemQuantity, 10);
    const unitCost = parseFloat(itemUnitCost) || Number(prod.price) * 0.7 || 0; // Default estimate 70% cost

    if (isNaN(qty) || qty <= 0) {
      toast.error('সঠিক সংখ্যা (Quantity) দিন');
      return;
    }

    let variantName = null;
    let variantSku = prod.sku || null;
    if (selectedVariantToAdd && prod.variants) {
      const v = prod.variants.find((vr) => vr.id === selectedVariantToAdd);
      if (v) {
        variantName = v.name;
        if (v.sku) variantSku = v.sku;
      }
    }

    const newItem: PurchaseOrderItem = {
      product_id: prod.id,
      product_name: prod.name,
      variant_id: selectedVariantToAdd || null,
      variant_name: variantName,
      sku: variantSku,
      quantity: qty,
      unit_cost: unitCost,
      total_cost: qty * unitCost,
    };

    setPoItems([...poItems, newItem]);
    setSelectedProductToAdd('');
    setSelectedVariantToAdd('');
    setItemQuantity('10');
    setItemUnitCost('');
  };

  // Remove Item from PO
  const handleRemoveItem = (index: number) => {
    setPoItems(poItems.filter((_, i) => i !== index));
  };

  // Calculate PO Totals
  const subtotal = poItems.reduce((acc, it) => acc + it.total_cost, 0);
  const totalAmount = subtotal + (parseFloat(shippingCost) || 0);

  // Save Purchase Order
  const handleCreatePo = async (status: 'draft' | 'ordered') => {
    if (poItems.length === 0) {
      toast.error('কমপক্ষে একটি প্রোডাক্ট আইটেম যোগ করুন');
      return;
    }

    try {
      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: selectedSupplierId || null,
          po_number: poNumber || undefined,
          status,
          items: poItems,
          shipping_cost: parseFloat(shippingCost) || 0,
          paid_amount: parseFloat(paidAmount) || 0,
          notes: poNotes,
        }),
      });

      if (res.ok) {
        toast.success(
          status === 'ordered'
            ? 'পারচেজ অর্ডার পাঠানো ও সংরক্ষিত হয়েছে!'
            : 'ড্রাফট হিসেবে সংরক্ষিত হয়েছে'
        );
        setIsCreatingPo(false);
        setPoItems([]);
        setSelectedSupplierId('');
        setPoNotes('');
        setShippingCost('0');
        setPaidAmount('0');
        fetchPurchaseOrders();
      } else {
        const data = await res.json();
        toast.error(data.error || 'PO তৈরিতে ব্যর্থ');
      }
    } catch {
      toast.error('নেটওয়ার্ক সমস্যা');
    }
  };

  // Receive PO (Stock In)
  const handleReceivePo = async (po: PurchaseOrder) => {
    if (po.status === 'received') return;
    const confirmReceive = window.confirm(
      `PO #${po.po_number} এর সব প্রোডাক্ট স্টক ইন (Stock In) করতে চান? এটি প্রোডাক্টের স্টক স্বয়ংক্রিয়ভাবে বৃদ্ধি করবে।`
    );
    if (!confirmReceive) return;

    try {
      const res = await fetch('/api/purchase-orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: po.id,
          status: 'received',
        }),
      });

      if (res.ok) {
        toast.success(`PO #${po.po_number} সফলভাবে রিসিভ হয়েছে এবং স্টক আপডেট হয়েছে!`);
        fetchPurchaseOrders();
        if (onStockUpdated) onStockUpdated();
      } else {
        const data = await res.json();
        toast.error(data.error || 'PO রিসিভ করতে সমস্যা হয়েছে');
      }
    } catch {
      toast.error('সার্ভারে যোগাযোগ করা যায়নি');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-background rounded-2xl border shadow-2xl">
        <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 text-primary rounded-xl shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg sm:text-xl font-bold truncate">
                  সাপ্লায়ার ও পারচেজ অর্ডার (PO)
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5 truncate">
                  সাপ্লায়ারদের থেকে পাইকারি প্রোডাক্ট অর্ডার, ট্র্যাকিং এবং স্বয়ংক্রিয় স্টক-ইন
                </DialogDescription>
              </div>
            </div>

            {/* Nav Switcher */}
            <div className="flex bg-muted/60 p-1 rounded-xl border gap-1 self-start sm:self-auto shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('pos')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  activeTab === 'pos'
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                পারচেজ অর্ডারসমূহ
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('suppliers')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  activeTab === 'suppliers'
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                সাপ্লায়ার তালিকা ({suppliers.length})
              </button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          {/* TAB 1: PURCHASE ORDERS */}
          {activeTab === 'pos' && (
            <div className="space-y-4">
              {!isCreatingPo ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {['all', 'draft', 'ordered', 'received'].map((st) => (
                        <Button
                          key={st}
                          variant={poFilterStatus === st ? 'default' : 'outline'}
                          size="sm"
                          className="h-8 text-xs capitalize"
                          onClick={() => setPoFilterStatus(st)}
                        >
                          {st === 'all'
                            ? 'সব'
                            : st === 'draft'
                            ? 'ড্রাফট'
                            : st === 'ordered'
                            ? 'অর্ডার পাঠানো'
                            : 'রিসিভড'}
                        </Button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={fetchPurchaseOrders}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        রিফ্রেশ
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 gap-1.5 text-xs font-semibold"
                        onClick={() => setIsCreatingPo(true)}
                      >
                        <Plus className="w-4 h-4" />
                        নতুন PO তৈরি করুন
                      </Button>
                    </div>
                  </div>

                  {loading ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 opacity-50" />
                      পারচেজ অর্ডার লোড হচ্ছে...
                    </div>
                  ) : purchaseOrders.length === 0 ? (
                    <div className="py-12 border border-dashed rounded-xl text-center bg-muted/20">
                      <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm font-medium text-foreground">
                        কোন পারচেজ অর্ডার পাওয়া যায়নি
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                        সাপ্লায়ারকে প্রোডাক্ট কেনার রিকুইজিশন পাঠাতে &quot;নতুন PO তৈরি করুন&quot; বাটনে ক্লিক করুন।
                      </p>
                    </div>
                  ) : (
                    <div className="border rounded-xl divide-y bg-card overflow-hidden">
                      {purchaseOrders.map((po) => (
                        <div
                          key={po.id}
                          className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/40 transition-colors"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2.5">
                              <span className="font-mono font-bold text-sm text-foreground">
                                #{po.po_number}
                              </span>
                              <Badge
                                variant={
                                  po.status === 'received'
                                    ? 'default'
                                    : po.status === 'ordered'
                                    ? 'secondary'
                                    : 'outline'
                                }
                                className={`text-[10px] uppercase font-semibold ${
                                  po.status === 'received'
                                    ? 'bg-emerald-600/15 text-emerald-600 border-emerald-500/20'
                                    : po.status === 'ordered'
                                    ? 'bg-blue-600/15 text-blue-600 border-blue-500/20'
                                    : ''
                                }`}
                              >
                                {po.status === 'received' ? (
                                  <span className="flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> রিসিভড
                                  </span>
                                ) : po.status === 'ordered' ? (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> অর্ডার পাঠানো
                                  </span>
                                ) : (
                                  'ড্রাফট'
                                )}
                              </Badge>
                              {po.payment_status === 'paid' && (
                                <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                                  পরিশোধিত
                                </Badge>
                              )}
                            </div>

                            <p className="text-xs text-muted-foreground">
                              সাপ্লায়ার:{' '}
                              <span className="font-medium text-foreground">
                                {po.suppliers?.name || 'অজ্ঞাত সাপ্লায়ার'}
                              </span>
                              {po.suppliers?.company_name ? ` (${po.suppliers.company_name})` : ''} •{' '}
                              {Array.isArray(po.items) ? po.items.length : 0} টি আইটেম
                            </p>
                            <p className="text-[11px] text-muted-foreground/75">
                              তারিখ: {new Date(po.created_at).toLocaleDateString('bn-BD')}
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">মোট খরচ</p>
                              <p className="text-base font-bold text-foreground">
                                ৳{po.total_amount?.toLocaleString() || 0}
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                title="ডিটেইলস দেখুন"
                                onClick={() => setViewingPo(po)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>

                              {po.status !== 'received' && (
                                <Button
                                  size="sm"
                                  className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                  onClick={() => handleReceivePo(po)}
                                >
                                  <PackageCheck className="w-3.5 h-3.5" />
                                  রিসিভ করুন
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                /* PO CREATION FORM */
                <div className="space-y-5 bg-card p-5 border rounded-xl">
                  <div className="flex items-center justify-between border-b pb-3">
                    <h3 className="font-bold text-base flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" /> নতুন পারচেজ অর্ডার তৈরি
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsCreatingPo(false)}
                      className="text-xs"
                    >
                      বাতিল
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-semibold">সাপ্লায়ার নির্বাচন করুন</Label>
                      <select
                        value={selectedSupplierId}
                        onChange={(e) => setSelectedSupplierId(e.target.value)}
                        className="w-full mt-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="">-- সাপ্লায়ার পছন্দ করুন --</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} {s.company_name ? `(${s.company_name})` : ''} - {s.phone || ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold">PO নাম্বার (ঐচ্ছিক)</Label>
                      <Input
                        placeholder="e.g. PO-2026-001"
                        value={poNumber}
                        onChange={(e) => setPoNumber(e.target.value)}
                        className="h-9 mt-1 text-sm"
                      />
                    </div>
                  </div>

                  {/* Add Product Items */}
                  <div className="border rounded-lg p-3 bg-muted/20 space-y-3">
                    <Label className="text-xs font-bold text-foreground">
                      প্রোডাক্ট আইটেম যোগ করুন
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <div className="sm:col-span-5">
                        <select
                          value={selectedProductToAdd}
                          onChange={(e) => {
                            setSelectedProductToAdd(e.target.value);
                            const p = products.find((prod) => prod.id === e.target.value);
                            if (p) {
                              setItemUnitCost(String(Math.round(Number(p.price) * 0.7)));
                            }
                          }}
                          className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1"
                        >
                          <option value="">-- প্রোডাক্ট বেছে নিন --</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} (বর্তমান স্টক: {p.stock_quantity ?? 0})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <Input
                          type="number"
                          placeholder="পরিমাণ"
                          value={itemQuantity}
                          onChange={(e) => setItemQuantity(e.target.value)}
                          className="h-9 text-xs"
                          min="1"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <Input
                          type="number"
                          placeholder="কেনা দর (Unit Cost ৳)"
                          value={itemUnitCost}
                          onChange={(e) => setItemUnitCost(e.target.value)}
                          className="h-9 text-xs"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <Button
                          type="button"
                          variant="secondary"
                          className="w-full h-9 text-xs gap-1 font-semibold"
                          onClick={handleAddItemToPo}
                        >
                          <Plus className="w-3.5 h-3.5" /> যোগ
                        </Button>
                      </div>
                    </div>

                    {/* Items Table */}
                    {poItems.length > 0 && (
                      <div className="border rounded-md divide-y bg-background overflow-hidden mt-3">
                        <div className="grid grid-cols-12 px-3 py-2 bg-muted/50 text-[11px] font-semibold text-muted-foreground">
                          <div className="col-span-6">প্রোডাক্ট</div>
                          <div className="col-span-2 text-center">পরিমাণ</div>
                          <div className="col-span-2 text-right">একক দর</div>
                          <div className="col-span-2 text-right">মোট</div>
                        </div>
                        {poItems.map((item, idx) => (
                          <div
                            key={idx}
                            className="grid grid-cols-12 px-3 py-2.5 items-center text-xs"
                          >
                            <div className="col-span-6 font-medium truncate">
                              {item.product_name}
                              {item.variant_name && (
                                <span className="text-muted-foreground text-[11px] block">
                                  ({item.variant_name})
                                </span>
                              )}
                            </div>
                            <div className="col-span-2 text-center font-bold">
                              {item.quantity}
                            </div>
                            <div className="col-span-2 text-right font-mono">
                              ৳{item.unit_cost.toLocaleString()}
                            </div>
                            <div className="col-span-2 flex items-center justify-end gap-2 font-mono font-bold">
                              ৳{item.total_cost.toLocaleString()}
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Summary & Pricing */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                      <Label className="text-xs">নোট / বিশেষ নির্দেশনা</Label>
                      <Input
                        placeholder="পেমেন্ট বা ডেলিভারি বিষয়ক নোট..."
                        value={poNotes}
                        onChange={(e) => setPoNotes(e.target.value)}
                        className="h-9 mt-1 text-xs"
                      />
                    </div>

                    <div className="bg-muted/40 p-3 rounded-lg space-y-2 text-xs">
                      <div className="flex justify-between text-muted-foreground">
                        <span>আইটেম সাবটোটাল:</span>
                        <span className="font-mono font-medium">৳{subtotal.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">পরিবহন / শিপিং খরচ:</span>
                        <Input
                          type="number"
                          value={shippingCost}
                          onChange={(e) => setShippingCost(e.target.value)}
                          className="h-7 w-28 text-right font-mono text-xs"
                        />
                      </div>
                      <div className="flex justify-between border-t pt-2 text-sm font-bold text-foreground">
                        <span>সর্বমোট খরচ (Total):</span>
                        <span className="text-primary font-mono">৳{totalAmount.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 border-t pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCreatePo('draft')}
                    >
                      ড্রাফট হিসেবে রাখুন
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5 font-bold"
                      onClick={() => handleCreatePo('ordered')}
                    >
                      <Truck className="w-4 h-4" />
                      PO নিশ্চিত করুন (Order)
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SUPPLIERS */}
          {activeTab === 'suppliers' && (
            <div className="space-y-4">
              {!isAddingSupplier ? (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      মোট সাপ্লায়ার: <span className="font-bold text-foreground">{suppliers.length}</span> জন
                    </p>
                    <Button
                      size="sm"
                      className="h-8 gap-1.5 text-xs font-semibold"
                      onClick={() => setIsAddingSupplier(true)}
                    >
                      <Plus className="w-4 h-4" />
                      নতুন সাপ্লায়ার যোগ করুন
                    </Button>
                  </div>

                  {suppliers.length === 0 ? (
                    <div className="py-12 border border-dashed rounded-xl text-center bg-muted/20">
                      <Building2 className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm font-medium text-foreground">
                        কোন সাপ্লায়ার সংরক্ষিত নেই
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        পাইকারি বিক্রেতা বা মার্চেন্টের তথ্য সংরক্ষণ করতে &quot;নতুন সাপ্লায়ার যোগ করুন&quot; বাটনে ক্লিক করুন।
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {suppliers.map((sup) => (
                        <div
                          key={sup.id}
                          className="border rounded-xl p-4 bg-card hover:border-primary/40 transition-colors space-y-2"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-bold text-sm text-foreground">{sup.name}</h4>
                              {sup.company_name && (
                                <p className="text-xs text-muted-foreground font-medium">
                                  {sup.company_name}
                                </p>
                              )}
                            </div>
                            <Badge variant="outline" className="text-[10px]">
                              {sup.total_orders || 0} টি PO
                            </Badge>
                          </div>

                          <div className="text-xs text-muted-foreground space-y-1 pt-1 border-t">
                            {sup.phone && (
                              <p>
                                ফোন: <span className="font-mono text-foreground">{sup.phone}</span>
                              </p>
                            )}
                            {sup.email && <p>ইমেইল: {sup.email}</p>}
                            {sup.address && <p>ঠিকানা: {sup.address}</p>}
                          </div>

                          <div className="pt-2 flex justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-primary gap-1"
                              onClick={() => {
                                setSelectedSupplierId(sup.id);
                                setIsCreatingPo(true);
                                setActiveTab('pos');
                              }}
                            >
                              <Plus className="w-3 h-3" /> PO তৈরি করুন
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                /* ADD SUPPLIER FORM */
                <form onSubmit={handleSaveSupplier} className="space-y-4 bg-card p-5 border rounded-xl">
                  <div className="flex items-center justify-between border-b pb-3">
                    <h3 className="font-bold text-base flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-primary" /> নতুন সাপ্লায়ার নিবন্ধন
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsAddingSupplier(false)}
                      className="text-xs"
                    >
                      বাতিল
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-semibold">সাপ্লায়ারের নাম *</Label>
                      <Input
                        required
                        placeholder="যেমন: মোঃ রফিকুল ইসলাম"
                        value={supplierForm.name}
                        onChange={(e) =>
                          setSupplierForm({ ...supplierForm, name: e.target.value })
                        }
                        className="h-9 mt-1 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">কোম্পানি / শপের নাম</Label>
                      <Input
                        placeholder="যেমন: ঢাকা পাইকারি ট্রেডার্স"
                        value={supplierForm.company_name}
                        onChange={(e) =>
                          setSupplierForm({ ...supplierForm, company_name: e.target.value })
                        }
                        className="h-9 mt-1 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">মোবাইল ফোন</Label>
                      <Input
                        placeholder="01XXXXXXXXX"
                        value={supplierForm.phone}
                        onChange={(e) =>
                          setSupplierForm({ ...supplierForm, phone: e.target.value })
                        }
                        className="h-9 mt-1 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">ইমেইল</Label>
                      <Input
                        type="email"
                        placeholder="supplier@example.com"
                        value={supplierForm.email}
                        onChange={(e) =>
                          setSupplierForm({ ...supplierForm, email: e.target.value })
                        }
                        className="h-9 mt-1 text-xs"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs font-semibold">ঠিকানা / গোডাউন</Label>
                      <Input
                        placeholder="দোকান নং, মার্কেট, চকবাজার, ঢাকা"
                        value={supplierForm.address}
                        onChange={(e) =>
                          setSupplierForm({ ...supplierForm, address: e.target.value })
                        }
                        className="h-9 mt-1 text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 border-t pt-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsAddingSupplier(false)}
                    >
                      বাতিল
                    </Button>
                    <Button type="submit" size="sm" className="font-semibold">
                      সংরক্ষণ করুন
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* PO VIEW MODAL */}
        {viewingPo && (
          <Dialog open={!!viewingPo} onOpenChange={() => setViewingPo(null)}>
            <DialogContent className="max-w-md p-5">
              <DialogHeader>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" /> পারচেজ অর্ডার #{viewingPo.po_number}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-3 text-xs">
                <div className="bg-muted/40 p-3 rounded-lg space-y-1">
                  <p>
                    <span className="text-muted-foreground">সাপ্লায়ার:</span>{' '}
                    <span className="font-bold text-foreground">
                      {viewingPo.suppliers?.name || 'অজ্ঞাত'}
                    </span>
                  </p>
                  {viewingPo.suppliers?.phone && (
                    <p>
                      <span className="text-muted-foreground">ফোন:</span> {viewingPo.suppliers.phone}
                    </p>
                  )}
                  <p>
                    <span className="text-muted-foreground">স্ট্যাটাস:</span>{' '}
                    <span className="capitalize font-semibold">{viewingPo.status}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">তারিখ:</span>{' '}
                    {new Date(viewingPo.created_at).toLocaleDateString('bn-BD')}
                  </p>
                </div>

                <div className="border rounded-md divide-y overflow-hidden max-h-48 overflow-y-auto">
                  {viewingPo.items.map((it, idx) => (
                    <div key={idx} className="p-2 flex justify-between items-center text-xs">
                      <div>
                        <p className="font-medium text-foreground">{it.product_name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {it.quantity} টি × ৳{it.unit_cost.toLocaleString()}
                        </p>
                      </div>
                      <p className="font-mono font-bold">৳{it.total_cost.toLocaleString()}</p>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-2 flex justify-between font-bold text-sm">
                  <span>মোট বিল:</span>
                  <span className="text-primary font-mono">
                    ৳{viewingPo.total_amount?.toLocaleString()}
                  </span>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
