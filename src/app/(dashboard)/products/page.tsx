'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import type { Product, ProductVariant, ProductStockLog } from '@/types/watch';
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
import {
  Watch,
  Plus,
  Search,
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick Restock Dialog
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [restockQty, setRestockQty] = useState('');
  const [isRestocking, setIsRestocking] = useState(false);

  // Stock Audit History Dialog
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [stockLogs, setStockLogs] = useState<ProductStockLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Image Upload State
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form inputs
  const [formData, setFormData] = useState<{
    name: string;
    sku: string;
    slug: string;
    badge_text: string;
    category: string;
    price: string;
    regular_price: string;
    stock_quantity: string;
    low_stock_threshold: string;
    image_url: string;
    images: string[];
    variants: ProductVariant[];
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
    slug: '',
    badge_text: '',
    category: 'General',
    price: '',
    regular_price: '',
    stock_quantity: '15',
    low_stock_threshold: '5',
    image_url: '',
    images: [],
    variants: [],
    dial_size: '42mm',
    water_resistance: '3ATM / 30M',
    movement: 'Japanese Quartz',
    strap_type: 'Genuine Leather',
    colors: 'Black, Silver',
    warranty_months: '12',
    description: '',
    is_active: true,
  });

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/products?include_inactive=true');
      const data = await res.json();
      if (res.ok && data.products) {
        setProducts(data.products);
      } else {
        toast.error(data.error || 'Failed to fetch products');
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
    setFormData({
      name: '',
      sku: '',
      slug: '',
      badge_text: 'HOT DEAL',
      category: 'General',
      price: '',
      regular_price: '',
      stock_quantity: '15',
      low_stock_threshold: '5',
      image_url: '',
      images: [],
      variants: [],
      dial_size: '42mm',
      water_resistance: '3ATM / 30M',
      movement: 'Japanese Quartz',
      strap_type: 'Genuine Leather',
      colors: 'Black, Silver, Brown',
      warranty_months: '12',
      description: '',
      is_active: true,
    });
    setIsFormOpen(true);
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      sku: product.sku || '',
      slug: product.slug || '',
      badge_text: product.badge_text || '',
      category: product.category || 'quartz',
      price: String(product.price),
      regular_price: product.regular_price ? String(product.regular_price) : '',
      stock_quantity: String(product.stock_quantity ?? 0),
      low_stock_threshold: String(product.low_stock_threshold ?? 5),
      image_url: product.image_url || '',
      images: Array.isArray(product.images) ? product.images : (product.image_url ? [product.image_url] : []),
      variants: Array.isArray(product.variants) ? product.variants : [],
      dial_size: product.dial_size || '42mm',
      water_resistance: product.water_resistance || '3ATM / 30M',
      movement: product.movement || 'Japanese Quartz',
      strap_type: product.strap_type || 'Genuine Leather',
      colors: Array.isArray(product.colors) ? product.colors.join(', ') : 'Black',
      warranty_months: String(product.warranty_months || 12),
      description: product.description || '',
      is_active: product.is_active,
    });
    setIsFormOpen(true);
  };

  // Image Upload handler
  const handleImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setIsUploadingImage(true);
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const body = new FormData();
        body.append('file', file);

        const res = await fetch('/api/products/upload', {
          method: 'POST',
          body,
        });

        const data = await res.json();
        if (res.ok && data.url) {
          setFormData((prev) => {
            const nextImages = [...prev.images, data.url];
            return {
              ...prev,
              images: nextImages,
              image_url: prev.image_url || data.url,
            };
          });
          toast.success(`Image "${file.name}" uploaded successfully!`);
        } else {
          toast.error(data.error || 'Failed to upload image');
        }
      }
    } catch {
      toast.error('Network error during image upload');
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setFormData((prev) => {
      const nextImages = prev.images.filter((_, idx) => idx !== indexToRemove);
      const nextImageUrl = prev.image_url === prev.images[indexToRemove]
        ? (nextImages[0] || '')
        : prev.image_url;
      return {
        ...prev,
        images: nextImages,
        image_url: nextImageUrl,
      };
    });
  };

  // Variant management in form
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

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.price.trim()) {
      toast.error('Watch name and price are required');
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
        slug: formData.slug.trim() || undefined,
        badge_text: formData.badge_text.trim() || null,
        category: formData.category,
        price: parseFloat(formData.price) || 0,
        regular_price: formData.regular_price ? parseFloat(formData.regular_price) : null,
        stock_quantity: calculatedStock,
        low_stock_threshold: parseInt(formData.low_stock_threshold, 10) || 5,
        image_url: formData.image_url.trim() || (formData.images[0] || null),
        images: formData.images,
        variants: formData.variants,
        dial_size: formData.dial_size.trim(),
        water_resistance: formData.water_resistance.trim(),
        movement: formData.movement.trim(),
        strap_type: formData.strap_type.trim(),
        colors: colorsArray,
        warranty_months: parseInt(formData.warranty_months, 10) || 12,
        description: formData.description.trim() || null,
        is_active: formData.is_active,
      };

      if (editingProduct) {
        const res = await fetch('/api/products', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingProduct.id, ...payload }),
        });
        const data = await res.json();
        if (res.ok) {
          toast.success('Watch model & variants updated successfully');
          setIsFormOpen(false);
          fetchProducts();
        } else {
          toast.error(data.error || 'Failed to update watch');
        }
      } else {
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok) {
          toast.success('New watch, variants, and single landing page created!');
          setIsFormOpen(false);
          fetchProducts();
        } else {
          toast.error(data.error || 'Failed to add watch');
        }
      }
    } catch {
      toast.error('An error occurred while saving watch');
    } finally {
      setIsSubmitting(false);
    }
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
  const openHistoryDialog = async (product: Product) => {
    setHistoryProduct(product);
    setStockLogs([]);
    setLoadingLogs(true);
    try {
      const res = await fetch(`/api/products/${product.id}/logs`);
      const data = await res.json();
      if (res.ok && data.logs) {
        setStockLogs(data.logs);
      } else {
        toast.error(data.error || 'Failed to load stock audit history');
      }
    } catch {
      toast.error('Network error loading stock history');
    } finally {
      setLoadingLogs(false);
    }
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
        toast.success(nextActive ? 'Watch activated for showcase' : 'Watch deactivated');
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
        toast.success('Watch removed from catalog');
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
    const colors = p.colors?.length ? p.colors.join(' | ') : 'Black';
    const publicUrl = getProductPublicUrl(p);

    return (
      `⌚ *${p.name.toUpperCase()}*\n` +
      `🏷️ মডেল কোড: ${p.sku || 'N/A'}\n\n` +
      `✨ *প্রিমিয়াম স্পেসিফিকেশন:*\n` +
      `• ডায়াল সাইজ: ${p.dial_size || '42mm'}\n` +
      `• মুভমেন্ট: ${p.movement || 'Japanese Quartz'}\n` +
      `• ওয়াটার রেজিস্ট্যান্ট: ${p.water_resistance || '3ATM Waterproof'}\n` +
      `• স্ট্র্যাপ: ${p.strap_type || 'Genuine Leather'}\n` +
      `• কালার অপশন: ${colors}\n` +
      `• ওয়ারেন্টি: ${p.warranty_months} মাসের অফিশিয়াল ওয়ারেন্টি কার্ড 🛡️\n\n` +
      `💰 *মূল্য:* ${regular}*৳${p.price.toLocaleString('en-BD')}*${discount}\n\n` +
      `🚚 ক্যাশ অন ডেলিভারি সুবিধা (ঢাকার ভেতরে ডেলিভারি চার্জ ৳১০০, ঢাকার বাইরে ৳১৫০ অগ্রিম প্রযোজ্য)।\n` +
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
      const matchesSearch =
        search === '' ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()));

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
  const totalWatches = products.length;
  const totalStock = products.reduce((acc, p) => acc + (p.stock_quantity || 0), 0);
  const totalSold = products.reduce((acc, p) => acc + (p.total_sold || 0), 0);
  const totalRevenue = products.reduce((acc, p) => acc + (p.total_sold || 0) * (p.price || 0), 0);
  const lowStockCount = products.filter(
    (p) => (p.stock_quantity ?? 0) <= (p.low_stock_threshold ?? 5) && (p.stock_quantity ?? 0) > 0
  ).length;
  const outOfStockCount = products.filter((p) => (p.stock_quantity ?? 0) === 0).length;

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Products & Inventory Hub
            </h1>
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-xs font-semibold">
              <Watch className="mr-1 h-3 w-3" /> E-Commerce Suite
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Variants with stock tracking, direct drag & drop photo upload, sales analytics, and auto landing pages.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Grid vs Table View Mode */}
          <div className="flex items-center bg-muted/70 p-0.5 rounded-lg border border-border/40">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'grid' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'table' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Sales & Analytics Table View"
            >
              <TableIcon className="h-4 w-4" />
            </button>
          </div>

          <Link href="/settings?tab=delivery">
            <Button variant="outline" size="sm" className="gap-1.5 shadow-xs">
              <Truck className="h-4 w-4 text-primary" />
              <span>Delivery Pricing</span>
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={fetchProducts} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={openCreateDialog} className="shadow-sm">
            <Plus className="mr-2 h-4 w-4" /> Add New Watch
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-border/60 bg-card/60 shadow-none">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Catalog Models</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{totalWatches}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">{totalStock} pcs in warehouse</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Watch className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/60 bg-card/60 shadow-none">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Units Sold</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{totalSold} <span className="text-xs font-normal text-muted-foreground">units</span></h3>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">Recorded via orders</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Package className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/60 bg-card/60 shadow-none">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Sales Revenue</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">৳{totalRevenue.toLocaleString('en-BD')}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Across watch models</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <CircleDollarSign className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/60 bg-card/60 shadow-none">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Stock Alerts</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {lowStockCount + outOfStockCount}
                <span className="text-xs font-normal text-muted-foreground ml-1.5">
                  ({lowStockCount} low, {outOfStockCount} out)
                </span>
              </h3>
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5 font-medium">
                {lowStockCount + outOfStockCount > 0 ? 'Requires attention' : 'Inventory healthy'}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by watch name or model code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
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
          <p className="text-sm">Loading watch catalog and inventory...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Watch className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold text-foreground">No watch models found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {search || selectedCategory !== 'all' || stockFilter !== 'all'
              ? 'Try changing your search term or filters.'
              : 'Start by adding your first manly watch model.'}
          </p>
          <Button onClick={openCreateDialog} className="mt-4" size="sm">
            <Plus className="mr-2 h-4 w-4" /> Add New Watch
          </Button>
        </div>
      ) : viewMode === 'table' ? (
        /* Analytics & Performance Table View */
        <div className="rounded-xl border border-border/60 overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border/60 font-medium">
                <tr>
                  <th className="p-3">Watch Model</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Price</th>
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
                              <Watch className="h-5 w-5" />
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
                          {p.category || 'Quartz'}
                        </Badge>
                      </td>
                      <td className="p-3 font-semibold text-foreground">
                        ৳{p.price.toLocaleString('en-BD')}
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
                {/* Watch Image Banner */}
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
                      <Watch className="h-12 w-12 stroke-[1.2]" />
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
                        {p.category || 'Watch'}
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
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title="Edit watch"
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
                        title="Delete watch"
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

      {/* Stock Audit History Dialog */}
      <Dialog open={!!historyProduct} onOpenChange={() => setHistoryProduct(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <History className="h-5 w-5 text-primary" />
              Stock Audit Trail — {historyProduct?.name}
            </DialogTitle>
            <DialogDescription>
              Chronological log of restocks, manual adjustments, and customer orders.
            </DialogDescription>
          </DialogHeader>

          {loadingLogs ? (
            <div className="py-8 text-center text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p className="text-xs">Loading audit trail...</p>
            </div>
          ) : stockLogs.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-xs">
              No audit logs recorded yet for this product.
            </div>
          ) : (
            <div className="space-y-2 py-2">
              {stockLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-lg border border-border/50 p-2.5 text-xs flex items-center justify-between bg-muted/20"
                >
                  <div>
                    <div className="flex items-center gap-1.5 font-medium">
                      <span
                        className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                          log.change_qty > 0
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : 'bg-red-500/10 text-red-600'
                        }`}
                      >
                        {log.change_qty > 0 ? `+${log.change_qty}` : log.change_qty} pcs
                      </span>
                      <span className="capitalize text-muted-foreground text-[11px]">
                        {log.reason.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(log.created_at).toLocaleString('en-BD')}
                    </p>
                  </div>
                  <div className="text-right text-[11px]">
                    <span className="text-muted-foreground">{log.previous_stock}</span>
                    <span className="mx-1 text-muted-foreground">➔</span>
                    <span className="font-bold text-foreground">{log.new_stock}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Quick Restock Dialog */}
      <Dialog open={!!restockProduct} onOpenChange={() => setRestockProduct(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Adjust Stock Quantity
            </DialogTitle>
            <DialogDescription>
              Update total in-stock units for {restockProduct?.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="restock_qty">Total Quantity in Stock</Label>
              <Input
                id="restock_qty"
                type="number"
                min="0"
                value={restockQty}
                onChange={(e) => setRestockQty(e.target.value)}
                placeholder="e.g. 25"
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground">
              This action will be automatically recorded in the product stock audit log.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setRestockProduct(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleDirectRestock} disabled={isRestocking}>
              {isRestocking ? 'Updating...' : 'Save Stock'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Watch Modal */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Watch className="h-5 w-5 text-primary" />
              {editingProduct ? 'Edit Watch Model & Variants' : 'Add New Watch with Variants & Direct Upload'}
            </DialogTitle>
            <DialogDescription>
              Configure watch specifications, direct image uploads, variant stocks, and pricing (৳).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveProduct} className="space-y-5 py-2">
            {/* Section 1: Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="name">Watch Model Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g. Curren 8329 Luxury Chronograph Quartz Watch"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sku">Model Code / SKU</Label>
                <Input
                  id="sku"
                  placeholder="e.g. CR-8329-SLV"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="slug">Custom URL Slug (Optional)</Label>
                <Input
                  id="slug"
                  placeholder="e.g. curren-8329-luxury"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground">
                  Public page: <code className="bg-muted px-1 rounded">/p/{formData.slug || '[auto-generated]'}</code>
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="category">Category</Label>
                  <span className="text-[10px] text-muted-foreground">Select or type custom</span>
                </div>
                <Input
                  id="category"
                  list="category-options-list"
                  placeholder="e.g. General, Fashion, Electronics, Cosmetics, Watches..."
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full"
                />
                <datalist id="category-options-list">
                  {dynamicCategories
                    .filter((c) => c.id !== 'all')
                    .map((cat) => (
                      <option key={cat.id} value={cat.label} />
                    ))}
                </datalist>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="badge">Promotional Badge (Optional)</Label>
                <Input
                  id="badge"
                  placeholder="e.g. BESTSELLER, HOT DEAL, LIMITED"
                  value={formData.badge_text}
                  onChange={(e) => setFormData({ ...formData, badge_text: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="price">Selling Price (৳ BDT) *</Label>
                <Input
                  id="price"
                  type="number"
                  placeholder="2450"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="regular_price">Regular / MRP Price (৳ BDT)</Label>
                <Input
                  id="regular_price"
                  type="number"
                  placeholder="3500 (for discount display)"
                  value={formData.regular_price}
                  onChange={(e) => setFormData({ ...formData, regular_price: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="stock">Base Stock Quantity</Label>
                <Input
                  id="stock"
                  type="number"
                  min="0"
                  placeholder="15"
                  value={formData.stock_quantity}
                  onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                  disabled={formData.variants.length > 0}
                />
                {formData.variants.length > 0 && (
                  <p className="text-[10px] text-amber-500">Calculated automatically from variant stocks below</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="low_stock">Low Stock Alert Threshold</Label>
                <Input
                  id="low_stock"
                  type="number"
                  min="1"
                  placeholder="5"
                  value={formData.low_stock_threshold}
                  onChange={(e) => setFormData({ ...formData, low_stock_threshold: e.target.value })}
                />
              </div>
            </div>

            {/* Section 2: Direct Image Drag & Drop Upload */}
            <div className="space-y-2 border-t pt-4">
              <Label className="text-sm font-semibold flex items-center justify-between">
                <span>Product Images & Gallery (Direct Upload)</span>
                <span className="text-xs text-muted-foreground">{formData.images.length} images uploaded</span>
              </Label>

              {/* Upload Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border/80 hover:border-primary/80 rounded-xl p-4 text-center cursor-pointer transition-colors bg-muted/20 hover:bg-muted/30"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  multiple
                  onChange={handleImageFileSelect}
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center gap-1.5">
                  <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    {isUploadingImage ? (
                      <RefreshCw className="h-5 w-5 animate-spin" />
                    ) : (
                      <Upload className="h-5 w-5" />
                    )}
                  </div>
                  <p className="text-xs font-semibold text-foreground">
                    {isUploadingImage ? 'Uploading image to storage...' : 'Click or Drag & Drop watch photos here'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">PNG, JPG, or WebP up to 10MB each</p>
                </div>
              </div>

              {/* Uploaded Thumbnails Grid */}
              {formData.images.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {formData.images.map((url, idx) => {
                    const isCover = formData.image_url === url;
                    return (
                      <div
                        key={idx}
                        className={`relative h-18 w-18 rounded-lg overflow-hidden border-2 group ${
                          isCover ? 'border-primary ring-1 ring-primary' : 'border-border'
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Upload ${idx}`} className="h-full w-full object-cover" />

                        {/* Remove Button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          className="absolute top-1 right-1 h-4 w-4 rounded-full bg-black/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove image"
                        >
                          <X className="h-3 w-3" />
                        </button>

                        {/* Cover image label/selector */}
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, image_url: url })}
                          className={`absolute bottom-0 inset-x-0 text-[8px] py-0.5 text-center font-bold transition-opacity ${
                            isCover ? 'bg-primary text-primary-foreground' : 'bg-black/60 text-white opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          {isCover ? 'Cover' : 'Set Cover'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Section 3: Variants Management */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold">Model Variants (Colors / Straps)</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Define specific color/strap combinations with individual stock and price overrides.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={handleAddVariant} className="h-7 text-xs">
                  <Plus className="h-3 w-3 mr-1" /> Add Variant
                </Button>
              </div>

              {formData.variants.length > 0 && (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {formData.variants.map((v) => (
                    <div
                      key={v.id}
                      className="grid grid-cols-12 gap-2 p-2.5 rounded-lg border border-border/60 bg-muted/20 items-center text-xs"
                    >
                      <div className="col-span-5">
                        <Label className="text-[10px] text-muted-foreground">Variant Name *</Label>
                        <Input
                          placeholder="e.g. Silver Dial / Leather"
                          value={v.name}
                          onChange={(e) => handleUpdateVariant(v.id, 'name', e.target.value)}
                          className="h-7 text-xs"
                          required
                        />
                      </div>
                      <div className="col-span-3">
                        <Label className="text-[10px] text-muted-foreground">Price Override (৳)</Label>
                        <Input
                          type="number"
                          placeholder={formData.price || 'Same'}
                          value={v.price ? String(v.price) : ''}
                          onChange={(e) => handleUpdateVariant(v.id, 'price', e.target.value ? Number(e.target.value) : null)}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div className="col-span-3">
                        <Label className="text-[10px] text-muted-foreground">Stock (Pcs) *</Label>
                        <Input
                          type="number"
                          min="0"
                          value={v.stock}
                          onChange={(e) => handleUpdateVariant(v.id, 'stock', parseInt(e.target.value, 10) || 0)}
                          className="h-7 text-xs"
                          required
                        />
                      </div>
                      <div className="col-span-1 flex justify-end pt-3">
                        <button
                          type="button"
                          onClick={() => handleRemoveVariant(v.id)}
                          className="text-destructive hover:bg-destructive/10 p-1 rounded"
                          title="Remove variant"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 4: Technical Specifications */}
            <div className="space-y-3 border-t pt-4">
              <Label className="text-sm font-semibold">Technical Specifications</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="dial" className="text-xs text-muted-foreground">Dial Size</Label>
                  <Input
                    id="dial"
                    value={formData.dial_size}
                    onChange={(e) => setFormData({ ...formData, dial_size: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="water" className="text-xs text-muted-foreground">Water Resistance</Label>
                  <Input
                    id="water"
                    value={formData.water_resistance}
                    onChange={(e) => setFormData({ ...formData, water_resistance: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="mov" className="text-xs text-muted-foreground">Movement Engine</Label>
                  <Input
                    id="mov"
                    value={formData.movement}
                    onChange={(e) => setFormData({ ...formData, movement: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="strap" className="text-xs text-muted-foreground">Strap Material</Label>
                  <Input
                    id="strap"
                    value={formData.strap_type}
                    onChange={(e) => setFormData({ ...formData, strap_type: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="warranty" className="text-xs text-muted-foreground">Warranty (Months)</Label>
                  <Input
                    id="warranty"
                    type="number"
                    value={formData.warranty_months}
                    onChange={(e) => setFormData({ ...formData, warranty_months: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="colors" className="text-xs text-muted-foreground">Color Tags (Comma separated)</Label>
                  <Input
                    id="colors"
                    value={formData.colors}
                    onChange={(e) => setFormData({ ...formData, colors: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5 border-t pt-4">
              <Label htmlFor="desc">Short Description / Highlights</Label>
              <textarea
                id="desc"
                rows={2}
                className="w-full rounded-md border border-input bg-background p-2.5 text-xs ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="High-grade Hardlex crystal, functional sub-dials, water-sealed case."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            {/* Active Toggle */}
            <div className="flex items-center space-x-2 pt-1">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active" className="cursor-pointer text-xs">
                Active in Catalog & Public Single Order Page
              </Label>
            </div>

            <DialogFooter className="pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : editingProduct ? 'Save Changes' : 'Add Watch & Generate Landing Page'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Showcase Pitch Preview Dialog */}
      <Dialog open={!!previewProduct} onOpenChange={() => setPreviewProduct(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              WhatsApp Pitch Preview
            </DialogTitle>
            <DialogDescription>
              This is how the showcase message appears to the customer on WhatsApp (with direct order link).
            </DialogDescription>
          </DialogHeader>

          {previewProduct && (
            <div className="space-y-3">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 dark:bg-emerald-950/40 p-4 text-xs font-mono whitespace-pre-wrap leading-relaxed text-foreground">
                {formatShowcasePitch(previewProduct)}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setPreviewProduct(null)}>
                  Close
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    handleCopyShowcase(previewProduct);
                    setPreviewProduct(null);
                  }}
                >
                  <Copy className="h-4 w-4 mr-1.5" /> Copy Pitch
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Delete Watch Model?
            </DialogTitle>
            <DialogDescription>
              This watch and its public single landing page will be removed from your catalog. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDeleteProduct}>
              Yes, Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
