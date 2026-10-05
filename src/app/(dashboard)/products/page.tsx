'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import type { Product, ProductVariant, ProductStockLog, ProductAttribute, ProductCategory, TierPrice } from '@/types/watch';
import type { BusinessSettings } from '@/types/business';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AiCopywriterDialog } from '@/components/products/ai-copywriter-dialog';
import { CatalogAdStudioDialog } from '@/components/growth/catalog-ad-studio-dialog';
import { BarcodeLabelModal } from '@/components/products/barcode-label-modal';
import { CsvImportModal } from '@/components/products/csv-import-modal';
import { MetaCatalogModal } from '@/components/products/meta-catalog-modal';
import { ProductReviewsModal } from '@/components/products/product-reviews-modal';
import { ProductBundlesModal } from '@/components/products/product-bundles-modal';
import { StockAuditModal } from '@/components/products/stock-audit-modal';
import { InventoryForecastModal } from '@/components/products/inventory-forecast-modal';
import { CameraBarcodeScannerModal } from '@/components/common/camera-barcode-scanner-modal';
import { SupplierPoModal } from '@/components/products/supplier-po-modal';
import { ProductFormModal } from '@/components/products/product-form-modal';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Store,
  Plus,
  Search,
  Camera,
  Pencil,
  Trash2,
  Copy,
  Check,
  Eye,
  SlidersHorizontal,
  Package,
  Sparkles,
  ShieldCheck,
  CircleDollarSign,
  RefreshCw,
  ExternalLink,
  Link2,
  AlertTriangle,
  LayoutGrid,
  Table as TableIcon,
  Upload,
  X,
  History,
  TrendingUp,
  Image as ImageIcon,
  Tag,
  Truck,
  Barcode as BarcodeIcon,
  Download,
  FileSpreadsheet,
  Share2,
  Printer,
  Percent,
  Star,
  Layers,
  Brain,
  Building2,
  ChevronDown,
  MoreVertical,
} from 'lucide-react';

const DEFAULT_CATEGORIES = [
  { id: 'all', label: 'All Products' },
  { id: 'general', label: 'General' },
  { id: 'fashion', label: 'Fashion & Apparel' },
  { id: 'electronics', label: 'Electronics & Gadgets' },
  { id: 'cosmetics', label: 'Cosmetics & Beauty' },
  { id: 'accessories', label: 'Bags & Accessories' },
  { id: 'watches', label: 'Watches' },
];

type StockFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
type ViewMode = 'grid' | 'table';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [business, setBusiness] = useState<BusinessSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Quick Restock Dialog
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [restockQty, setRestockQty] = useState('');
  const [isRestocking, setIsRestocking] = useState(false);

  // AI Copywriter Dialog
  const [aiCopyProduct, setAiCopyProduct] = useState<Product | null>(null);
  const [isAiCopyOpen, setIsAiCopyOpen] = useState(false);
  const [adStudioProduct, setAdStudioProduct] = useState<Product | null>(null);
  const [isAdStudioOpen, setIsAdStudioOpen] = useState(false);

  // Stock Audit History Dialog
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);

  // Barcode Label Modal State
  const [barcodeProduct, setBarcodeProduct] = useState<Product | null>(null);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);

  // Bulk CSV Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Meta Catalog Data Feed Modal State
  const [isMetaModalOpen, setIsMetaModalOpen] = useState(false);

  // Customer Reviews Modal State
  const [reviewsProduct, setReviewsProduct] = useState<Product | null>(null);
  const [isReviewsModalOpen, setIsReviewsModalOpen] = useState(false);

  // Product Bundles & Combos Modal State
  const [isBundlesModalOpen, setIsBundlesModalOpen] = useState(false);

  // AI Inventory Demand Forecast Modal State
  const [isForecastModalOpen, setIsForecastModalOpen] = useState(false);

  // Camera Barcode Scanner Modal State
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);

  // Supplier & PO Modal State
  const [isSupplierPoModalOpen, setIsSupplierPoModalOpen] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const [prodRes, bizRes] = await Promise.all([
        fetch('/api/products?include_inactive=true'),
        fetch('/api/settings/business'),
      ]);
      const data = await prodRes.json();
      const bizData = await bizRes.json();

      if (prodRes.ok && data.products) {
        setProducts(data.products);
      } else {
        toast.error(data.error || 'Failed to fetch products');
      }

      if (bizRes.ok && bizData.settings) {
        setBusiness(bizData.settings);
      }
    } catch {
      toast.error('Network error loading products');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const openCreateDialog = () => {
    setEditingProduct(null);
    setIsFormOpen(true);
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setIsFormOpen(true);
  };

  const handleExportCsv = () => {
    const listToExport = filteredProducts.length > 0 ? filteredProducts : products;
    if (listToExport.length === 0) {
      toast.error('No products to export');
      return;
    }

    const headers = ['id', 'name', 'sku', 'barcode', 'category', 'price', 'regular_price', 'cost_price', 'stock_quantity', 'unit', 'badge_text', 'status'];
    const rows = listToExport.map((p) => [
      `"${p.id}"`,
      `"${(p.name || '').replace(/"/g, '""')}"`,
      `"${p.sku || ''}"`,
      `"${p.barcode || ''}"`,
      `"${p.category || 'General'}"`,
      p.price || 0,
      p.regular_price || '',
      p.cost_price || 0,
      p.stock_quantity ?? 0,
      `"${p.unit || 'pcs'}"`,
      `"${p.badge_text || ''}"`,
      p.is_active ? 'Active' : 'Inactive',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `catalog-export-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${listToExport.length} product(s) to CSV`);
  };

  // Quick Stock Adjustment (+1, +5, -1)
  const handleStockDelta = async (product: Product, delta: number) => {
    const currentStock = product.stock_quantity || 0;
    const newStock = Math.max(0, currentStock + delta);

    // Optimistic UI update
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, stock_quantity: newStock } : p))
    );

    try {
      const res = await fetch('/api/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: product.id, stock_delta: delta }),
      });
      if (!res.ok) {
        setProducts((prev) =>
          prev.map((p) => (p.id === product.id ? { ...p, stock_quantity: currentStock } : p))
        );
        toast.error('Failed to update stock');
      } else {
        const data = await res.json();
        if (data.product) {
          setProducts((prev) =>
            prev.map((p) => (p.id === product.id ? data.product : p))
          );
        }
        toast.success(`${product.name}: Stock is now ${newStock}`);
      }
    } catch {
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, stock_quantity: currentStock } : p))
      );
      toast.error('Network error updating stock');
    }
  };

  // Quick Direct Restock Dialog Action
  const handleDirectRestock = async () => {
    if (!restockProduct) return;
    const qty = parseInt(restockQty, 10);
    if (isNaN(qty) || qty < 0) {
      toast.error('Please enter a valid stock quantity');
      return;
    }

    try {
      setIsRestocking(true);
      const res = await fetch('/api/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: restockProduct.id, stock_quantity: qty }),
      });
      if (res.ok) {
        setProducts((prev) =>
          prev.map((p) => (p.id === restockProduct.id ? { ...p, stock_quantity: qty } : p))
        );
        toast.success(`Restocked ${restockProduct.name} to ${qty} pcs`);
        setRestockProduct(null);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to restock');
      }
    } catch {
      toast.error('Failed to update stock');
    } finally {
      setIsRestocking(false);
    }
  };

  // Open Stock History Dialog
  const openHistoryDialog = (product: Product) => {
    setHistoryProduct(product);
  };

  const handleToggleActive = async (product: Product) => {
    try {
      const nextActive = !product.is_active;
      const res = await fetch('/api/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: product.id, is_active: nextActive }),
      });
      if (res.ok) {
        setProducts((prev) =>
          prev.map((p) => (p.id === product.id ? { ...p, is_active: nextActive } : p))
        );
        toast.success(nextActive ? 'Product activated for showcase' : 'Product deactivated');
      } else {
        toast.error('Failed to change status');
      }
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleDeleteProduct = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/products?id=${deleteId}`, { method: 'DELETE' });
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== deleteId));
        toast.success('Product removed from catalog');
        setDeleteId(null);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete');
      }
    } catch {
      toast.error('Failed to delete product');
    }
  };

  const getProductPublicUrl = (p: Product) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/p/${p.slug || p.id}`;
  };

  const handleCopyPageLink = (p: Product) => {
    const url = getProductPublicUrl(p);
    navigator.clipboard.writeText(url);
    setCopiedLinkId(p.id);
    toast.success('Single product landing page link copied!');
    setTimeout(() => setCopiedLinkId(null), 2500);
  };

  const formatShowcasePitch = (p: Product) => {
    const regular = p.regular_price ? `~৳${p.regular_price.toLocaleString('en-BD')}~ ` : '';
    const discount = p.regular_price
      ? ` (${Math.round(((p.regular_price - p.price) / p.regular_price) * 100)}% ছাড়)`
      : '';
    const colors = p.colors?.length ? p.colors.join(' | ') : '';
    const publicUrl = getProductPublicUrl(p);

    const spec1Label = business?.spec_label_1 || 'মডেল / কোড';
    const spec2Label = business?.spec_label_2 || 'উপাদান / কোয়ালিটি';
    const spec3Label = business?.spec_label_3 || 'সাইজ / ভ্যারিয়েন্ট';
    const spec4Label = business?.spec_label_4 || 'স্পেসিফিকেশন';

    return (
      `🛍️ *${p.name.toUpperCase()}*\n` +
      (p.sku ? `🏷️ কোড: ${p.sku}\n\n` : '\n') +
      `✨ *প্রিমিয়াম স্পেসিফিকেশন:*\n` +
      (p.dial_size ? `• ${spec1Label}: ${p.dial_size}\n` : '') +
      (p.water_resistance ? `• ${spec2Label}: ${p.water_resistance}\n` : '') +
      (p.movement ? `• ${spec3Label}: ${p.movement}\n` : '') +
      (p.strap_type ? `• ${spec4Label}: ${p.strap_type}\n` : '') +
      (colors ? `• কালার অপশন: ${colors}\n` : '') +
      (p.warranty_months ? `• ওয়ারেন্টি: ${p.warranty_months} মাস 🛡️\n\n` : '\n') +
      `💰 *মূল্য:* ${regular}*৳${p.price.toLocaleString('en-BD')}*${discount}\n\n` +
      `🚚 ক্যাশ অন ডেলিভারি সুবিধা!\n` +
      `📦 পার্সেল রিসিভ করার আগে চেক করে নেওয়ার সুযোগ রয়েছে!\n\n` +
      `👉 *সরাসরি অর্ডার করতে ক্লিক করুন:* ${publicUrl}`
    );
  };

  const handleCopyShowcase = (p: Product) => {
    const text = formatShowcasePitch(p);
    navigator.clipboard.writeText(text);
    setCopiedId(p.id);
    toast.success('WhatsApp showcase pitch with order link copied!');
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Dynamic Categories derived from products inventory + flexible defaults
  const dynamicCategories = useMemo(() => {
    const list: { id: string; label: string }[] = [{ id: 'all', label: 'All Products' }];
    const seen = new Set<string>();

    // 1. Gather all categories actually present in products
    products.forEach((p) => {
      if (p.category && p.category.trim()) {
        const key = p.category.trim().toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          const raw = p.category.trim();
          const label = raw.charAt(0).toUpperCase() + raw.slice(1);
          list.push({ id: key, label });
        }
      }
    });

    // 2. Add defaults if not already present
    DEFAULT_CATEGORIES.forEach((def) => {
      if (def.id !== 'all' && !seen.has(def.id.toLowerCase())) {
        list.push(def);
      }
    });

    return list;
  }, [products]);

  // Filtered list
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        q === '' ||
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.variants && p.variants.some((v) =>
          (v.name && v.name.toLowerCase().includes(q)) ||
          (v.sku && v.sku.toLowerCase().includes(q)) ||
          (v.barcode && v.barcode.toLowerCase().includes(q))
        ));

      const matchesCategory =
        selectedCategory === 'all' ||
        (p.category && p.category.toLowerCase() === selectedCategory.toLowerCase());

      const stock = p.stock_quantity ?? 0;
      const threshold = p.low_stock_threshold ?? 5;

      let matchesStock = true;
      if (stockFilter === 'out_of_stock') {
        matchesStock = stock === 0;
      } else if (stockFilter === 'low_stock') {
        matchesStock = stock > 0 && stock <= threshold;
      } else if (stockFilter === 'in_stock') {
        matchesStock = stock > threshold;
      }

      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [products, search, selectedCategory, stockFilter]);

  // Overall Stats
  const totalProducts = products.length;
  const totalStock = products.reduce((acc, p) => acc + (p.stock_quantity || 0), 0);
  const totalSold = products.reduce((acc, p) => acc + (p.total_sold || 0), 0);
  const totalRevenue = products.reduce((acc, p) => acc + (p.total_sold || 0) * (p.price || 0), 0);
  const totalStockCost = products.reduce((acc, p) => acc + (p.stock_quantity || 0) * (p.cost_price || 0), 0);
  const totalPotentialProfit = products.reduce(
    (acc, p) => acc + (p.stock_quantity || 0) * Math.max(0, (p.price || 0) - (p.cost_price || 0)),
    0
  );
  const lowStockCount = products.filter(
    (p) => (p.stock_quantity ?? 0) <= (p.low_stock_threshold ?? 5) && (p.stock_quantity ?? 0) > 0
  ).length;
  const outOfStockCount = products.filter((p) => (p.stock_quantity ?? 0) === 0).length;

  return (
    <div className="flex-1 space-y-6 p-6">

      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              পণ্য ও ইনভেন্টরি হাব
            </h1>
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-xs font-semibold px-2.5 py-0.5">
              <Package className="mr-1 h-3.5 w-3.5 inline" /> {totalProducts} টি প্রোডাক্ট
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            ইনভেন্টরি স্টক ট্র্যাকিং, ভ্যারিয়েন্ট, পাইকারি অফার ও সরাসরি ফটো ম্যানেজমেন্ট
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Primary Action Button */}
          <Button
            onClick={openCreateDialog}
            className="shadow-md font-bold text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4"
          >
            <Plus className="h-4 w-4" /> নতুন প্রোডাক্ট যোগ করুন
          </Button>

          {/* Quick Feature Pills */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsForecastModalOpen(true)}
            className="gap-1.5 border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 h-9 text-xs shadow-xs"
            title="AI Inventory Demand Forecast & Stock-out Warnings"
          >
            <Brain className="h-3.5 w-3.5" />
            <span>AI ফোরকাস্ট</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSupplierPoModalOpen(true)}
            className="gap-1.5 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 h-9 text-xs shadow-xs"
            title="সাপ্লায়ার ও পারচেজ অর্ডার"
          >
            <Building2 className="h-3.5 w-3.5" />
            <span>সাপ্লায়ার ও PO</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsBundlesModalOpen(true)}
            className="gap-1.5 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 h-9 text-xs shadow-xs"
            title="কম্বো ও বান্ডেল প্যাকেজ"
          >
            <Layers className="h-3.5 w-3.5" />
            <span>কম্বো ও বান্ডেল</span>
          </Button>

          {/* More Tools Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1.5 h-9 rounded-md border border-input bg-background px-3 text-xs font-medium shadow-xs hover:bg-accent hover:text-accent-foreground cursor-pointer">
              <span>আরও টুলস</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-1.5">
              <DropdownMenuItem onClick={() => setIsMetaModalOpen(true)} className="text-xs gap-2 py-2 cursor-pointer">
                <Share2 className="h-3.5 w-3.5 text-blue-500" /> Meta / WhatsApp ক্যাটালগ
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsImportModalOpen(true)} className="text-xs gap-2 py-2 cursor-pointer">
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" /> CSV ফাইল থেকে ইমপোর্ট
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportCsv} className="text-xs gap-2 py-2 cursor-pointer">
                <Download className="h-3.5 w-3.5 text-muted-foreground" /> CSV ডাউনলোড (Export)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { setAiCopyProduct(null); setIsAiCopyOpen(true); }} className="text-xs gap-2 py-2 cursor-pointer">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> AI কপিরাইটার স্টুডিও
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { window.location.href = '/settings?tab=store'; }} className="text-xs gap-2 py-2 cursor-pointer">
                <Store className="h-3.5 w-3.5 text-primary" /> স্টোরফ্রন্ট CMS সেটিংস
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { window.open('/', '_blank'); }} className="text-xs gap-2 py-2 cursor-pointer">
                <ExternalLink className="h-3.5 w-3.5 text-amber-500" /> লাইভ স্টোর ভিজিট
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Grid vs Table View Mode */}
          <div className="flex items-center bg-muted/70 p-0.5 rounded-lg border border-border/40 h-9">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'grid' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="গ্রিড ভিউ"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'table' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="টেবিল ভিউ"
            >
              <TableIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={fetchProducts}
            disabled={loading}
            className="h-9 w-9 shrink-0 shadow-xs"
            title="রিফ্রেশ"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Stats KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-border/70 bg-card shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">ক্যাটালগ প্রোডাক্ট</p>
              <h3 className="text-2xl font-bold text-foreground mt-0.5">{totalProducts} <span className="text-xs font-normal text-muted-foreground">টি</span></h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">{totalStock} পিস মোট ওয়্যারহাউস স্টক</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Package className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/70 bg-card shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">বিক্রিত ইউনিট ও রেভিনিউ</p>
              <h3 className="text-2xl font-bold text-foreground mt-0.5">{totalSold} <span className="text-xs font-normal text-muted-foreground">পিস</span></h3>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
                মোট সেলস: ৳{totalRevenue.toLocaleString('en-BD')}
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
              <CircleDollarSign className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/70 bg-card shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">স্টক মূল্য ও সম্ভাব্য লাভ</p>
              <h3 className="text-2xl font-bold text-foreground mt-0.5">৳{totalPotentialProfit.toLocaleString('en-BD')}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                কেনা খরচ: ৳{totalStockCost.toLocaleString('en-BD')} • সম্ভাব্য গ্রস লাভ
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/70 bg-card shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">ইনভেন্টরি সতর্কতা</p>
              <h3 className="text-2xl font-bold text-foreground mt-0.5">
                {lowStockCount + outOfStockCount}
                <span className="text-xs font-normal text-muted-foreground ml-1.5">
                  ({lowStockCount} টি লো, {outOfStockCount} টি শেষ)
                </span>
              </h3>
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5 font-medium">
                {lowStockCount + outOfStockCount > 0 ? 'রিস্টক রিকমেন্ডেশন রয়েছে' : 'ইনভেন্টরি স্বাস্থ্য ভালো'}
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, SKU, or scan barcode (EAN-13)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-8 h-9"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs p-1"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setIsCameraScannerOpen(true)}
              className="h-9 w-9 shrink-0 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 shadow-xs"
              title="ক্যামেরা দিয়ে বারকোড স্ক্যান করুন"
            >
              <Camera className="h-4 w-4" />
            </Button>
          </div>

          {/* Stock Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-xs text-muted-foreground mr-1 flex items-center gap-1">
              <Package className="h-3.5 w-3.5" /> Stock:
            </span>
            <button
              onClick={() => setStockFilter('all')}
              className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                stockFilter === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStockFilter('in_stock')}
              className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                stockFilter === 'in_stock'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              In Stock
            </button>
            <button
              onClick={() => setStockFilter('low_stock')}
              className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors flex items-center gap-1 ${
                stockFilter === 'low_stock'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20'
              }`}
            >
              <AlertTriangle className="h-3 w-3" /> Low Stock ({lowStockCount})
            </button>
            <button
              onClick={() => setStockFilter('out_of_stock')}
              className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                stockFilter === 'out_of_stock'
                  ? 'bg-red-600 text-white'
                  : 'bg-red-500/10 text-red-600 hover:bg-red-500/20'
              }`}
            >
              Out of Stock ({outOfStockCount})
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-muted-foreground mr-1 flex items-center gap-1">
            <SlidersHorizontal className="h-3.5 w-3.5" /> Category:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {dynamicCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main View Area: Grid vs Table */}
      {loading ? (
        <div className="py-20 text-center text-muted-foreground">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-primary/60" />
          <p className="text-sm">Loading product catalog and inventory...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Package className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold text-foreground">No products found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {search || selectedCategory !== 'all' || stockFilter !== 'all'
              ? 'Try changing your search term or filters.'
              : 'Start by adding your first product.'}
          </p>
          <Button onClick={openCreateDialog} className="mt-4" size="sm">
            <Plus className="mr-2 h-4 w-4" /> Add New Product
          </Button>
        </div>
      ) : viewMode === 'table' ? (
        /* Analytics & Performance Table View */
        <div className="rounded-xl border border-border/60 overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border/60 font-medium">
                <tr>
                  <th className="p-3">Product Name</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Price</th>
                  <th className="p-3">Cost & Profit</th>
                  <th className="p-3">Stock Units</th>
                  <th className="p-3 text-center">Page Views</th>
                  <th className="p-3 text-center">Total Sold</th>
                  <th className="p-3 text-right">Revenue</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredProducts.map((p) => {
                  const stock = p.stock_quantity ?? 0;
                  const threshold = p.low_stock_threshold ?? 5;
                  const isOutOfStock = stock === 0;
                  const isLowStock = stock > 0 && stock <= threshold;
                  const revenue = (p.total_sold || 0) * (p.price || 0);

                  return (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-muted overflow-hidden flex-shrink-0 border border-border/40">
                          {p.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                              <Package className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate max-w-[200px]" title={p.name}>
                            {p.name}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                            <span className="font-mono">SKU: {p.sku || 'N/A'}</span>
                            {p.variants && p.variants.length > 0 && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0">
                                {p.variants.length} Variants
                              </Badge>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge variant="secondary" className="text-[10px] capitalize">
                          {p.category || 'General'}
                        </Badge>
                      </td>
                      <td className="p-3 font-semibold text-foreground">
                        ৳{p.price.toLocaleString('en-BD')}
                      </td>
                      <td className="p-3">
                        {p.cost_price ? (
                          <div>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              +৳{(p.price - p.cost_price).toLocaleString('en-BD')}
                            </span>
                            <p className="text-[10px] text-muted-foreground">
                              Cost: ৳{p.cost_price} ({(((p.price - p.cost_price) / p.price) * 100).toFixed(0)}%)
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-[10px]">Cost not set</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-bold ${
                              isOutOfStock
                                ? 'text-red-600'
                                : isLowStock
                                ? 'text-amber-600'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {stock} pcs
                          </span>
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => handleStockDelta(p, -1)}
                              disabled={stock <= 0}
                              className="h-5 w-5 rounded bg-muted hover:bg-muted/80 text-[10px] flex items-center justify-center font-bold"
                              title="Decrease 1"
                            >
                              -
                            </button>
                            <button
                              onClick={() => handleStockDelta(p, 1)}
                              className="h-5 w-5 rounded bg-muted hover:bg-muted/80 text-[10px] flex items-center justify-center font-bold"
                              title="Add 1"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-center text-muted-foreground font-mono">
                        {p.view_count || 0}
                      </td>
                      <td className="p-3 text-center font-bold text-foreground font-mono">
                        {p.total_sold || 0}
                      </td>
                      <td className="p-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        ৳{revenue.toLocaleString('en-BD')}
                      </td>
                      <td className="p-3 text-center">
                        <Badge
                          variant={p.is_active ? 'default' : 'outline'}
                          className={`text-[9px] ${
                            p.is_active ? 'bg-emerald-600 text-white' : 'text-muted-foreground'
                          }`}
                        >
                          {p.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            title="Print Barcode & Thermal Sticker"
                            onClick={() => {
                              setBarcodeProduct(p);
                              setIsBarcodeModalOpen(true);
                            }}
                          >
                            <BarcodeIcon className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Stock History Logs"
                            onClick={() => openHistoryDialog(p)}
                          >
                            <History className="h-3.5 w-3.5" />
                          </Button>
                          <Link
                            href={`/p/${p.slug || p.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-muted-foreground hover:text-foreground rounded"
                            title="Open Single Order Page"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-amber-500 hover:bg-amber-500/10"
                            title="Customer Reviews & Ratings"
                            onClick={() => {
                              setReviewsProduct(p);
                              setIsReviewsModalOpen(true);
                            }}
                          >
                            <Star className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-primary hover:bg-primary/10"
                            title="AI Sales Copy"
                            onClick={() => {
                              setAiCopyProduct(p);
                              setIsAiCopyOpen(true);
                            }}
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Edit"
                            onClick={() => openEditDialog(p)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Visual Cards Grid View */
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((p) => {
            const hasDiscount = p.regular_price && p.regular_price > p.price;
            const discountPct = hasDiscount
              ? Math.round(((p.regular_price! - p.price) / p.regular_price!) * 100)
              : null;

            const stock = p.stock_quantity ?? 0;
            const threshold = p.low_stock_threshold ?? 5;
            const isOutOfStock = stock === 0;
            const isLowStock = stock > 0 && stock <= threshold;

            return (
              <Card
                key={p.id}
                className={`overflow-hidden border transition-all hover:border-primary/50 hover:shadow-sm ${
                  !p.is_active ? 'opacity-70 bg-muted/20' : 'bg-card'
                }`}
              >
                {/* Product Image Banner */}
                <div className="relative h-44 w-full bg-muted/40 overflow-hidden group">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground/60 bg-muted/30">
                      <Package className="h-12 w-12 stroke-[1.2]" />
                      <span className="text-xs mt-1">No Image Available</span>
                    </div>
                  )}

                  {/* Badges Overlay */}
                  <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1">
                    {p.badge_text ? (
                      <Badge className="bg-amber-500 text-neutral-950 font-bold text-[10px] uppercase">
                        {p.badge_text}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] uppercase font-semibold tracking-wider">
                        {p.category || 'General'}
                      </Badge>
                    )}
                    {discountPct && (
                      <Badge className="bg-red-500 text-white text-[10px] font-bold">
                        {discountPct}% OFF
                      </Badge>
                    )}
                  </div>

                  <div className="absolute top-2.5 right-2.5 flex flex-col items-end gap-1">
                    {/* Live Single Page Link Button */}
                    <Link
                      href={`/p/${p.slug || p.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded bg-black/75 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur hover:bg-black transition-colors"
                      title="View public single order page"
                    >
                      <span>Live Page</span>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </Link>

                    {/* Stock Status Badge */}
                    {isOutOfStock ? (
                      <Badge variant="destructive" className="text-[10px] font-bold animate-pulse">
                        Out of Stock
                      </Badge>
                    ) : isLowStock ? (
                      <Badge className="bg-amber-600 text-white text-[10px] font-semibold flex items-center gap-0.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                        Low: {stock} left
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-600 text-white text-[10px] font-medium">
                        In Stock: {stock}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Content */}
                <CardContent className="p-4 space-y-3">
                  {/* Title & SKU */}
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-foreground text-sm line-clamp-1" title={p.name}>
                        {p.name}
                      </h3>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-0.5">
                      <span className="font-mono">SKU: {p.sku || 'N/A'}</span>
                      {p.slug && (
                        <span className="text-[10px] text-muted-foreground/80 truncate max-w-[140px]" title={`/p/${p.slug}`}>
                          /p/{p.slug}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Price Row */}
                  <div className="flex items-baseline justify-between">
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-bold text-foreground">
                        ৳{p.price.toLocaleString('en-BD')}
                      </span>
                      {hasDiscount && (
                        <span className="text-xs text-muted-foreground line-through">
                          ৳{p.regular_price?.toLocaleString('en-BD')}
                        </span>
                      )}
                    </div>
                    {/* Performance metrics */}
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span title="Total Page Views">👁️ {p.view_count || 0}</span>
                      <span title="Units Sold">📦 {p.total_sold || 0} sold</span>
                    </div>
                  </div>

                  {/* Unit Profit Pill */}
                  {p.cost_price ? (
                    <div className="flex items-center justify-between text-[11px] bg-emerald-500/5 border border-emerald-500/20 px-2 py-1 rounded-md">
                      <span className="text-muted-foreground">Profit per unit:</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        +৳{(p.price - p.cost_price).toLocaleString('en-BD')} ({(((p.price - p.cost_price) / p.price) * 100).toFixed(0)}%)
                      </span>
                    </div>
                  ) : null}

                  {/* Stock Quick Adjustment Bar */}
                  <div className="rounded-lg bg-muted/50 p-2 border border-border/40 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-muted-foreground flex items-center gap-1 text-[11px]">
                        <Package className="h-3 w-3" /> Current Stock:
                      </span>
                      <span
                        className={`font-bold text-xs ${
                          isOutOfStock
                            ? 'text-red-600'
                            : isLowStock
                            ? 'text-amber-600'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {stock} pcs
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-1 pt-1">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6 text-xs"
                          disabled={stock <= 0}
                          onClick={() => handleStockDelta(p, -1)}
                          title="Reduce 1 piece"
                        >
                          -1
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6 text-xs"
                          onClick={() => handleStockDelta(p, 1)}
                          title="Add 1 piece"
                        >
                          +1
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-1.5 text-[10px]"
                          onClick={() => handleStockDelta(p, 5)}
                          title="Quick restock 5 pieces"
                        >
                          +5
                        </Button>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-[10px] text-muted-foreground"
                          onClick={() => openHistoryDialog(p)}
                          title="Stock Audit Logs"
                        >
                          <History className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-6 px-2 text-[10px] font-medium"
                          onClick={() => {
                            setRestockProduct(p);
                            setRestockQty(String(p.stock_quantity ?? 0));
                          }}
                        >
                          Set Stock
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Public Page & Pitch Action Row */}
                  <div className="flex items-center justify-between gap-1 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] gap-1 flex-1 text-muted-foreground hover:text-foreground"
                      onClick={() => handleCopyPageLink(p)}
                      title="Copy public single product landing URL"
                    >
                      {copiedLinkId === p.id ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-500" />
                          <span>Link Copied!</span>
                        </>
                      ) : (
                        <>
                          <Link2 className="h-3 w-3" />
                          <span>Order Link</span>
                        </>
                      )}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] gap-1 flex-1 font-medium"
                      onClick={() => handleCopyShowcase(p)}
                      title="Copy full WhatsApp showcase pitch with order link"
                    >
                      {copiedId === p.id ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-500" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3 w-3 text-amber-500" />
                          <span>Copy Pitch</span>
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-2 border-t flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-amber-500 hover:bg-amber-500/10"
                        title="Customer Reviews & Ratings"
                        onClick={() => {
                          setReviewsProduct(p);
                          setIsReviewsModalOpen(true);
                        }}
                      >
                        <Star className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-primary hover:bg-primary/10"
                        title="AI Sales Copy"
                        onClick={() => {
                          setAiCopyProduct(p);
                          setIsAiCopyOpen(true);
                        }}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10"
                        title="AI Dynamic Catalog Ad Studio (Meta / TikTok / Google)"
                        onClick={() => {
                          setAdStudioProduct(p);
                          setIsAdStudioOpen(true);
                        }}
                      >
                        <Layers className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title="Print Barcode & Thermal Sticker"
                        onClick={() => {
                          setBarcodeProduct(p);
                          setIsBarcodeModalOpen(true);
                        }}
                      >
                        <BarcodeIcon className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title="Edit product"
                        onClick={() => openEditDialog(p)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title="Preview showcase pitch"
                        onClick={() => setPreviewProduct(p)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Delete product"
                        onClick={() => setDeleteId(p.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(p)}
                        className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                          p.is_active
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20'
                            : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                        }`}
                        title="Toggle active in showcase"
                      >
                        {p.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Stock Audit & Quick Restock Modal */}
      <StockAuditModal
        product={historyProduct}
        isOpen={!!historyProduct}
        onClose={() => setHistoryProduct(null)}
        onStockUpdated={(productId, newStock) => {
          setProducts((prev) =>
            prev.map((p) => (p.id === productId ? { ...p, stock_quantity: newStock } : p))
          );
        }}
      />

      {/* Quick Restock Dialog (Ultra-Modern & Responsive) */}
      <Dialog open={!!restockProduct} onOpenChange={() => setRestockProduct(null)}>
        <DialogContent className="w-[95vw] sm:max-w-md rounded-2xl p-5 border shadow-2xl bg-card">
          <DialogHeader className="pb-3 border-b">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
                {restockProduct?.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={restockProduct.image_url}
                    alt={restockProduct.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Package className="h-6 w-6 text-primary" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-bold text-foreground truncate">
                  {restockProduct?.name}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                  <span className="font-mono">SKU: {restockProduct?.sku || 'N/A'}</span>
                  <span>•</span>
                  <span>বর্তমান স্টক: <strong className="text-foreground">{restockProduct?.stock_quantity ?? 0} pcs</strong></span>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Input + Quick Steppers */}
            <div className="space-y-2">
              <Label htmlFor="restock_qty" className="text-xs font-semibold flex items-center justify-between">
                <span>নতুন ইন-স্টক সংখ্যা নির্ধারণ করুন</span>
                <span className="text-[11px] text-muted-foreground font-normal">একক: পিস (pcs)</span>
              </Label>
              <div className="relative">
                <Input
                  id="restock_qty"
                  type="number"
                  min="0"
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  placeholder="যেমন: 25"
                  className="h-11 text-base font-bold font-mono pl-3 pr-14"
                  autoFocus
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium pointer-events-none">
                  pcs
                </span>
              </div>
            </div>

            {/* Quick Adjustment Pills */}
            <div className="space-y-1.5">
              <span className="text-[11px] text-muted-foreground font-medium block">
                কুইক অ্যাডজাস্টমেন্ট বাটন:
              </span>
              <div className="grid grid-cols-6 gap-1.5">
                {[
                  { label: '-10', val: -10 },
                  { label: '-1', val: -1 },
                  { label: '+1', val: 1 },
                  { label: '+5', val: 5 },
                  { label: '+10', val: 10 },
                  { label: '+25', val: 25 },
                ].map((step) => (
                  <Button
                    key={step.label}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-mono px-0 font-semibold hover:bg-primary/10 hover:border-primary/40"
                    onClick={() => {
                      const cur = parseInt(restockQty || '0', 10) || 0;
                      const next = Math.max(0, cur + step.val);
                      setRestockQty(String(next));
                    }}
                  >
                    {step.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Projected Stock Diff Banner */}
            {restockProduct && (
              <div className="rounded-xl p-3 bg-muted/50 border border-border/60 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">স্টক পরিবর্তন:</span>
                <div className="flex items-center gap-2 font-mono font-bold">
                  <span className="text-muted-foreground">{restockProduct.stock_quantity ?? 0}</span>
                  <span className="text-muted-foreground">➔</span>
                  <span className={Number(restockQty) > (restockProduct.stock_quantity ?? 0) ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}>
                    {Number(restockQty) || 0} pcs
                  </span>
                  <Badge variant="secondary" className="text-[10px] ml-1">
                    {Number(restockQty) - (restockProduct.stock_quantity ?? 0) >= 0 ? '+' : ''}
                    {Number(restockQty) - (restockProduct.stock_quantity ?? 0)}
                  </Badge>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => setRestockProduct(null)}>
              বাতিল
            </Button>
            <Button size="sm" onClick={handleDirectRestock} disabled={isRestocking} className="font-semibold shadow-xs">
              {isRestocking ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  সংরক্ষণ হচ্ছে...
                </>
              ) : (
                'স্টক আপডেট নিশ্চিত করুন'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Create / Edit Modal (Ultra-Modern Tabbed & Responsive) */}
      <ProductFormModal
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        product={editingProduct}
        onSuccess={fetchProducts}
        business={business}
        dynamicCategories={dynamicCategories}
      />

      {/* Showcase Pitch Preview Dialog (Modern WhatsApp UI & Mobile Responsive) */}
      <Dialog open={!!previewProduct} onOpenChange={() => setPreviewProduct(null)}>
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[88vh] flex flex-col p-0 overflow-hidden bg-background rounded-2xl border shadow-2xl">
          <div className="bg-[#075e54] text-white p-3.5 flex items-center justify-between shrink-0 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs ring-2 ring-white/30">
                {business?.store_name ? business.store_name.slice(0, 2).toUpperCase() : 'WA'}
              </div>
              <div>
                <p className="font-semibold text-xs leading-none">
                  {business?.store_name || 'WhatsApp Store'}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <p className="text-[10px] text-white/80">অনলাইন • ক্যাটালগ শোকেস পিচ</p>
                </div>
              </div>
            </div>
            <Badge variant="outline" className="border-white/30 text-white text-[10px] bg-white/10">
              কাস্টমার চ্যাট ভিউ
            </Badge>
          </div>

          {previewProduct && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#e5ddd5]/30 dark:bg-zinc-950">
              <div className="relative bg-card dark:bg-emerald-950/40 border border-emerald-500/20 p-4 rounded-2xl rounded-tl-none text-xs font-mono whitespace-pre-wrap leading-relaxed shadow-sm">
                {formatShowcasePitch(previewProduct)}
                <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground mt-2">
                  <span>এখনই পাঠানো হয়েছে</span>
                  <Check className="h-3 w-3 text-emerald-500 inline" />
                </div>
              </div>
            </div>
          )}

          <div className="p-3 bg-muted/40 border-t flex items-center justify-between gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={() => setPreviewProduct(null)} className="text-xs">
              বন্ধ করুন
            </Button>
            <Button
              size="sm"
              className="gap-1.5 font-bold text-xs bg-[#25d366] hover:bg-[#20ba5a] text-black shadow-sm"
              onClick={() => {
                if (previewProduct) {
                  handleCopyShowcase(previewProduct);
                  setPreviewProduct(null);
                }
              }}
            >
              <Copy className="h-3.5 w-3.5" /> পিচ কপি করুন
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog (Ultra-Modern Warning) */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="w-[95vw] sm:max-w-sm rounded-2xl p-6 border shadow-2xl bg-card">
          <DialogHeader className="text-center sm:text-left space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto sm:mx-0">
              <Trash2 className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                প্রোডাক্টটি ডিলিট করতে চান?
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1.5 leading-normal">
                এই পণ্যটি ক্যাটালগ এবং পাবলিক সিঙ্গেল ল্যান্ডিং পেজ থেকে চিরতরে মুছে যাবে। এই কাজটি পূর্বাবস্থায় ফেরানো সম্ভব নয়।
              </DialogDescription>
            </div>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-3 flex-col sm:flex-row">
            <Button variant="outline" size="sm" onClick={() => setDeleteId(null)} className="w-full sm:w-auto">
              বাতিল
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDeleteProduct} className="w-full sm:w-auto font-semibold">
              হ্যাঁ, মুছে ফেলুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Copywriter & Sales Pitch Dialog */}
      <AiCopywriterDialog
        product={aiCopyProduct}
        open={isAiCopyOpen}
        onOpenChange={setIsAiCopyOpen}
        onApplyToDescription={(text) => {
          navigator.clipboard.writeText(text);
          toast.success('AI কপি ক্লিপবোর্ডে কপি করা হয়েছে! প্রোডাক্ট বিবরণীতে পেস্ট করতে পারেন।');
        }}
      />

      {/* Barcode & Thermal Label Printer Modal */}
      <BarcodeLabelModal
        product={barcodeProduct}
        open={isBarcodeModalOpen}
        onOpenChange={setIsBarcodeModalOpen}
        storeName={business?.store_name || 'Online Store'}
      />

      {/* Bulk CSV / Excel Import Modal */}
      <CsvImportModal
        open={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
        onImportSuccess={fetchProducts}
      />

      {/* Meta Commerce & WhatsApp Catalog Data Feed Modal */}
      <MetaCatalogModal
        open={isMetaModalOpen}
        onOpenChange={setIsMetaModalOpen}
        accountId={business?.account_id}
      />

      {/* Customer Reviews & Testimonials Modal */}
      <ProductReviewsModal
        product={reviewsProduct}
        open={isReviewsModalOpen}
        onOpenChange={setIsReviewsModalOpen}
      />

      {/* Product Bundles & Combos Modal */}
      <ProductBundlesModal
        open={isBundlesModalOpen}
        onOpenChange={setIsBundlesModalOpen}
        products={products}
      />

      {/* AI Inventory Demand Forecast Modal */}
      <InventoryForecastModal
        isOpen={isForecastModalOpen}
        onClose={() => setIsForecastModalOpen(false)}
        onQuickRestock={(p) => {
          setIsForecastModalOpen(false);
          const matched = products.find((prod) => prod.id === p.id);
          if (matched) {
            openHistoryDialog(matched);
          }
        }}
      />

      {/* Live Camera Barcode & QR Scanner Modal */}
      <CameraBarcodeScannerModal
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        onScan={(barcode) => {
          setSearch(barcode);
          toast.success(`বারকোড স্ক্যান সফল: ${barcode}`);
        }}
        title="প্রোডাক্ট বারকোড স্ক্যানার"
        description="ক্যামেরা বারকোডের দিকে তাক করুন, স্বয়ংক্রিয়ভাবে ফিল্টার হবে"
      />

      {/* Supplier & Purchase Orders Modal */}
      <SupplierPoModal
        open={isSupplierPoModalOpen}
        onOpenChange={setIsSupplierPoModalOpen}
        products={products}
        onStockUpdated={fetchProducts}
      />

      {/* AI Dynamic Catalog Ad Studio Dialog */}
      <CatalogAdStudioDialog
        open={isAdStudioOpen}
        onOpenChange={setIsAdStudioOpen}
        product={adStudioProduct}
      />
    </div>
  );
}
