'use client';

import React, { useState, useEffect, useRef } from 'react';
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
import { Switch } from '@/components/ui/switch';
import {
  Package,
  Layers,
  Image as ImageIcon,
  DollarSign,
  Sliders,
  Eye,
  Plus,
  Trash2,
  Upload,
  RefreshCw,
  X,
  Sparkles,
  TrendingUp,
  Tag,
  Barcode,
  ExternalLink,
  Check,
  Globe,
  Share2,
  AlertCircle,
  Copy,
} from 'lucide-react';
import type { Product, ProductVariant, ProductAttribute, TierPrice, ProductCategory } from '@/types/watch';
import type { BusinessSettings } from '@/types/business';
import { toast } from 'sonner';

export type FormTab = 'basic' | 'media' | 'variants' | 'tiers' | 'specs' | 'preview';
const FORM_TABS: FormTab[] = ['basic', 'media', 'variants', 'tiers', 'specs', 'preview'];

export interface DynamicCategoryOption {
  id: string;
  label: string;
}

interface ProductFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  onSuccess: () => void;
  business?: BusinessSettings | null;
  dynamicCategories?: DynamicCategoryOption[];
}

export function ProductFormModal({
  open,
  onOpenChange,
  product,
  onSuccess,
  business,
  dynamicCategories = [],
}: ProductFormModalProps) {
  const [activeTab, setActiveTab] = useState<FormTab>('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [formData, setFormData] = useState<{
    name: string;
    sku: string;
    barcode: string;
    slug: string;
    badge_text: string;
    category: string;
    unit: string;
    price: string;
    regular_price: string;
    cost_price: string;
    stock_quantity: string;
    low_stock_threshold: string;
    image_url: string;
    images: string[];
    variants: ProductVariant[];
    custom_attributes: ProductAttribute[];
    tier_pricing: TierPrice[];
    dial_size: string;
    water_resistance: string;
    movement: string;
    strap_type: string;
    colors: string;
    warranty_months: string;
    description: string;
    is_active: boolean;
  }>({
    name: '',
    sku: '',
    barcode: '',
    slug: '',
    badge_text: '',
    category: 'General',
    unit: 'pcs',
    price: '',
    regular_price: '',
    cost_price: '',
    stock_quantity: '15',
    low_stock_threshold: '5',
    image_url: '',
    images: [],
    variants: [],
    custom_attributes: [],
    tier_pricing: [],
    dial_size: '',
    water_resistance: '',
    movement: '',
    strap_type: '',
    colors: '',
    warranty_months: '12',
    description: '',
    is_active: true,
  });

  // Sync form data with incoming product prop
  useEffect(() => {
    if (product) {
      const colorsStr = Array.isArray(product.colors) ? product.colors.join(', ') : '';
      setFormData({
        name: product.name || '',
        sku: product.sku || '',
        barcode: product.barcode || '',
        slug: product.slug || '',
        badge_text: product.badge_text || '',
        category: product.category || 'General',
        unit: product.unit || 'pcs',
        price: product.price ? String(product.price) : '',
        regular_price: product.regular_price ? String(product.regular_price) : '',
        cost_price: product.cost_price ? String(product.cost_price) : '',
        stock_quantity: product.stock_quantity !== undefined ? String(product.stock_quantity) : '15',
        low_stock_threshold: product.low_stock_threshold !== undefined ? String(product.low_stock_threshold) : '5',
        image_url: product.image_url || '',
        images: Array.isArray(product.images) && product.images.length > 0
          ? product.images
          : product.image_url
          ? [product.image_url]
          : [],
        variants: Array.isArray(product.variants) ? product.variants : [],
        custom_attributes: Array.isArray(product.custom_attributes) ? product.custom_attributes : [],
        tier_pricing: Array.isArray(product.tier_pricing) ? product.tier_pricing : [],
        dial_size: product.dial_size || '',
        water_resistance: product.water_resistance || '',
        movement: product.movement || '',
        strap_type: product.strap_type || '',
        colors: colorsStr,
        warranty_months: product.warranty_months ? String(product.warranty_months) : '12',
        description: product.description || '',
        is_active: product.is_active !== undefined ? product.is_active : true,
      });
    } else {
      setFormData({
        name: '',
        sku: '',
        barcode: '',
        slug: '',
        badge_text: '',
        category: 'General',
        unit: 'pcs',
        price: '',
        regular_price: '',
        cost_price: '',
        stock_quantity: '15',
        low_stock_threshold: '5',
        image_url: '',
        images: [],
        variants: [],
        custom_attributes: [],
        tier_pricing: [],
        dial_size: '',
        water_resistance: '',
        movement: '',
        strap_type: '',
        colors: '',
        warranty_months: '12',
        description: '',
        is_active: true,
      });
    }
    setActiveTab('basic');
  }, [product, open]);

  // Auto SKU & Barcode Generator
  const handleAutoGenerateSkuAndBarcode = () => {
    const randomHex = Math.random().toString(36).substring(2, 7).toUpperCase();
    const cleanPrefix = (formData.category || 'PRD').substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const newSku = `${cleanPrefix}-${randomHex}`;
    const timestampDigits = Date.now().toString().slice(-8);
    const newBarcode = `890${timestampDigits}`;
    setFormData((prev) => ({
      ...prev,
      sku: prev.sku ? prev.sku : newSku,
      barcode: newBarcode,
    }));
    toast.success('SKU ও বারকোড তৈরি হয়েছে');
  };

  // Direct Image File Upload
  const handleImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setIsUploadingImage(true);
      const newUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} ফাইলটি ১০MB এর চেয়ে বড়!`);
          continue;
        }

        const uploadFormData = new FormData();
        uploadFormData.append('file', file);

        const res = await fetch('/api/products/upload', {
          method: 'POST',
          body: uploadFormData,
        });

        const data = await res.json();
        if (res.ok && data.url) {
          newUrls.push(data.url);
        } else {
          toast.error(data.error || `${file.name} আপলোড ব্যর্থ`);
        }
      }

      if (newUrls.length > 0) {
        setFormData((prev) => {
          const updated = [...prev.images, ...newUrls];
          return {
            ...prev,
            images: updated,
            image_url: prev.image_url ? prev.image_url : updated[0],
          };
        });
        toast.success(`${newUrls.length} টি ছবি আপলোড হয়েছে`);
      }
    } catch {
      toast.error('ছবি আপলোডে সমস্যা হয়েছে');
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    setFormData((prev) => {
      const updated = prev.images.filter((_, i) => i !== index);
      let newCover = prev.image_url;
      if (prev.image_url === prev.images[index]) {
        newCover = updated[0] || '';
      }
      return {
        ...prev,
        images: updated,
        image_url: newCover,
      };
    });
  };

  // Variants handlers
  const handleAddVariant = () => {
    const newVariant: ProductVariant = {
      id: `var-${Date.now()}`,
      name: '',
      sku: '',
      price: null,
      stock: 5,
      image_url: formData.image_url || undefined,
    };
    setFormData((prev) => ({
      ...prev,
      variants: [...prev.variants, newVariant],
    }));
  };

  const handleRemoveVariant = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.filter((v) => v.id !== id),
    }));
  };

  const handleUpdateVariant = (id: string, field: keyof ProductVariant, value: any) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.map((v) => (v.id === id ? { ...v, [field]: value } : v)),
    }));
  };

  // Tier Pricing handlers
  const handleAddTierPrice = () => {
    const nextQty = formData.tier_pricing.length + 2;
    const baseP = parseFloat(formData.price) || 0;
    const discount = nextQty * 100;
    setFormData((prev) => ({
      ...prev,
      tier_pricing: [
        ...prev.tier_pricing,
        {
          quantity: nextQty,
          price: Math.max(0, baseP * nextQty - discount),
          label: `${nextQty} Pcs Pack`,
          badge: `SAVE ৳${discount}`,
        },
      ],
    }));
  };

  const handleUpdateTierPrice = (index: number, field: keyof TierPrice, value: any) => {
    setFormData((prev) => {
      const updated = [...prev.tier_pricing];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, tier_pricing: updated };
    });
  };

  const handleRemoveTierPrice = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      tier_pricing: prev.tier_pricing.filter((_, i) => i !== index),
    }));
  };

  // Custom attributes handlers
  const handleAddAttribute = () => {
    setFormData((prev) => ({
      ...prev,
      custom_attributes: [...prev.custom_attributes, { key: '', value: '' }],
    }));
  };

  const handleUpdateAttribute = (index: number, field: 'key' | 'value', value: string) => {
    setFormData((prev) => {
      const updated = [...prev.custom_attributes];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, custom_attributes: updated };
    });
  };

  const handleRemoveAttribute = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      custom_attributes: prev.custom_attributes.filter((_, i) => i !== index),
    }));
  };

  // Profit calculations
  const priceNum = parseFloat(formData.price) || 0;
  const costNum = parseFloat(formData.cost_price) || 0;
  const profitNum = priceNum - costNum;
  const marginPct = priceNum > 0 && costNum > 0 ? ((profitNum / priceNum) * 100).toFixed(1) : null;
  const regularNum = parseFloat(formData.regular_price) || 0;
  const discountPct = regularNum > priceNum && priceNum > 0 ? Math.round(((regularNum - priceNum) / regularNum) * 100) : null;

  // Submit Handler
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.price.trim()) {
      toast.error('প্রোডাক্ট নাম এবং বিক্রয় মূল্য অবশ্যই দিতে হবে');
      setActiveTab('basic');
      return;
    }

    try {
      setIsSubmitting(true);
      const colorsArray = formData.colors
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);

      // If variants exist, total stock can be sum of variant stocks
      const calculatedStock = formData.variants.length > 0
        ? formData.variants.reduce((acc, v) => acc + (Number(v.stock) || 0), 0)
        : parseInt(formData.stock_quantity, 10) || 0;

      const payload = {
        name: formData.name.trim(),
        sku: formData.sku.trim() || null,
        barcode: formData.barcode.trim() || null,
        unit: formData.unit.trim() || 'pcs',
        slug: formData.slug.trim() || undefined,
        badge_text: formData.badge_text.trim() || null,
        category: formData.category,
        price: parseFloat(formData.price) || 0,
        regular_price: formData.regular_price ? parseFloat(formData.regular_price) : null,
        cost_price: formData.cost_price.trim() ? parseFloat(formData.cost_price) : 0,
        stock_quantity: calculatedStock,
        low_stock_threshold: parseInt(formData.low_stock_threshold, 10) || 5,
        image_url: formData.image_url.trim() || (formData.images[0] || null),
        images: formData.images,
        variants: formData.variants,
        custom_attributes: formData.custom_attributes.filter((a) => a.key.trim().length > 0),
        tier_pricing: formData.tier_pricing,
        dial_size: formData.dial_size.trim(),
        water_resistance: formData.water_resistance.trim(),
        movement: formData.movement.trim(),
        strap_type: formData.strap_type.trim(),
        colors: colorsArray,
        warranty_months: parseInt(formData.warranty_months, 10) || 12,
        description: formData.description.trim() || null,
        is_active: formData.is_active,
      };

      if (product) {
        const res = await fetch('/api/products', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: product.id, ...payload }),
        });
        const data = await res.json();
        if (res.ok) {
          toast.success('প্রোডাক্ট সফলভাবে আপডেট করা হয়েছে');
          onOpenChange(false);
          onSuccess();
        } else {
          toast.error(data.error || 'আপডেট করতে ব্যর্থ');
        }
      } else {
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok) {
          toast.success('নতুন প্রোডাক্ট ও ল্যান্ডিং পেজ তৈরি সম্পন্ন হয়েছে!');
          onOpenChange(false);
          onSuccess();
        } else {
          toast.error(data.error || 'প্রোডাক্ট তৈরিতে ব্যর্থ');
        }
      }
    } catch {
      toast.error('সার্ভারে যোগাযোগ করা যায়নি');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-background rounded-2xl border shadow-2xl">
        {/* MODAL HEADER */}
        <DialogHeader className="p-4 sm:p-5 pb-3 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2 truncate">
                <span>{product ? 'প্রোডাক্ট ও ভ্যারিয়েন্ট এডিট' : 'নতুন প্রোডাক্ট যুক্ত করুন'}</span>
                {product && (
                  <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                    #{product.sku || product.id.slice(0, 6)}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5 truncate">
                স্পেসিফিকেশন, ছবি, ভ্যারিয়েন্ট, পাইকারি অফার ও পাবলিক ল্যান্ডিং পেজ কনফিগার করুন
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* TAB SELECTOR BAR (Dedicated responsive row with touch scroll) */}
        <div className="flex items-center gap-1.5 overflow-x-auto px-4 py-2 bg-muted/40 border-b shrink-0 text-xs scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('basic')}
            className={`px-3 py-1.5 font-medium rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'basic' ? 'bg-background text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5 text-primary" /> সাধারণ ও মূল্য
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('media')}
            className={`px-3 py-1.5 font-medium rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'media' ? 'bg-background text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5 text-blue-500" /> ছবি ({formData.images.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('variants')}
            className={`px-3 py-1.5 font-medium rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'variants' ? 'bg-background text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-amber-500" /> ভ্যারিয়েন্ট ({formData.variants.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tiers')}
            className={`px-3 py-1.5 font-medium rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'tiers' ? 'bg-background text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <Tag className="w-3.5 h-3.5 text-emerald-500" /> হোলসেল টিয়ার
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('specs')}
            className={`px-3 py-1.5 font-medium rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'specs' ? 'bg-background text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-purple-500" /> স্পেক্স ও SEO
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`px-3 py-1.5 font-medium rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'preview' ? 'bg-background text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <Eye className="w-3.5 h-3.5 text-teal-500" /> লাইভ প্রিভিউ
          </button>
        </div>

        {/* MODAL BODY */}
        <form onSubmit={handleSaveProduct} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* TAB 1: BASIC & PRICING */}
            {activeTab === 'basic' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Left Column: Product Information & Description */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="name" className="text-xs font-semibold">প্রোডাক্টের নাম *</Label>
                    <Input
                      id="name"
                      placeholder="যেমন: প্রিমিয়াম কটন পাঞ্জাবি / ওয়্যারলেস এয়ারবাডস / স্কিন কেয়ার সিরাম"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="h-10 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="sku" className="text-xs font-semibold">SKU / মডেল কোড</Label>
                        <button
                          type="button"
                          onClick={handleAutoGenerateSkuAndBarcode}
                          className="text-[11px] text-primary hover:underline font-semibold"
                        >
                          ⚡ অটো SKU
                        </button>
                      </div>
                      <Input
                        id="sku"
                        placeholder="যেমন: PAN-1001"
                        value={formData.sku}
                        onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                        className="h-9 text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="barcode" className="text-xs font-semibold">বারকোড / EAN</Label>
                      <Input
                        id="barcode"
                        placeholder="যেমন: 890123456789"
                        value={formData.barcode}
                        onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                        className="h-9 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="category" className="text-xs font-semibold">ক্যাটেগরি</Label>
                      <Input
                        id="category"
                        list="category-options-list"
                        placeholder="যেমন: Fashion, Electronics..."
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="h-9 text-xs"
                      />
                      <datalist id="category-options-list">
                        {dynamicCategories
                          .filter((c) => c.id !== 'all')
                          .map((cat) => (
                            <option key={cat.id} value={cat.label} />
                          ))}
                      </datalist>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="unit" className="text-xs font-semibold">পরিমাপের একক (Unit)</Label>
                      <select
                        id="unit"
                        value={formData.unit}
                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="pcs">পিস (Pieces - pcs)</option>
                        <option value="box">বক্স (Box)</option>
                        <option value="set">সেট / কম্বো (Set)</option>
                        <option value="pair">জোড়া (Pair)</option>
                        <option value="kg">কেজি (Kilogram - kg)</option>
                        <option value="meter">মিটার (Meter)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="badge" className="text-xs font-semibold">প্রমোশনাল ব্যাজ (Badge)</Label>
                      <Input
                        id="badge"
                        placeholder="যেমন: BESTSELLER, HOT DEAL"
                        value={formData.badge_text}
                        onChange={(e) => setFormData({ ...formData, badge_text: e.target.value })}
                        className="h-9 text-xs uppercase"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="low_stock" className="text-xs font-semibold">লো-স্টক সতর্কতার মাত্রা</Label>
                      <Input
                        id="low_stock"
                        type="number"
                        min="1"
                        placeholder="5"
                        value={formData.low_stock_threshold}
                        onChange={(e) => setFormData({ ...formData, low_stock_threshold: e.target.value })}
                        className="h-9 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="desc" className="text-xs font-semibold">সংক্ষিপ্ত বিবরণ ও হাইলাইটস</Label>
                    <textarea
                      id="desc"
                      rows={4}
                      className="w-full rounded-lg border border-input bg-background p-3 text-xs ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      placeholder="পণ্যটির বিশেষত্ব, কাপড়ের কোয়ালিটি বা কার্যকারিতা সম্পর্কে সংক্ষেপে লিখুন..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                </div>

                {/* Right Column: Pricing Matrix & Stock Card */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="p-4 rounded-xl border bg-muted/20 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-primary" /> মূল্য ও ইনভেন্টরি কনফিগারেশন
                    </h4>

                    <div className="space-y-1">
                      <Label htmlFor="price" className="text-xs font-semibold">বিক্রয় মূল্য (Selling Price ৳) *</Label>
                      <Input
                        id="price"
                        type="number"
                        placeholder="যেমন: 2450"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        required
                        className="h-9 text-sm font-bold text-foreground font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="regular_price" className="text-[11px] font-semibold">রেগুলার / MRP (৳)</Label>
                        <Input
                          id="regular_price"
                          type="number"
                          placeholder="3200"
                          value={formData.regular_price}
                          onChange={(e) => setFormData({ ...formData, regular_price: e.target.value })}
                          className="h-9 text-xs font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="cost_price" className="text-[11px] font-semibold">কেনা খরচ (Cost ৳)</Label>
                        <Input
                          id="cost_price"
                          type="number"
                          placeholder="1400"
                          value={formData.cost_price}
                          onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                          className="h-9 text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="stock" className="text-xs font-semibold">স্টক পরিমাণ (In-Stock)</Label>
                        {formData.variants.length > 0 && (
                          <span className="text-[10px] text-amber-500 font-medium">ভ্যারিয়েন্ট অনুযায়ী স্বয়ংক্রিয়</span>
                        )}
                      </div>
                      <Input
                        id="stock"
                        type="number"
                        min="0"
                        placeholder="15"
                        value={formData.stock_quantity}
                        onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                        disabled={formData.variants.length > 0}
                        className="h-9 text-xs font-mono font-bold"
                      />
                    </div>

                    {/* Live Gross Profit & Margin Card */}
                    {priceNum > 0 && costNum > 0 && (
                      <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 space-y-1 text-xs mt-2">
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> মোট সম্ভাব্য লাভ:
                          </span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                            ৳{profitNum.toLocaleString('en-BD')}
                          </span>
                        </div>
                        {marginPct && (
                          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-emerald-500/10">
                            <span>প্রফিট মার্জিন:</span>
                            <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 text-[10px] font-bold py-0">
                              {marginPct}% মার্জিন
                            </Badge>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: MEDIA & PHOTOS */}
            {activeTab === 'media' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-foreground">প্রোডাক্ট ফটো ও ইমেজ গ্যালারি</h4>
                    <p className="text-xs text-muted-foreground">ড্র্যাগ ও ড্রপ করে অথবা ব্রাউজ করে সরাসরি ছবি আপলোড করুন</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {formData.images.length} টি ছবি আপলোডকৃত
                  </Badge>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  {/* Left Column: Drag & Drop Upload Zone + Direct URL Input */}
                  <div className="lg:col-span-5 space-y-3">
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-primary/40 hover:border-primary rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-colors bg-primary/5 hover:bg-primary/10 flex flex-col items-center justify-center gap-2 min-h-[180px]"
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png, image/jpeg, image/webp"
                        multiple
                        onChange={handleImageFileSelect}
                        className="hidden"
                      />
                      <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                        {isUploadingImage ? (
                          <RefreshCw className="h-6 w-6 animate-spin" />
                        ) : (
                          <Upload className="h-6 w-6" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">
                          {isUploadingImage ? 'ক্লাউড স্টোরেজে ছবি আপলোড হচ্ছে...' : 'ছবি আপলোড করতে ক্লিক করুন বা টেনে আনুন'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">PNG, JPG বা WebP ফরম্যাট (সর্বোচ্চ ১০MB প্রতিটি)</p>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl border bg-muted/20 space-y-2">
                      <Label htmlFor="image_url" className="text-xs font-semibold">অথবা সরাসরি ইমেজ URL লিংক:</Label>
                      <div className="flex gap-2">
                        <Input
                          id="image_url"
                          placeholder="https://example.com/photo.jpg"
                          value={formData.image_url}
                          onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                          className="h-8 text-xs font-mono"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-8 text-xs shrink-0"
                          onClick={() => {
                            if (formData.image_url.trim() && !formData.images.includes(formData.image_url.trim())) {
                              setFormData({
                                ...formData,
                                images: [...formData.images, formData.image_url.trim()],
                              });
                              toast.success('ছবি গ্যালারিতে যোগ হয়েছে');
                            }
                          }}
                        >
                          যোগ করুন
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Uploaded Gallery Grid */}
                  <div className="lg:col-span-7 space-y-2">
                    <Label className="text-xs font-semibold">সংরক্ষিত ছবিসমূহ (কভার ফটো নির্বাচন করুন):</Label>
                    {formData.images.length === 0 ? (
                      <div className="py-12 border border-dashed rounded-xl text-center bg-muted/20">
                        <ImageIcon className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                        <p className="text-xs font-semibold text-foreground">কোনো ছবি যুক্ত করা হয়নি</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          বামের আপলোড বক্স ব্যবহার করে পণ্যের একাধিক ছবি যুক্ত করুন
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {formData.images.map((url, idx) => {
                          const isCover = formData.image_url === url;
                          return (
                            <div
                              key={idx}
                              className={`relative aspect-square rounded-xl overflow-hidden border-2 group shadow-xs ${
                                isCover ? 'border-primary ring-2 ring-primary/40' : 'border-border'
                              }`}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt={`Photo ${idx}`} className="h-full w-full object-cover" />

                              {/* Remove Button */}
                              <button
                                type="button"
                                onClick={() => handleRemoveImage(idx)}
                                className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/80 hover:bg-destructive text-white flex items-center justify-center transition-colors"
                                title="মুছে ফেলুন"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>

                              {/* Set Cover Button */}
                              <button
                                type="button"
                                onClick={() => setFormData({ ...formData, image_url: url })}
                                className={`absolute bottom-0 inset-x-0 text-[10px] py-1 text-center font-bold transition-all ${
                                  isCover ? 'bg-primary text-primary-foreground' : 'bg-black/70 text-white hover:bg-black/90'
                                }`}
                              >
                                {isCover ? '★ কভার ছবি' : 'কভার বানান'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: VARIANTS */}
            {activeTab === 'variants' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-foreground">প্রোডাক্ট ভ্যারিয়েন্টস (কালার, সাইজ ও মডেল)</h4>
                    <p className="text-xs text-muted-foreground">
                      ভিন্ন ভিন্ন কালার, সাইজ বা ভ্যারিয়েন্টের আলাদা স্টক এবং মূল্যের হিসাব পরিচালনা করুন
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddVariant}
                    className="h-8 text-xs gap-1.5 font-semibold"
                  >
                    <Plus className="h-3.5 w-3.5" /> নতুন ভ্যারিয়েন্ট যোগ
                  </Button>
                </div>

                {formData.variants.length === 0 ? (
                  <div className="py-12 border border-dashed rounded-xl text-center bg-muted/20">
                    <Layers className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-foreground">কোনো ভ্যারিয়েন্ট যোগ করা হয়নি</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                      যদি পণ্যটিতে কোনো কালার বা সাইজ পছন্দ করার অপশন থাকে, তবে উপরে &quot;নতুন ভ্যারিয়েন্ট যোগ&quot; বাটনে চাপুন।
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {formData.variants.map((v) => (
                      <div
                        key={v.id}
                        className="grid grid-cols-12 gap-2 p-3 rounded-xl border border-border/80 bg-card items-center text-xs shadow-xs"
                      >
                        <div className="col-span-5">
                          <Label className="text-[10px] font-semibold text-muted-foreground">ভ্যারিয়েন্টের নাম *</Label>
                          <Input
                            placeholder="যেমন: Red / XL, Blue, 128GB"
                            value={v.name}
                            onChange={(e) => handleUpdateVariant(v.id, 'name', e.target.value)}
                            className="h-8 text-xs mt-0.5"
                            required
                          />
                        </div>
                        <div className="col-span-3">
                          <Label className="text-[10px] font-semibold text-muted-foreground">মূল্য ওভাররাইড (৳)</Label>
                          <Input
                            type="number"
                            placeholder={formData.price || 'একই'}
                            value={v.price ? String(v.price) : ''}
                            onChange={(e) => handleUpdateVariant(v.id, 'price', e.target.value ? Number(e.target.value) : null)}
                            className="h-8 text-xs mt-0.5 font-mono"
                          />
                        </div>
                        <div className="col-span-3">
                          <Label className="text-[10px] font-semibold text-muted-foreground">স্টক সংখ্যা (Pcs) *</Label>
                          <Input
                            type="number"
                            min="0"
                            value={v.stock}
                            onChange={(e) => handleUpdateVariant(v.id, 'stock', parseInt(e.target.value, 10) || 0)}
                            className="h-8 text-xs mt-0.5 font-mono font-bold"
                            required
                          />
                        </div>
                        <div className="col-span-1 flex justify-end pt-3">
                          <button
                            type="button"
                            onClick={() => handleRemoveVariant(v.id)}
                            className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                            title="মুছুন"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: WHOLESALE TIERS */}
            {activeTab === 'tiers' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-foreground">হোলসেল ও মাল্টি-কোয়ান্টিটি অফার (Tier Pricing)</h4>
                    <p className="text-xs text-muted-foreground">
                      গ্রাহকদের বেশি পরিমাণে অর্ডার করতে উৎসাহিত করতে &quot;২টি নিলে ২০০ টাকা ছাড়&quot; অফার যুক্ত করুন
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddTierPrice}
                    className="h-8 text-xs gap-1.5 font-semibold"
                  >
                    <Plus className="h-3.5 w-3.5" /> টিয়ার অফার যোগ
                  </Button>
                </div>

                {formData.tier_pricing.length === 0 ? (
                  <div className="py-12 border border-dashed rounded-xl text-center bg-muted/20">
                    <Tag className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-foreground">কোনো বান্ডেল টিয়ার অফার নেই</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                      &quot;২ পিস কিনলে ছাড়&quot; বা &quot;৩ পিস কিনলে ফ্রি ডেলিভারি&quot; সেট করতে &quot;টিয়ার অফার যোগ&quot; বাটনে চাপুন।
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {formData.tier_pricing.map((tp, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl border bg-card grid grid-cols-12 gap-2 items-center text-xs shadow-xs"
                      >
                        <div className="col-span-2">
                          <Label className="text-[10px] text-muted-foreground">ন্যূনতম সংখ্যা</Label>
                          <Input
                            type="number"
                            min="2"
                            value={tp.quantity}
                            onChange={(e) => handleUpdateTierPrice(idx, 'quantity', parseInt(e.target.value, 10) || 2)}
                            className="h-8 text-xs font-bold font-mono mt-0.5"
                          />
                        </div>
                        <div className="col-span-3">
                          <Label className="text-[10px] text-muted-foreground">প্যাক মূল্য (৳)</Label>
                          <Input
                            type="number"
                            value={tp.price}
                            onChange={(e) => handleUpdateTierPrice(idx, 'price', parseFloat(e.target.value) || 0)}
                            className="h-8 text-xs font-bold font-mono text-primary mt-0.5"
                          />
                        </div>
                        <div className="col-span-4">
                          <Label className="text-[10px] text-muted-foreground">অফার লেবেল</Label>
                          <Input
                            placeholder="যেমন: ২টি কিনলে ২০০ টাকা ছাড়"
                            value={tp.label || ''}
                            onChange={(e) => handleUpdateTierPrice(idx, 'label', e.target.value)}
                            className="h-8 text-xs mt-0.5"
                          />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-[10px] text-muted-foreground">ব্যাজ</Label>
                          <Input
                            placeholder="POPULAR"
                            value={tp.badge || ''}
                            onChange={(e) => handleUpdateTierPrice(idx, 'badge', e.target.value)}
                            className="h-8 text-xs uppercase mt-0.5"
                          />
                        </div>
                        <div className="col-span-1 flex justify-end pt-3">
                          <button
                            type="button"
                            onClick={() => handleRemoveTierPrice(idx)}
                            className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: SPECS & SEO */}
            {activeTab === 'specs' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="slug" className="text-xs font-semibold">কাস্টম পাবলিক URL স্লাগ (Slug)</Label>
                    <Input
                      id="slug"
                      placeholder="যেমন: premium-panjabi-edition"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      className="h-9 text-xs font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      লাইভ পেজ লিংক: <code className="bg-muted px-1 rounded">/p/{formData.slug || '[অটো-জেনারেট]'}</code>
                    </p>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="warranty" className="text-xs font-semibold">ওয়ারেন্টি মেয়াদ (মাস)</Label>
                    <Input
                      id="warranty"
                      type="number"
                      placeholder="12"
                      value={formData.warranty_months}
                      onChange={(e) => setFormData({ ...formData, warranty_months: e.target.value })}
                      className="h-9 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="colors" className="text-xs font-semibold">কালার ট্যাগ (কমা দিয়ে আলাদা করুন)</Label>
                    <Input
                      id="colors"
                      placeholder="Black, White, Navy Blue"
                      value={formData.colors}
                      onChange={(e) => setFormData({ ...formData, colors: e.target.value })}
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="dial" className="text-xs font-semibold">
                      {business?.spec_label_1 || 'মডেল / কোড / সাইজ'}
                    </Label>
                    <Input
                      id="dial"
                      value={formData.dial_size}
                      onChange={(e) => setFormData({ ...formData, dial_size: e.target.value })}
                      className="h-9 text-xs"
                      placeholder="যেমন: Model, XL, Size 42"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="water" className="text-xs font-semibold">
                      {business?.spec_label_2 || 'মেটেরিয়াল / ফেব্রিক'}
                    </Label>
                    <Input
                      id="water"
                      value={formData.water_resistance}
                      onChange={(e) => setFormData({ ...formData, water_resistance: e.target.value })}
                      className="h-9 text-xs"
                      placeholder="যেমন: 100% Cotton, Stainless Steel"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="strap" className="text-xs font-semibold">
                      {business?.spec_label_4 || 'অরিজিন / স্পেশাল কেয়ার'}
                    </Label>
                    <Input
                      id="strap"
                      value={formData.strap_type}
                      onChange={(e) => setFormData({ ...formData, strap_type: e.target.value })}
                      className="h-9 text-xs"
                      placeholder="যেমন: Hand Wash, Made in Bangladesh"
                    />
                  </div>
                </div>

                {/* Custom Dynamic Attributes */}
                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs font-bold">কাস্টম ডাইনামিক অ্যাট্রিবিউটস (Attributes)</Label>
                      <p className="text-[10px] text-muted-foreground">যে কোনো স্পেসিফিকেশন যেমন: ব্যাটারি, ওজন, ভলিউম ইত্যাদি যুক্ত করুন</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddAttribute}
                      className="h-7 text-xs gap-1"
                    >
                      <Plus className="h-3 w-3" /> অ্যাট্রিবিউট যোগ
                    </Button>
                  </div>

                  {formData.custom_attributes.length > 0 && (
                    <div className="space-y-2">
                      {formData.custom_attributes.map((attr, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Input
                            placeholder="বৈশিষ্ট্য (যেমন: ব্যাটারি / ওজন)"
                            value={attr.key}
                            onChange={(e) => handleUpdateAttribute(idx, 'key', e.target.value)}
                            className="h-8 text-xs flex-1"
                          />
                          <Input
                            placeholder="মান (যেমন: 5000 mAh / 250 গ্রাম)"
                            value={attr.value}
                            onChange={(e) => handleUpdateAttribute(idx, 'value', e.target.value)}
                            className="h-8 text-xs flex-1"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveAttribute(idx)}
                            className="text-muted-foreground hover:text-destructive p-1.5 transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Active in Catalog Toggle */}
                <div className="bg-muted/40 p-3.5 rounded-xl flex items-center justify-between border">
                  <div>
                    <Label htmlFor="is_active" className="text-xs font-bold cursor-pointer">
                      পাবলিক স্টোরফ্রন্ট ও চ্যাটবোটে প্রদর্শন (Active)
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      চালু রাখলে অনলাইন স্টোর ও হোয়াটসঅ্যাপ বট স্বয়ংক্রিয়ভাবে কাস্টমারকে এটি সাজেস্ট করবে।
                    </p>
                  </div>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                </div>
              </div>
            )}

            {/* TAB 6: LIVE PREVIEW */}
            {activeTab === 'preview' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-foreground">লাইভ কাস্টমার কার্ড ও হোয়াটসঅ্যাপ প্রিভিউ</h4>
                  <Badge variant="outline" className="text-xs font-semibold">
                    রিয়েল-টাইম রেন্ডারিং
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  {/* Storefront Card Preview */}
                  <div className="border rounded-2xl overflow-hidden bg-card shadow-md space-y-3 p-3">
                    <div className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 pb-1 border-b">
                      <Globe className="w-3.5 h-3.5 text-primary" /> স্টোরফ্রন্ট কার্ড লুক
                    </div>

                    <div className="relative aspect-4/3 rounded-xl overflow-hidden bg-muted/40">
                      {formData.image_url || formData.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={formData.image_url || formData.images[0]}
                          alt="Preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground">
                          <Package className="w-10 h-10 opacity-30" />
                          <span className="text-xs mt-1">ছবি আপলোড করুন</span>
                        </div>
                      )}

                      {/* Badges */}
                      <div className="absolute top-2 left-2 flex gap-1">
                        {formData.badge_text && (
                          <Badge className="bg-amber-500 text-black font-bold text-[10px] uppercase">
                            {formData.badge_text}
                          </Badge>
                        )}
                        {discountPct && (
                          <Badge className="bg-rose-500 text-white font-bold text-[10px]">
                            {discountPct}% OFF
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div>
                      <h5 className="font-bold text-base text-foreground line-clamp-1">
                        {formData.name || 'প্রোডাক্টের নাম এখানে প্রদর্শিত হবে'}
                      </h5>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {formData.description || 'সংক্ষিপ্ত বর্ণনা এখানে প্রদর্শিত হবে...'}
                      </p>

                      <div className="flex items-baseline gap-2 mt-2">
                        <span className="text-lg font-bold text-foreground font-mono">
                          ৳{priceNum ? priceNum.toLocaleString('en-BD') : '০'}
                        </span>
                        {regularNum > priceNum && (
                          <span className="text-xs text-muted-foreground line-through font-mono">
                            ৳{regularNum.toLocaleString('en-BD')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* WhatsApp Pitch Bubble Preview */}
                  <div className="border rounded-2xl p-4 bg-[#e5ddd5]/30 dark:bg-zinc-900 space-y-3">
                    <div className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 pb-1 border-b">
                      <Share2 className="w-3.5 h-3.5 text-emerald-600" /> হোয়াটসঅ্যাপ চ্যাট পিচ প্রিভিউ
                    </div>

                    <div className="bg-[#dcf8c6] dark:bg-emerald-950/70 p-3.5 rounded-2xl rounded-tr-none text-xs text-foreground font-mono leading-relaxed shadow-sm">
                      <p className="font-bold">✨ {formData.name || 'পণ্যটির নাম'}</p>
                      <p className="mt-1">💰 অফার প্রাইজ: ৳{priceNum.toLocaleString('en-BD')}</p>
                      {regularNum > priceNum && (
                        <p>🏷️ নিয়মিত মূল্য: ৳{regularNum.toLocaleString('en-BD')} (ছাড়: {discountPct}%)</p>
                      )}
                      <p className="mt-1">📦 স্টক: {formData.variants.length > 0 ? 'ভ্যারিয়েন্টে উপলব্ধ' : `${formData.stock_quantity || 15} পিস`}</p>
                      {formData.description && <p className="mt-1.5">{formData.description}</p>}
                      <p className="mt-2 text-primary font-bold">
                        🔗 অর্ডার লিংক: {typeof window !== 'undefined' ? window.location.origin : ''}/p/{formData.slug || 'prd-id'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* MODAL STICKY FOOTER */}
          <div className="p-3 sm:p-4 border-t bg-muted/20 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs h-8"
            >
              বাতিল
            </Button>

            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
              {activeTab !== 'basic' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const currentIdx = FORM_TABS.indexOf(activeTab);
                    if (currentIdx > 0) setActiveTab(FORM_TABS[currentIdx - 1]);
                  }}
                  className="text-xs"
                >
                  পূর্ববর্তী
                </Button>
              )}

              {activeTab !== 'preview' ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const currentIdx = FORM_TABS.indexOf(activeTab);
                    if (currentIdx < FORM_TABS.length - 1) setActiveTab(FORM_TABS[currentIdx + 1]);
                  }}
                  className="text-xs"
                >
                  পরবর্তী ধাপ ➡️
                </Button>
              ) : null}

              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="font-bold text-xs gap-1.5 bg-primary text-primary-foreground shadow-sm"
              >
                {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                {product ? 'পরিবর্তন সংরক্ষণ করুন' : 'প্রোডাক্ট সংরক্ষণ ও পাবলিশ'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
