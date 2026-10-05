'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import type { BusinessSettings } from '@/types/business';
import type { Product, ProductBundle } from '@/types/watch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Store,
  Search,
  ShoppingBag,
  Phone,
  MessageCircle,
  Truck,
  ShieldCheck,
  Package,
  Sparkles,
  ArrowRight,
  Flame,
  CheckCircle2,
  RefreshCw,
  Share2,
  Lock,
  X,
  ChevronUp,
  Eye,
  Zap,
  TrendingUp,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';
import { FloatingWhatsAppWidget } from './floating-whatsapp-widget';

interface StorefrontProps {
  initialSlug?: string;
}

export function StorefrontView({ initialSlug }: StorefrontProps) {
  const [business, setBusiness] = useState<BusinessSettings | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [bundles, setBundles] = useState<ProductBundle[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [hoveredProduct, setHoveredProduct] = useState<string | null>(null);

  const heroRef = useRef<HTMLDivElement>(null);
  const categoryScrollRef = useRef<HTMLDivElement>(null);

  // Track scroll position for sticky header effects
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 60);
      setShowScrollTop(window.scrollY > 600);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    async function loadStore() {
      try {
        setLoading(true);
        const url = initialSlug
          ? `/api/public/store/${encodeURIComponent(initialSlug)}`
          : '/api/public/store';
        const res = await fetch(url);
        const data = await res.json();
        if (res.ok) {
          if (data.business) setBusiness(data.business);
          if (data.products) setProducts(data.products);
          if (data.bundles) setBundles(data.bundles);
          if (data.categories) setCategories(data.categories);
        }
      } catch (err) {
        console.error('Failed to load store data:', err);
      } finally {
        setLoading(false);
      }
    }
    void loadStore();
  }, [initialSlug]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        !search.trim() ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.category && p.category.toLowerCase().includes(search.toLowerCase())) ||
        (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()));

      const matchesCat =
        selectedCategory === 'all' ||
        (p.category && p.category.toLowerCase() === selectedCategory.toLowerCase());

      return matchesSearch && matchesCat;
    });
  }, [products, search, selectedCategory]);

  // Count products per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach((p) => {
      if (p.category) {
        const key = p.category.toLowerCase();
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    return counts;
  }, [products]);

  const handleShare = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (navigator.share) {
      navigator.share({
        title: business?.store_name || 'Online Store',
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('স্টোর লিংক কপি করা হয়েছে!');
    }
  }, [business?.store_name]);

  const getWhatsAppLink = useCallback(() => {
    if (!business?.whatsapp_number) return null;
    const clean = business.whatsapp_number.replace(/[^0-9]/g, '');
    const num = clean.startsWith('880') ? clean : clean.startsWith('0') ? `88${clean}` : clean;
    return `https://wa.me/${num}?text=${encodeURIComponent(`আসসালামু আলাইকুম! আমি ${business.store_name} থেকে পণ্য সম্পর্কে জানতে চাই।`)}`;
  }, [business?.whatsapp_number, business?.store_name]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ─── Loading State ───
  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-6">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-amber-500/20 animate-ping" />
          <div className="relative h-16 w-16 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center">
            <RefreshCw className="h-7 w-7 animate-spin text-amber-500" />
          </div>
        </div>
        <h2 className="text-lg font-bold tracking-wide mt-6">স্টোর লোড হচ্ছে...</h2>
        <p className="text-sm text-neutral-500 mt-1.5">অনুগ্রহ করে একটু অপেক্ষা করুন</p>
        <div className="mt-6 flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-2 w-2 rounded-full bg-amber-500/60 animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  const storeName = business?.store_name || 'Online Store';
  const tagline = business?.tagline || 'সেরা কোয়ালিটি ও দ্রুত ডেলিভারির নিশ্চয়তা';
  const heroTitle = business?.hero_title || 'আমাদের এক্সক্লুসিভ কালেকশন';
  const heroSubtitle = business?.hero_subtitle || 'পছন্দের পণ্যটি অর্ডার করুন ক্যাশ অন ডেলিভারিতে';

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans antialiased selection:bg-amber-500/30 selection:text-amber-200">
      {/* ═══════════════════════════════════════════════
          ANNOUNCEMENT MARQUEE BAR
          ═══════════════════════════════════════════════ */}
      {business?.announcement_enabled && business.announcement_text && (
        <div className="relative overflow-hidden bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-neutral-950 py-2 shadow-lg shadow-amber-500/10">
          <div className="flex animate-[marquee_25s_linear_infinite] whitespace-nowrap">
            {[...Array(4)].map((_, i) => (
              <span key={i} className="mx-8 flex items-center gap-2 text-xs sm:text-sm font-bold">
                <Flame className="h-3.5 w-3.5 fill-neutral-950" />
                <span>{business.announcement_text}</span>
                <span className="text-amber-900">•</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          STICKY GLASSMORPHISM HEADER
          ═══════════════════════════════════════════════ */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-neutral-950/80 backdrop-blur-xl border-b border-neutral-800/60 shadow-2xl shadow-black/20'
            : 'bg-transparent border-b border-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
          {/* Logo & Store Name */}
          <Link href="/" className="flex items-center gap-3 min-w-0 group">
            {business?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={business.logo_url}
                alt={storeName}
                className="h-10 w-10 rounded-xl object-contain bg-neutral-900 border border-neutral-800 p-0.5 shrink-0 group-hover:scale-105 transition-transform"
              />
            ) : (
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-neutral-950 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
                <Store className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-extrabold text-neutral-100 tracking-tight truncate">
                {storeName}
              </h1>
              <p className="text-[11px] text-neutral-500 truncate hidden sm:block leading-none mt-0.5">
                {tagline}
              </p>
            </div>
          </Link>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {getWhatsAppLink() && (
              <a
                href={getWhatsAppLink()!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all hover:scale-105 hover:shadow-emerald-500/30"
              >
                <MessageCircle className="h-4 w-4" />
                <span className="hidden sm:inline">হোয়াটসঅ্যাপ</span>
              </a>
            )}

            {business?.support_phone && (
              <a
                href={`tel:${business.support_phone}`}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-medium border border-neutral-800 transition-all"
              >
                <Phone className="h-3.5 w-3.5 text-blue-400" />
                <span>{business.support_phone}</span>
              </a>
            )}

            <button
              onClick={handleShare}
              className="p-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-800 transition-all"
              title="শেয়ার করুন"
            >
              <Share2 className="h-4 w-4" />
            </button>

            <Link href="/dashboard" className="hidden lg:inline-block">
              <Button variant="ghost" size="sm" className="text-xs text-neutral-500 hover:text-neutral-300 gap-1">
                <Lock className="h-3 w-3" />
                <span>অ্যাডমিন</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════
          HERO SECTION — Gradient Mesh + CTA
          ═══════════════════════════════════════════════ */}
      <section ref={heroRef} className="relative overflow-hidden">
        {/* Background Layers */}
        <div className="absolute inset-0">
          {/* Gradient mesh */}
          <div className="absolute inset-0 bg-gradient-to-br from-amber-950/30 via-neutral-950 to-neutral-950" />
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[100px]" />

          {/* Banner image overlay */}
          {business?.banner_url && (
            <div className="absolute inset-0 opacity-10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={business.banner_url} alt="Cover" className="h-full w-full object-cover" />
            </div>
          )}

          {/* Grid pattern overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 text-center space-y-6">
          <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/25 text-xs font-bold px-4 py-1.5 backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 mr-1.5" /> অফিসিয়াল অনলাইন শপ
          </Badge>

          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-neutral-50 tracking-tight leading-[1.1]">
            {heroTitle}
          </h2>

          <p className="text-sm sm:text-base md:text-lg text-neutral-400 max-w-2xl mx-auto leading-relaxed">
            {heroSubtitle}
          </p>

          {/* Search Bar */}
          <div className="pt-2 max-w-xl mx-auto">
            <div
              className={`relative transition-all duration-300 ${
                isSearchFocused ? 'scale-[1.02]' : ''
              }`}
            >
              <Search
                className={`absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 transition-colors ${
                  isSearchFocused ? 'text-amber-400' : 'text-neutral-500'
                }`}
              />
              <Input
                type="text"
                placeholder="পণ্য বা মডেল সার্চ করুন..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                className={`pl-11 pr-20 h-12 sm:h-13 bg-neutral-900/70 backdrop-blur-md border text-sm text-neutral-100 placeholder:text-neutral-600 rounded-2xl shadow-xl transition-all ${
                  isSearchFocused
                    ? 'border-amber-500/50 shadow-amber-500/5 ring-1 ring-amber-500/20'
                    : 'border-neutral-800'
                }`}
              />
              {search ? (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 transition-all"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-neutral-800/80 text-[10px] text-neutral-500 font-mono hidden sm:block">
                  ⌘K
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="flex items-center justify-center gap-6 sm:gap-8 pt-2 text-xs text-neutral-500">
            <div className="flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-amber-500/70" />
              <span><strong className="text-neutral-300">{products.length}</strong> টি পণ্য</span>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500/70" />
              <span><strong className="text-neutral-300">{categories.length}</strong> টি ক্যাটাগরি</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-blue-500/70" />
              <span>ক্যাশ অন ডেলিভারি</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          TRUST HIGHLIGHT CARDS
          ═══════════════════════════════════════════════ */}
      <section className="border-y border-neutral-800/60 bg-neutral-900/30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                icon: Package,
                iconColor: 'text-emerald-400',
                iconBg: 'bg-emerald-500/10 border-emerald-500/20',
                title: business?.feature_1_title || 'ক্যাশ অন ডেলিভারি',
                subtitle: business?.feature_1_subtitle || 'পার্সেল দেখে মূল্য পরিশোধের সুযোগ',
              },
              {
                icon: Truck,
                iconColor: 'text-blue-400',
                iconBg: 'bg-blue-500/10 border-blue-500/20',
                title: business?.feature_2_title || 'সুপারফাস্ট ডেলিভারি',
                subtitle: business?.feature_2_subtitle || 'সারাদেশে দ্রুত হোম ডেলিভারি',
              },
              {
                icon: ShieldCheck,
                iconColor: 'text-amber-400',
                iconBg: 'bg-amber-500/10 border-amber-500/20',
                title: business?.feature_3_title || '১০০% অরিজিনাল',
                subtitle: business?.feature_3_subtitle || 'নিখুঁত কোয়ালিটি গ্যারান্টি',
              },
            ].map((feat, i) => (
              <div
                key={i}
                className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-neutral-900/50 border border-neutral-800/60 backdrop-blur-sm hover:bg-neutral-800/40 hover:border-neutral-700/60 transition-all duration-300 group"
              >
                <div
                  className={`h-10 w-10 rounded-xl ${feat.iconBg} border ${feat.iconColor} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}
                >
                  <feat.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-neutral-200 truncate">{feat.title}</p>
                  <p className="text-[11px] text-neutral-500 truncate">{feat.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          PRODUCT CATALOG
          ═══════════════════════════════════════════════ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
        {/* Special Combo Deals & Bundles Section */}
        {bundles.length > 0 && selectedCategory === 'all' && !search && (
          <section className="rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-neutral-900 to-neutral-950 p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 h-44 w-44 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-amber-500 text-neutral-950 font-black text-[10px] uppercase tracking-wider px-2 py-0.5">
                    স্পেশাল অফার
                  </Badge>
                  <span className="text-xs text-amber-400 font-semibold flex items-center gap-1">
                    <Flame className="h-3.5 w-3.5" /> লিমিটেড কম্বো প্যাক
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-neutral-100 mt-1">
                  স্পেশাল কম্বো ও বান্ডেল ডিলসমূহ
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  একাধিক প্রিমিয়াম পণ্য একসাথে নিয়ে উপভোগ করুন আকর্ষণীয় সেভিংস অফার!
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bundles.map((bundle) => {
                const discount = bundle.regular_price && bundle.regular_price > bundle.price
                  ? Math.round(((bundle.regular_price - bundle.price) / bundle.regular_price) * 100)
                  : null;

                return (
                  <div
                    key={bundle.id}
                    className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-4 space-y-3 flex flex-col justify-between hover:border-amber-500/50 hover:bg-neutral-900 transition-all duration-300 group shadow-lg"
                  >
                    <div className="space-y-3">
                      {bundle.image_url ? (
                        <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-neutral-950 border border-neutral-800">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={bundle.image_url}
                            alt={bundle.name}
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          {bundle.badge_text && (
                            <span className="absolute top-2 left-2 bg-amber-500 text-neutral-950 text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
                              {bundle.badge_text}
                            </span>
                          )}
                          {discount && (
                            <span className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow">
                              {discount}% OFF
                            </span>
                          )}
                        </div>
                      ) : null}

                      <div>
                        <h4 className="font-bold text-neutral-100 text-sm group-hover:text-amber-400 transition-colors">
                          {bundle.name}
                        </h4>
                        {bundle.description && (
                          <p className="text-xs text-neutral-400 line-clamp-2 mt-1">
                            {bundle.description}
                          </p>
                        )}
                      </div>

                      {/* Included Items List */}
                      {bundle.items && bundle.items.length > 0 && (
                        <div className="rounded-xl bg-neutral-950/70 p-2.5 border border-neutral-800/80 space-y-1">
                          <span className="text-[10px] font-semibold text-neutral-400 block uppercase tracking-wider">
                            প্যাকেজে অন্তর্ভুক্ত ({bundle.items.length}টি আইটেম):
                          </span>
                          <div className="space-y-1">
                            {bundle.items.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between text-[11px] text-neutral-300">
                                <span className="truncate flex items-center gap-1">
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                                  {item.product_name || `পণ্য #${item.product_id.slice(0, 6)}`}
                                </span>
                                <span className="font-mono text-neutral-400 shrink-0 ml-2">x{item.quantity}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between">
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-lg font-black text-amber-400">
                            ৳{bundle.price.toLocaleString('en-BD')}
                          </span>
                          {bundle.regular_price && bundle.regular_price > bundle.price && (
                            <span className="text-xs text-neutral-500 line-through">
                              ৳{bundle.regular_price.toLocaleString('en-BD')}
                            </span>
                          )}
                        </div>
                      </div>

                      <a
                        href={
                          business?.whatsapp_number
                            ? `https://wa.me/${business.whatsapp_number.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                                `আসসালামু আলাইকুম! আমি "${bundle.name}" কম্বো প্যাকটি অর্ডার করতে চাই (মূল্য: ৳${bundle.price})।`
                              )}`
                            : '#'
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-md transition-colors"
                      >
                        <ShoppingBag className="h-3.5 w-3.5" />
                        <span>অর্ডার করুন</span>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Category Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div
            ref={categoryScrollRef}
            className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none"
          >
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                selectedCategory === 'all'
                  ? 'bg-amber-500 text-neutral-950 shadow-lg shadow-amber-500/20 font-bold scale-105'
                  : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 border border-neutral-800'
              }`}
            >
              সব পণ্য
              <span className="ml-1.5 opacity-70">({products.length})</span>
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-medium transition-all shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-amber-500 text-neutral-950 shadow-lg shadow-amber-500/20 font-bold scale-105'
                    : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 border border-neutral-800'
                }`}
              >
                {cat}
                {categoryCounts[cat.toLowerCase()] && (
                  <span className="ml-1.5 opacity-70">({categoryCounts[cat.toLowerCase()]})</span>
                )}
              </button>
            ))}
          </div>

          <div className="text-xs text-neutral-500 shrink-0 flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5" />
            প্রদর্শন হচ্ছে: <span className="font-bold text-neutral-300">{filteredProducts.length}</span> টি পণ্য
          </div>
        </div>

        {/* Product Grid */}
        {filteredProducts.length === 0 ? (
          <div className="rounded-3xl border border-neutral-800/60 bg-neutral-900/30 p-16 text-center space-y-4">
            <div className="h-20 w-20 rounded-2xl bg-neutral-800/50 flex items-center justify-center mx-auto">
              <ShoppingBag className="h-10 w-10 text-neutral-600" />
            </div>
            <h3 className="text-lg font-bold text-neutral-200">কোনো পণ্য খুঁজে পাওয়া যায়নি</h3>
            <p className="text-sm text-neutral-500 max-w-sm mx-auto">
              {search
                ? `"${search}" দিয়ে কোনো পণ্য মেলেনি। অন্য কি-ওয়ার্ড দিয়ে খুঁজুন।`
                : 'বর্তমানে কোনো একটিভ প্রোডাক্ট তালিকায় নেই। শীঘ্রই নতুন কালেকশন যুক্ত করা হবে।'}
            </p>
            {search && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearch('')}
                className="text-xs border-neutral-700 text-neutral-300 rounded-xl mt-2"
              >
                <X className="h-3 w-3 mr-1.5" />
                সার্চ রিসেট করুন
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
            {filteredProducts.map((p) => {
              const regularPrice = p.regular_price ? Number(p.regular_price) : null;
              const price = Number(p.price) || 0;
              const hasDiscount = regularPrice && regularPrice > price;
              const discountPct = hasDiscount
                ? Math.round(((regularPrice! - price) / regularPrice!) * 100)
                : null;
              const isOutOfStock = (p.stock_quantity ?? 0) === 0;
              const isLowStock = (p.stock_quantity ?? 0) > 0 && (p.stock_quantity ?? 0) <= (p.low_stock_threshold ?? 5);
              const productUrl = `/p/${p.slug || p.id}`;
              const isHovered = hoveredProduct === p.id;

              return (
                <div
                  key={p.id}
                  className="group rounded-2xl sm:rounded-3xl border border-neutral-800/60 bg-neutral-900/40 overflow-hidden flex flex-col justify-between transition-all duration-300 hover:border-neutral-700/60 hover:bg-neutral-900/60 hover:shadow-2xl hover:shadow-black/20 hover:-translate-y-1"
                  onMouseEnter={() => setHoveredProduct(p.id)}
                  onMouseLeave={() => setHoveredProduct(null)}
                >
                  <div>
                    {/* Image Container */}
                    <Link href={productUrl} className="block relative aspect-square bg-neutral-950 overflow-hidden">
                      {p.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-full w-full flex flex-col items-center justify-center text-neutral-700 gap-2">
                          <Package className="h-10 w-10 sm:h-14 sm:w-14 stroke-[1]" />
                          <span className="text-[10px] text-neutral-600">ছবি নেই</span>
                        </div>
                      )}

                      {/* Gradient overlay on hover */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                      {/* Quick View Button on hover */}
                      <div className="absolute bottom-3 left-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                        <div className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 text-white text-xs font-semibold">
                          <Eye className="h-3.5 w-3.5" />
                          <span>বিস্তারিত দেখুন</span>
                        </div>
                      </div>

                      {/* Top Badges */}
                      <div className="absolute top-2 sm:top-3 left-2 sm:left-3 flex flex-col gap-1.5">
                        {p.badge_text ? (
                          <Badge className="bg-amber-500 text-neutral-950 font-bold text-[10px] uppercase px-2 py-0.5 shadow-lg shadow-amber-500/20">
                            {p.badge_text}
                          </Badge>
                        ) : discountPct ? (
                          <Badge className="bg-red-600 text-white font-bold text-[10px] px-2 py-0.5 shadow-lg shadow-red-600/20">
                            -{discountPct}%
                          </Badge>
                        ) : null}

                        {isLowStock && !isOutOfStock && (
                          <Badge className="bg-amber-600/90 text-white font-bold text-[9px] px-2 py-0.5 flex items-center gap-1 animate-pulse">
                            <Flame className="h-2.5 w-2.5" />
                            স্বল্প স্টক
                          </Badge>
                        )}
                      </div>

                      {/* Out of Stock Overlay */}
                      {isOutOfStock && (
                        <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px] flex items-center justify-center">
                          <Badge variant="destructive" className="font-bold text-xs px-3 py-1.5 shadow-lg">
                            স্টক শেষ
                          </Badge>
                        </div>
                      )}
                    </Link>

                    {/* Content */}
                    <div className="p-3 sm:p-4 space-y-2">
                      {p.category && (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500/70 block">
                          {p.category}
                        </span>
                      )}

                      <Link href={productUrl}>
                        <h3 className="text-xs sm:text-sm font-bold text-neutral-200 group-hover:text-amber-400 transition-colors line-clamp-2 leading-snug">
                          {p.name}
                        </h3>
                      </Link>

                      {/* Pricing */}
                      <div className="flex items-baseline gap-2 pt-0.5">
                        <span className="text-base sm:text-lg font-black text-amber-400 tracking-tight">
                          ৳{price.toLocaleString('en-BD')}
                        </span>
                        {hasDiscount && (
                          <span className="text-[11px] text-neutral-600 line-through">
                            ৳{regularPrice?.toLocaleString('en-BD')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* CTA Button */}
                  <div className="px-3 sm:px-4 pb-3 sm:pb-4">
                    <Link href={productUrl} className="block w-full">
                      <Button
                        size="sm"
                        disabled={isOutOfStock}
                        className={`w-full text-xs font-bold rounded-xl gap-1.5 transition-all duration-300 ${
                          isOutOfStock
                            ? 'bg-neutral-800 text-neutral-500'
                            : 'bg-amber-500 hover:bg-amber-400 text-neutral-950 shadow-md hover:shadow-lg hover:shadow-amber-500/10'
                        }`}
                      >
                        {isOutOfStock ? (
                          <>
                            <X className="h-3.5 w-3.5" />
                            <span>স্টক শেষ</span>
                          </>
                        ) : (
                          <>
                            <ShoppingBag className="h-3.5 w-3.5" />
                            <span>অর্ডার করুন</span>
                            <ArrowRight className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                          </>
                        )}
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ═══════════════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════════════ */}
      <footer className="border-t border-neutral-800/60 bg-neutral-900/30 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Brand Info */}
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                {business?.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={business.logo_url}
                    alt={storeName}
                    className="h-8 w-8 rounded-lg object-contain bg-neutral-900 border border-neutral-800 p-0.5"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 text-neutral-950 flex items-center justify-center">
                    <Store className="h-4 w-4" />
                  </div>
                )}
                <span className="font-extrabold text-neutral-200">{storeName}</span>
              </div>
              <p className="text-xs text-neutral-500 leading-relaxed max-w-sm">{tagline}</p>
              {business?.address && (
                <p className="text-[11px] text-neutral-600 flex items-start gap-1.5">
                  <span className="shrink-0 mt-0.5">📍</span>
                  <span>{business.address}</span>
                </p>
              )}
            </div>

            {/* Quick Links */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">যোগাযোগ</h4>
              <div className="space-y-2.5">
                {business?.support_phone && (
                  <a
                    href={`tel:${business.support_phone}`}
                    className="text-xs text-neutral-400 hover:text-amber-400 flex items-center gap-2 transition-colors"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    <span>{business.support_phone}</span>
                  </a>
                )}
                {getWhatsAppLink() && (
                  <a
                    href={getWhatsAppLink()!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-neutral-400 hover:text-emerald-400 flex items-center gap-2 transition-colors"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span>WhatsApp Order</span>
                  </a>
                )}
                {business?.support_email && (
                  <a
                    href={`mailto:${business.support_email}`}
                    className="text-xs text-neutral-400 hover:text-blue-400 flex items-center gap-2 transition-colors"
                  >
                    <span>✉️</span>
                    <span>{business.support_email}</span>
                  </a>
                )}
              </div>
            </div>

            {/* Trust & Admin */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">বিশ্বাসযোগ্যতা</h4>
              <div className="space-y-2.5 text-xs text-neutral-500">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500/70" />
                  <span>১০০% ক্যাশ অন ডেলিভারি</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500/70" />
                  <span>সারাদেশে হোম ডেলিভারি</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500/70" />
                  <span>অরিজিনাল প্রোডাক্ট গ্যারান্টি</span>
                </div>
              </div>
              <Link href="/login" className="text-[11px] text-neutral-600 hover:text-neutral-400 transition-colors flex items-center gap-1 mt-2">
                <Lock className="h-3 w-3" />
                অ্যাডমিন লগইন
              </Link>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-neutral-800/40 mt-8 pt-5 text-center">
            <p className="text-[11px] text-neutral-600">
              © {new Date().getFullYear()} {storeName}. সর্বস্বত্ব সংরক্ষিত।
            </p>
          </div>
        </div>
      </footer>

      {/* ═══════════════════════════════════════════════
          FLOATING ACTIONS
          ═══════════════════════════════════════════════ */}

      {/* Floating WhatsApp Widget */}
      <FloatingWhatsAppWidget
        storeName={business?.store_name}
        whatsappNumber={business?.whatsapp_number}
        logoUrl={business?.logo_url}
      />

      {/* Scroll to Top */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 left-6 z-40 h-11 w-11 rounded-xl bg-neutral-800/90 backdrop-blur-sm border border-neutral-700/60 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700 flex items-center justify-center shadow-xl transition-all duration-300 hover:scale-105"
          title="উপরে যান"
        >
          <ChevronUp className="h-5 w-5" />
        </button>
      )}

    </div>
  );
}
