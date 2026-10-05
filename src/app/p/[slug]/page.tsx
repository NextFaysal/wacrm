'use client';

import { useState, useEffect, use, useMemo } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import type { Product, ProductVariant, ProductReview } from '@/types/watch';
import type { DeliveryZone, DeliverySettings as DeliverySettingsType } from '@/types/delivery';
import type { BusinessSettings } from '@/types/business';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Store,
  CheckCircle2,
  Truck,
  ShieldCheck,
  Sparkles,
  Phone,
  Package,
  CircleDollarSign,
  ChevronRight,
  MessageCircle,
  Flame,
  Check,
  ShoppingBag,
  RefreshCw,
  Share2,
  Clock,
  Plus,
  Minus,
  Gift,
  Tag,
  Star,
} from 'lucide-react';
import { FloatingWhatsAppWidget } from '@/components/store/floating-whatsapp-widget';

interface PageProps {
  params: Promise<{ slug: string }>;
}

const RECENT_BUYERS = [
  { name: 'তানভীর হাসান', location: 'উত্তরা, ঢাকা', time: '২ মিনিট আগে' },
  { name: 'শাকিল আহমেদ', location: 'জিইসি মোড়, চট্টগ্রাম', time: '৫ মিনিট আগে' },
  { name: 'আরিফুল ইসলাম', location: 'ধানমন্ডি, ঢাকা', time: '৮ মিনিট আগে' },
  { name: 'মাহমুদ করিম', location: 'বোয়ালিয়া, রাজশাহী', time: '১২ মিনিট আগে' },
  { name: 'জাহিদুল ইসলাম', location: 'মিরপুর-১০, ঢাকা', time: '১৬ মিনিট আগে' },
  { name: 'রাকিবুল হাসান', location: 'চৌহাট্টা, সিলেট', time: '২১ মিনিট আগে' },
];

export default function ProductSinglePage({ params }: PageProps) {
  const unwrappedParams = use(params);
  const slug = unwrappedParams.slug;

  const [product, setProduct] = useState<Product | null>(null);
  const [business, setBusiness] = useState<BusinessSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [selectedVariantName, setSelectedVariantName] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [quantity, setQuantity] = useState(1);

  // Dynamic Delivery Zones & Rules
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [deliverySettings, setDeliverySettings] = useState<DeliverySettingsType | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');

  // Customer Reviews & Coupons
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountAmount: number } | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  // Flash Sale Countdown
  const [countdown, setCountdown] = useState({ hours: 4, minutes: 28, seconds: 45 });

  // Social Proof Buyer Notification
  const [currentBuyerIndex, setCurrentBuyerIndex] = useState(0);
  const [showBuyerToast, setShowBuyerToast] = useState(false);

  // Customer order form inputs
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<any>(null);

  // Load product, delivery zones, & register view
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [prodRes, delivRes] = await Promise.all([
          fetch(`/api/public/products/${slug}`),
          fetch(`/api/public/delivery?slug=${slug}`),
        ]);

        const prodData = await prodRes.json();
        const delivData = await delivRes.json();

        if (prodRes.ok && prodData.product) {
          const prod: Product = prodData.product;
          setProduct(prod);
          if (prodData.business) {
            setBusiness(prodData.business);
          }

          if (prod.variants && prod.variants.length > 0) {
            setSelectedVariantId(prod.variants[0].id);
            setSelectedVariantName(prod.variants[0].name);
            if (prod.variants[0].image_url) {
              setSelectedImage(prod.variants[0].image_url);
            }
          } else if (prod.colors && prod.colors.length > 0) {
            setSelectedVariantName(prod.colors[0]);
          }

          if (prod.image_url && !selectedImage) {
            setSelectedImage(prod.image_url);
          }

          // Fetch or populate product reviews
          if (prodData.reviews && prodData.reviews.length > 0) {
            setReviews(prodData.reviews);
          } else {
            fetch(`/api/public/reviews?productId=${prod.id}`)
              .then((r) => r.json())
              .then((d) => {
                if (d.reviews) setReviews(d.reviews);
              })
              .catch(() => {});
          }

          // Register view in background
          fetch(`/api/public/products/${slug}/view`, { method: 'POST' }).catch(() => {});
        } else {
          toast.error(prodData.error || 'Product not found');
        }

        if (delivData?.zones && delivData.zones.length > 0) {
          setDeliveryZones(delivData.zones);
          setSelectedZoneId(delivData.zones[0].id);
        }
        if (delivData?.settings) {
          setDeliverySettings(delivData.settings);
        }
      } catch {
        toast.error('Network error loading product');
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      void loadData();
    }
  }, [slug]);

  // Flash Sale Timer Effect
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        }
        if (prev.minutes > 0) {
          return { ...prev, minutes: 59, seconds: 59 };
        }
        if (prev.hours > 0) {
          return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        }
        return { hours: 6, minutes: 0, seconds: 0 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Social Proof Buyer Notification Effect
  useEffect(() => {
    const interval = setInterval(() => {
      setShowBuyerToast(true);
      setTimeout(() => setShowBuyerToast(false), 5000);
      setCurrentBuyerIndex((prev) => (prev + 1) % RECENT_BUYERS.length);
    }, 12000);

    const initialDelay = setTimeout(() => {
      setShowBuyerToast(true);
      setTimeout(() => setShowBuyerToast(false), 5000);
    }, 2500);

    return () => {
      clearInterval(interval);
      clearTimeout(initialDelay);
    };
  }, []);

  // Active Variant & Pricing
  const activeVariant = useMemo(() => {
    if (!product?.variants || product.variants.length === 0) return null;
    return product.variants.find((v) => v.id === selectedVariantId) || product.variants[0];
  }, [product, selectedVariantId]);

  const unitPrice = activeVariant?.price ? Number(activeVariant.price) : (product ? Number(product.price) : 0);
  const regularPrice = activeVariant?.regular_price
    ? Number(activeVariant.regular_price)
    : (product?.regular_price ? Number(product.regular_price) : null);

  // Dynamic Tier Pricing Match
  const matchedTier = useMemo(() => {
    if (!product?.tier_pricing || product.tier_pricing.length === 0) return null;
    const sorted = [...product.tier_pricing].sort((a, b) => Number(b.quantity) - Number(a.quantity));
    return sorted.find((t) => quantity >= Number(t.quantity)) || null;
  }, [product?.tier_pricing, quantity]);

  const effectiveUnitPrice = matchedTier && Number(matchedTier.price) > 0 ? Number(matchedTier.price) : unitPrice;
  const itemsSubtotal = effectiveUnitPrice * quantity;

  // Active Delivery Zone & Dynamic Free Delivery Logic
  const activeZone = useMemo(() => {
    return deliveryZones.find((z) => z.id === selectedZoneId) || deliveryZones[0] || null;
  }, [deliveryZones, selectedZoneId]);

  const isFreeDelivery = useMemo(() => {
    if (deliverySettings?.free_delivery_global) return true;
    if (activeZone?.is_free || activeZone?.charge === 0) return true;
    if (
      deliverySettings?.free_delivery_min_qty &&
      deliverySettings.free_delivery_min_qty > 0 &&
      quantity >= deliverySettings.free_delivery_min_qty
    ) {
      return true;
    }
    if (
      deliverySettings?.free_delivery_min_amount &&
      deliverySettings.free_delivery_min_amount > 0 &&
      itemsSubtotal >= Number(deliverySettings.free_delivery_min_amount)
    ) {
      return true;
    }
    return false;
  }, [deliverySettings, activeZone, quantity, itemsSubtotal]);

  const couponDiscount = appliedCoupon ? appliedCoupon.discountAmount : 0;
  const deliveryFee = isFreeDelivery ? 0 : (activeZone ? Number(activeZone.charge) : 100);
  const totalPrice = Math.max(0, itemsSubtotal - couponDiscount + deliveryFee);

  // Auto-capture partial / dropped-off lead when phone number is typed
  useEffect(() => {
    const cleanPhone = customerPhone.replace(/[^0-9]/g, '');
    if (cleanPhone.length >= 11 && !confirmedOrder) {
      const timer = setTimeout(() => {
        fetch('/api/public/checkout/abandoned', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug,
            customerName: customerName.trim(),
            customerPhone: cleanPhone,
            customerAddress: customerAddress.trim(),
            variant: selectedVariantName || 'Standard',
            quantity,
            totalAmount: totalPrice,
          }),
        }).catch(() => {});
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [customerPhone, customerName, customerAddress, selectedVariantName, quantity, totalPrice, slug, confirmedOrder]);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    try {
      setIsApplyingCoupon(true);
      const res = await fetch('/api/public/coupons/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: couponCode.trim(),
          amount: itemsSubtotal,
          accountId: product?.account_id,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAppliedCoupon({
          code: data.coupon.code,
          discountAmount: data.coupon.discountAmount,
        });
        toast.success(`🎉 কুপন "${data.coupon.code}" সফলভাবে প্রয়োগ করা হয়েছে!`);
      } else {
        toast.error(data.error || 'কুপনটি সঠিক নয়');
      }
    } catch {
      toast.error('কুপন যাচাই করতে সমস্যা হয়েছে');
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const hasDiscount = regularPrice && regularPrice > unitPrice;
  const discountPct = hasDiscount
    ? Math.round(((regularPrice! - unitPrice) / regularPrice!) * 100)
    : null;

  // Stock status
  const currentStock = activeVariant ? activeVariant.stock : (product?.stock_quantity ?? 0);
  const isOutOfStock = currentStock === 0;
  const isLowStock = currentStock > 0 && currentStock <= (product?.low_stock_threshold ?? 5);

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim()) {
      toast.error('আপনার সম্পূর্ণ নাম লিখুন');
      return;
    }
    if (!customerPhone.trim() || !/^01[3-9]\d{8}$/.test(customerPhone.trim().replace(/[^0-9]/g, ''))) {
      toast.error('সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)');
      return;
    }
    if (!customerAddress.trim() || customerAddress.trim().length < 8) {
      toast.error('আপনার সম্পূর্ণ ডেলিভারি ঠিকানা বিস্তারিত লিখুন (থানা ও জেলা সহ)');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/public/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product?.id,
          slug,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerAddress: customerAddress.trim(),
          deliveryZoneId: activeZone?.id,
          deliveryArea: activeZone?.code || activeZone?.name,
          variant: selectedVariantName || 'Standard',
          variantId: selectedVariantId || undefined,
          quantity,
          couponCode: appliedCoupon?.code || undefined,
          notes: orderNotes.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setConfirmedOrder(data);
        toast.success('আপনার অর্ডারটি সফলভাবে গৃহীত হয়েছে!');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        toast.error(data.error || 'অর্ডার সম্পন্ন হতে সমস্যা হয়েছে। পুনরায় চেষ্টা করুন।');
      }
    } catch {
      toast.error('নেটওয়ার্ক ত্রুটি, অনুগ্রহ করে পুনরায় চেষ্টা করুন।');
    } finally {
      setIsSubmitting(false);
    }
  };

  const scrollToOrderForm = () => {
    const el = document.getElementById('order-form');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const getWhatsAppOrderUrl = () => {
    if (!product) return '#';
    const text = encodeURIComponent(
      `আসসালামু আলাইকুম! আমি "${product.name}" (${selectedVariantName || 'স্ট্যান্ডার্ড'}) অর্ডার করতে চাই।\n` +
      `পরিমাণ: ${quantity} পিস\n` +
      `মোট টাকা: ৳${totalPrice.toLocaleString('en-BD')}\n` +
      `ডেলিভারি এরিয়া: ${activeZone?.name || 'স্ট্যান্ডার্ড'}`
    );
    const cleanNum = business?.whatsapp_number ? business.whatsapp_number.replace(/[^0-9]/g, '') : '';
    const phoneNum = cleanNum.startsWith('880') ? cleanNum : cleanNum.startsWith('0') ? `88${cleanNum}` : cleanNum;
    return phoneNum ? `https://wa.me/${phoneNum}?text=${text}` : `https://wa.me/?text=${text}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-6">
        <RefreshCw className="h-10 w-10 animate-spin text-amber-500 mb-4" />
        <h2 className="text-lg font-semibold tracking-wide">পণ্যের বিবরণ ও ডেলিভারি তথ্য লোড হচ্ছে...</h2>
        <p className="text-sm text-neutral-400 mt-1">অনুগ্রহ করে একটু অপেক্ষা করুন</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-6 text-center">
        <Package className="h-16 w-16 text-neutral-600 mb-4" />
        <h2 className="text-2xl font-bold">পণ্যটি খুঁজে পাওয়া যায়নি</h2>
        <p className="text-sm text-neutral-400 mt-2 max-w-md">
          দুঃখিত, এই লিংকটির প্রোডাক্টটি বর্তমানে স্টক আউট অথবা ওয়েবসাইট থেকে সরানো হয়েছে।
        </p>
        <Link href="/" className="mt-6 inline-block">
          <Button variant="outline" className="border-neutral-700 text-neutral-200">
            হোম পেজে ফিরে যান
          </Button>
        </Link>
      </div>
    );
  }

  const allImages = [
    ...(product.images || []),
    ...(product.image_url ? [product.image_url] : []),
  ].filter((url, index, self) => self.indexOf(url) === index && Boolean(url));

  const currentBuyer = RECENT_BUYERS[currentBuyerIndex];

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans antialiased pb-28 md:pb-12">
      {/* Top Banner: Urgency & Guarantee */}
      <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 text-neutral-950 px-4 py-2 text-center text-xs md:text-sm font-bold flex items-center justify-center gap-2 shadow-md">
        <Flame className="h-4 w-4 fill-neutral-950 animate-bounce" />
        <span>{business?.announcement_text || 'স্পেশাল অফার! পার্সেল হাতে পেয়ে খুলে দেখে মূল্য পরিশোধের ১০০% সুযোগ!'}</span>
        <span className="hidden sm:inline">🚚 সীমিত সময়ের জন্য ক্যাশ অন ডেলিভারি!</span>
      </div>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        {/* Breadcrumb / Top Bar */}
        <div className="flex items-center justify-between text-xs text-neutral-400 border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-amber-500" />
            <Link href="/" className="font-semibold text-neutral-200 hover:text-amber-400 uppercase tracking-wider">
              {business?.store_name || 'Store'}
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-neutral-300">{product.category || 'General'}</span>
            <ChevronRight className="h-3 w-3" />
            <span className="truncate max-w-[200px] text-neutral-400">{product.name}</span>
          </div>
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title: product.name, url: window.location.href });
              } else {
                navigator.clipboard.writeText(window.location.href);
                toast.success('প্রোডাক্ট লিংক কপি করা হয়েছে!');
              }
            }}
            className="flex items-center gap-1 hover:text-amber-400 transition-colors"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>শেয়ার</span>
          </button>
        </div>

        {/* Confirmation Screen */}
        {confirmedOrder ? (
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/20 p-6 md:p-10 text-center space-y-6 animate-in fade-in zoom-in duration-300">
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 mx-auto">
              <CheckCircle2 className="h-10 w-10" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl md:text-3xl font-extrabold text-emerald-400">
                ধন্যবাদ! আপনার অর্ডারটি নিশ্চিত হয়েছে 🎉
              </h2>
              <p className="text-neutral-300 text-sm max-w-lg mx-auto">
                আমাদের কাস্টমার কেয়ার প্রতিনিধি শীঘ্রই আপনার সাথে ফোনে যোগাযোগ করে ডেলিভারি কনফার্ম করবেন।
              </p>
            </div>

            {/* Order Summary Card */}
            <div className="max-w-md mx-auto rounded-xl bg-neutral-900/90 border border-neutral-800 p-5 text-left text-xs space-y-2.5 shadow-xl">
              <div className="flex justify-between border-b border-neutral-800 pb-2">
                <span className="text-neutral-400">অর্ডার নম্বর:</span>
                <span className="font-mono font-bold text-amber-400">#{confirmedOrder.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">প্রোডাক্ট:</span>
                <span className="font-semibold text-neutral-200">{product.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">ভ্যারিয়েন্ট:</span>
                <span className="text-neutral-200">{confirmedOrder.variant || selectedVariantName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">ডেলিভারি এরিয়া:</span>
                <span className="text-neutral-200">{activeZone?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">পরিমাণ:</span>
                <span className="text-neutral-200">{quantity} পিস</span>
              </div>
              <div className="flex justify-between border-t border-neutral-800 pt-2 font-bold text-sm">
                <span className="text-neutral-300">সর্বমোট প্রদেয় টাকা:</span>
                <span className="text-emerald-400">৳{confirmedOrder.totalAmount?.toLocaleString('en-BD')}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <a
                href={getWhatsAppOrderUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 shadow-lg transition-all"
              >
                <MessageCircle className="h-5 w-5" />
                <span>হোয়াটসঅ্যাপে যোগাযোগ করুন</span>
              </a>
              <Button
                variant="outline"
                onClick={() => setConfirmedOrder(null)}
                className="w-full sm:w-auto border-neutral-700 text-neutral-300 hover:bg-neutral-800"
              >
                নতুন আরেকটি অর্ডার করুন
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Image Gallery & Highlights (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              {/* Main Image Container */}
              <div className="relative aspect-square w-full rounded-2xl bg-neutral-900 border border-neutral-800 overflow-hidden shadow-2xl group">
                {selectedImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedImage}
                    alt={product.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center text-neutral-600">
                    <Package className="h-20 w-20 stroke-[1]" />
                    <span className="text-xs mt-2">ছবি উপলব্ধ নেই</span>
                  </div>
                )}

                {/* Overlays */}
                <div className="absolute top-4 left-4 flex flex-col gap-1.5">
                  {product.badge_text ? (
                    <Badge className="bg-amber-500 text-neutral-950 font-bold text-xs uppercase px-2.5 py-1">
                      {product.badge_text}
                    </Badge>
                  ) : discountPct ? (
                    <Badge className="bg-red-600 text-white font-bold text-xs px-2.5 py-1 shadow-md">
                      {discountPct}% ডিসকাউন্ট
                    </Badge>
                  ) : null}

                  {product.sku && (
                    <Badge variant="outline" className="bg-black/60 backdrop-blur border-neutral-700 text-[10px] text-neutral-300 font-mono">
                      মডেল: {product.sku}
                    </Badge>
                  )}
                </div>

                <div className="absolute top-4 right-4">
                  {isOutOfStock ? (
                    <Badge variant="destructive" className="font-bold text-xs px-3 py-1 shadow-md">
                      স্টক শেষ (Out of Stock)
                    </Badge>
                  ) : isLowStock ? (
                    <Badge className="bg-amber-600 text-white font-bold text-xs px-3 py-1 flex items-center gap-1 shadow-md animate-pulse">
                      <Flame className="h-3.5 w-3.5" />
                      মাত্র {currentStock} পিস বাকি!
                    </Badge>
                  ) : (
                    <Badge className="bg-emerald-600 text-white font-semibold text-xs px-2.5 py-1">
                      ইন স্টক ({currentStock} pcs)
                    </Badge>
                  )}
                </div>
              </div>

              {/* Thumbnails Swatcher */}
              {allImages.length > 1 && (
                <div className="flex gap-2.5 overflow-x-auto pb-2">
                  {allImages.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedImage(img)}
                      className={`relative h-18 w-18 flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all ${
                        selectedImage === img
                          ? 'border-amber-500 scale-95 shadow-lg'
                          : 'border-neutral-800 opacity-60 hover:opacity-100'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt={`Thumbnail ${idx}`} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {/* Flash Sale Countdown Timer Box */}
              <div className="rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-950/40 via-neutral-900 to-amber-950/30 p-3.5 flex items-center justify-between shadow-inner">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Clock className="h-4 w-4 animate-spin text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-amber-400">সীমিত সময়ের ধামাকা অফার!</p>
                    <p className="text-[11px] text-neutral-400">অফার শেষ হতে বাকি রয়েছে:</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-neutral-100">
                  <span className="bg-neutral-800 px-2 py-1 rounded border border-neutral-700">
                    {String(countdown.hours).padStart(2, '0')}h
                  </span>
                  <span>:</span>
                  <span className="bg-neutral-800 px-2 py-1 rounded border border-neutral-700">
                    {String(countdown.minutes).padStart(2, '0')}m
                  </span>
                  <span>:</span>
                  <span className="bg-amber-600 text-white px-2 py-1 rounded animate-pulse">
                    {String(countdown.seconds).padStart(2, '0')}s
                  </span>
                </div>
              </div>

              {/* Technical Specifications */}
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 space-y-4">
                <h4 className="text-sm font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  পণ্যের স্পেসিফিকেশন ও বিবরণ
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl bg-neutral-950/80 p-3 border border-neutral-800/80">
                    <span className="text-neutral-500 block text-[10px]">{business?.spec_label_1 || 'মডেল / কোড'}</span>
                    <span className="font-semibold text-neutral-200 mt-0.5 block">{product.dial_size || product.sku || 'স্ট্যান্ডার্ড'}</span>
                  </div>
                  <div className="rounded-xl bg-neutral-950/80 p-3 border border-neutral-800/80">
                    <span className="text-neutral-500 block text-[10px]">{business?.spec_label_2 || 'উপাদান / কোয়ালিটি'}</span>
                    <span className="font-semibold text-neutral-200 mt-0.5 block">{product.movement || 'প্রিমিয়াম গ্রেড'}</span>
                  </div>
                  <div className="rounded-xl bg-neutral-950/80 p-3 border border-neutral-800/80">
                    <span className="text-neutral-500 block text-[10px]">{business?.spec_label_3 || 'সাইজ / ভ্যারিয়েন্ট'}</span>
                    <span className="font-semibold text-neutral-200 mt-0.5 block">{product.water_resistance || product.strap_type || 'অরিজিনাল'}</span>
                  </div>
                  <div className="rounded-xl bg-neutral-950/80 p-3 border border-neutral-800/80">
                    <span className="text-neutral-500 block text-[10px]">{business?.spec_label_4 || 'ওয়ারেন্টি / সার্ভিস'}</span>
                    <span className="font-semibold text-neutral-200 mt-0.5 block">
                      {product.warranty_months ? `${product.warranty_months} মাসের অফিশিয়াল ওয়ারেন্টি` : '১০০% কোয়ালিটি চেকড'}
                    </span>
                  </div>
                </div>

                {product.description && (
                  <p className="text-xs text-neutral-400 leading-relaxed border-t border-neutral-800 pt-3">
                    {product.description}
                  </p>
                )}
              </div>

              {/* Guarantee Pillars */}
              <div className="grid grid-cols-3 gap-2.5 pt-1">
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3 text-center space-y-1">
                  <ShieldCheck className="h-5 w-5 text-amber-500 mx-auto" />
                  <p className="text-[11px] font-bold text-neutral-200">{business?.feature_3_title || `${product.warranty_months} মাসের ওয়ারেন্টি`}</p>
                  <p className="text-[9px] text-neutral-400">{business?.feature_3_subtitle || 'অফিশিয়াল সার্ভিসিং'}</p>
                </div>
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3 text-center space-y-1">
                  <Package className="h-5 w-5 text-emerald-400 mx-auto" />
                  <p className="text-[11px] font-bold text-neutral-200">{business?.feature_1_title || 'চেক করে রিসিভ'}</p>
                  <p className="text-[9px] text-neutral-400">{business?.feature_1_subtitle || '১০০% ক্যাশ অন ডেলিভারি'}</p>
                </div>
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3 text-center space-y-1">
                  <Truck className="h-5 w-5 text-blue-400 mx-auto" />
                  <p className="text-[11px] font-bold text-neutral-200">{business?.feature_2_title || 'সুপারফাস্ট ডেলিভারি'}</p>
                  <p className="text-[9px] text-neutral-400">{activeZone?.estimated_time || business?.feature_2_subtitle || '২৪-৪৮ ঘণ্টার ভেতর'}</p>
                </div>
              </div>
            </div>

            {/* Right Column: Title, Variant Selector, Pricing & COD Order Form (5 cols) */}
            <div className="lg:col-span-5 space-y-5" id="order-form">
              {/* Product Header */}
              <div className="space-y-2">
                <h1 className="text-xl md:text-2xl font-extrabold text-neutral-100 leading-snug tracking-tight">
                  {product.name}
                </h1>

                {/* Price Display */}
                <div className="flex items-baseline gap-3 pt-1">
                  <span className="text-3xl font-black text-amber-400 tracking-tight">
                    ৳{effectiveUnitPrice.toLocaleString('en-BD')}
                  </span>
                  {matchedTier && unitPrice > effectiveUnitPrice ? (
                    <span className="text-base text-neutral-500 line-through">
                      ৳{unitPrice.toLocaleString('en-BD')}
                    </span>
                  ) : hasDiscount ? (
                    <span className="text-base text-neutral-500 line-through">
                      ৳{regularPrice?.toLocaleString('en-BD')}
                    </span>
                  ) : null}
                  {matchedTier ? (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
                      {matchedTier.label || `${matchedTier.quantity}+ টি নিলে বিশেষ ছাড়`}
                    </Badge>
                  ) : discountPct ? (
                    <Badge className="bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold">
                      {discountPct}% OFF
                    </Badge>
                  ) : null}
                </div>
              </div>

              {/* Dynamic Free Delivery Promotion Banner */}
              {deliverySettings?.free_delivery_banner_text && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 flex items-center gap-2.5 text-xs text-emerald-300">
                  <Gift className="h-4 w-4 text-emerald-400 flex-shrink-0 animate-bounce" />
                  <span>{deliverySettings.free_delivery_banner_text}</span>
                </div>
              )}

              {/* Variants Selector (Color / Strap) */}
              {product.variants && product.variants.length > 0 ? (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-neutral-300 flex items-center justify-between">
                    <span>মডেল ভ্যারিয়েন্ট সিলেক্ট করুন:</span>
                    <span className="text-amber-400 font-bold">{selectedVariantName}</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {product.variants.map((v) => {
                      const isSelected = selectedVariantId === v.id;
                      const isVarOut = v.stock === 0;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          disabled={isVarOut}
                          onClick={() => {
                            setSelectedVariantId(v.id);
                            setSelectedVariantName(v.name);
                            if (v.image_url) setSelectedImage(v.image_url);
                          }}
                          className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left text-xs transition-all ${
                            isSelected
                              ? 'border-amber-500 bg-amber-500/10 text-neutral-100 shadow-sm ring-1 ring-amber-500'
                              : isVarOut
                              ? 'border-neutral-800 bg-neutral-900/40 text-neutral-600 cursor-not-allowed'
                              : 'border-neutral-800 bg-neutral-900/70 hover:border-neutral-700 text-neutral-300'
                          }`}
                        >
                          {v.image_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={v.image_url} alt={v.name} className="h-8 w-8 rounded-lg object-cover flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate text-[11px]">{v.name}</p>
                            <p className="text-[10px] text-neutral-400">
                              {v.price ? `৳${v.price}` : `৳${product.price}`}
                              {isVarOut && ' (স্টক আউট)'}
                            </p>
                          </div>
                          {isSelected && <Check className="h-4 w-4 text-amber-500 flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : product.colors && product.colors.length > 0 ? (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-neutral-300 flex items-center justify-between">
                    <span>কালার অপশন সিলেক্ট করুন:</span>
                    <span className="text-amber-400 font-bold">{selectedVariantName}</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {product.colors.map((color, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedVariantName(color)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all flex items-center gap-1.5 ${
                          selectedVariantName === color
                            ? 'border-amber-500 bg-amber-500/10 text-amber-400 shadow-sm'
                            : 'border-neutral-800 bg-neutral-900/80 text-neutral-400 hover:text-neutral-200'
                        }`}
                      >
                        {selectedVariantName === color && <Check className="h-3 w-3 text-amber-400" />}
                        <span>{color}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Special Tiered Offer Packages */}
              {product.tier_pricing && product.tier_pricing.length > 0 && (
                <div className="space-y-2 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-neutral-900 to-neutral-950 p-3.5 shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                      স্পেশাল প্যাকেজ অফার (বেশি নিলে বেশি ছাড়):
                    </span>
                    {matchedTier && (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                        {matchedTier.label || `${matchedTier.quantity}+ টি অফার অ্যাক্টিভ`}
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {/* Default Single Item Card */}
                    <button
                      type="button"
                      onClick={() => setQuantity(1)}
                      className={`p-3 rounded-xl border text-left text-xs transition-all relative flex flex-col justify-between ${
                        quantity === 1
                          ? 'border-amber-500 bg-amber-500/15 ring-2 ring-amber-500/60 shadow-md text-neutral-100'
                          : 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-700 text-neutral-400'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-xs text-neutral-200">১ পিস (একক)</span>
                        {quantity === 1 && <Check className="h-4 w-4 text-amber-400" />}
                      </div>
                      <div className="mt-2">
                        <p className="text-base font-extrabold text-amber-400">৳{unitPrice.toLocaleString('en-BD')}</p>
                        <p className="text-[10px] text-neutral-400">নিয়মিত মূল্য</p>
                      </div>
                    </button>

                    {/* Tier Option Cards */}
                    {product.tier_pricing.map((tier, idx) => {
                      const isTierSelected = quantity === Number(tier.quantity);
                      const tierPrice = Number(tier.price);
                      const totalTierAmount = tierPrice * Number(tier.quantity);
                      const totalSaved = (unitPrice * Number(tier.quantity)) - totalTierAmount;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setQuantity(Number(tier.quantity))}
                          className={`p-3 rounded-xl border text-left text-xs transition-all relative flex flex-col justify-between overflow-hidden ${
                            isTierSelected
                              ? 'border-amber-500 bg-amber-500/15 ring-2 ring-amber-500/60 shadow-lg text-neutral-100'
                              : 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-700 text-neutral-400'
                          }`}
                        >
                          {tier.badge && (
                            <span className="absolute top-0 right-0 bg-gradient-to-r from-red-600 to-amber-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-bl-lg shadow">
                              {tier.badge}
                            </span>
                          )}
                          <div className="flex justify-between items-start pr-6">
                            <span className="font-bold text-xs text-neutral-200">
                              {tier.quantity} পিস {tier.label ? `• ${tier.label}` : ''}
                            </span>
                            {isTierSelected && <Check className="h-4 w-4 text-amber-400 flex-shrink-0" />}
                          </div>
                          <div className="mt-2">
                            <p className="text-base font-extrabold text-amber-400">
                              ৳{tierPrice.toLocaleString('en-BD')}{' '}
                              <span className="text-[10px] font-normal text-neutral-400">/প্রতি পিস</span>
                            </p>
                            <div className="flex items-center justify-between text-[11px] mt-0.5">
                              <span className="text-neutral-300 font-medium">মোট: ৳{totalTierAmount.toLocaleString('en-BD')}</span>
                              {totalSaved > 0 && (
                                <span className="text-emerald-400 font-bold bg-emerald-500/15 px-1.5 py-0.5 rounded text-[10px]">
                                  সেভ ৳{totalSaved.toLocaleString('en-BD')}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quantity Picker */}
              <div className="flex items-center justify-between rounded-xl bg-neutral-900 border border-neutral-800 p-3">
                <span className="text-xs font-semibold text-neutral-300">অর্ডারের পরিমাণ:</span>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-lg border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
                    disabled={quantity <= 1}
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-base font-bold text-neutral-100 min-w-[20px] text-center font-mono">
                    {quantity}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-lg border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
                    disabled={quantity >= currentStock}
                    onClick={() => setQuantity(quantity + 1)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Order Form Card */}
              <div className="rounded-2xl border-2 border-amber-500/50 bg-neutral-900/90 p-5 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 text-amber-500" />
                    <h3 className="font-bold text-sm text-neutral-100">
                      অর্ডার নিশ্চিত করতে নিচের ফর্মটি পূরণ করুন
                    </h3>
                  </div>
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-[10px]">
                    ক্যাশ অন ডেলিভারি
                  </Badge>
                </div>

                <form onSubmit={handleOrderSubmit} className="space-y-3.5">
                  {/* Customer Name */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-neutral-300">
                      আপনার নাম <span className="text-red-400">*</span>
                    </label>
                    <Input
                      placeholder="যেমন: মোঃ সাব্বির আহমেদ"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="h-10 rounded-xl bg-neutral-950 border-neutral-800 text-xs text-neutral-100 placeholder:text-neutral-600 focus:border-amber-500"
                      required
                    />
                  </div>

                  {/* Customer Phone */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-neutral-300">
                      মোবাইল নম্বর <span className="text-red-400">*</span>
                    </label>
                    <Input
                      type="tel"
                      placeholder="01XXXXXXXXX (১১ ডিজিট)"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="h-10 rounded-xl bg-neutral-950 border-neutral-800 text-xs text-neutral-100 placeholder:text-neutral-600 focus:border-amber-500"
                      required
                    />
                  </div>

                  {/* Customer Full Address */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-neutral-300">
                      সম্পূর্ণ ডেলিভারি ঠিকানা <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      rows={2}
                      placeholder="রোড/বাসা নম্বর, এরিয়া, থানা ও জেলা উল্লেখ করুন..."
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      className="w-full rounded-xl bg-neutral-950 border border-neutral-800 p-2.5 text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-amber-500"
                      required
                    />
                  </div>

                  {/* Dynamic Delivery Zones Toggle */}
                  <div className="space-y-1.5 pt-1">
                    <label className="text-[11px] font-semibold text-neutral-300">
                      ডেলিভারি এরিয়া সিলেক্ট করুন:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {deliveryZones.map((zone) => {
                        const isSelected = selectedZoneId === zone.id;
                        const zoneIsFree = isFreeDelivery || zone.is_free || zone.charge === 0;

                        return (
                          <button
                            key={zone.id}
                            type="button"
                            onClick={() => setSelectedZoneId(zone.id)}
                            className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                              isSelected
                                ? 'border-amber-500 bg-amber-500/10 text-neutral-100 font-semibold ring-1 ring-amber-500'
                                : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-neutral-200'
                            }`}
                          >
                            <span className="block font-medium truncate">{zone.name}</span>
                            <span className="text-[10px] text-amber-400 block mt-0.5">
                              {zoneIsFree ? 'ফ্রি ডেলিভারি' : `চার্জ ৳${zone.charge}`} • {zone.estimated_time || '২৪-৪৮ ঘণ্টা'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Coupon Code Section */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-neutral-300 flex items-center gap-1">
                        <Tag className="h-3 w-3 text-amber-400" />
                        কুপন বা প্রোমো কোড (যদি থাকে):
                      </label>
                      {appliedCoupon && (
                        <span className="text-[10px] text-emerald-400 font-bold">
                          -৳{appliedCoupon.discountAmount} ছাড়
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="যেমন: SAVE100"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        disabled={!!appliedCoupon}
                        className="h-9 rounded-xl bg-neutral-950 border-neutral-800 text-xs text-neutral-100 uppercase placeholder:normal-case focus:border-amber-500"
                      />
                      {appliedCoupon ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setAppliedCoupon(null);
                            setCouponCode('');
                          }}
                          className="h-9 text-xs border-red-500/40 text-red-400 hover:bg-red-500/10"
                        >
                          বাতিল
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleApplyCoupon}
                          disabled={isApplyingCoupon || !couponCode.trim()}
                          className="h-9 text-xs bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold"
                        >
                          {isApplyingCoupon ? '...' : 'প্রয়োগ করুন'}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Price Breakdown */}
                  <div className="rounded-xl bg-neutral-950 p-3 space-y-1.5 text-xs border border-neutral-800/80">
                    <div className="flex justify-between text-neutral-400">
                      <span>পণ্যের দাম ({quantity}টি):</span>
                      <span className="text-neutral-200 font-medium">৳{itemsSubtotal.toLocaleString('en-BD')}</span>
                    </div>
                    {matchedTier && unitPrice > effectiveUnitPrice && (
                      <div className="flex justify-between text-emerald-400 font-medium">
                        <span>প্যাকেজ সেভিংস ({matchedTier.label || `${matchedTier.quantity}+ টি অফার`}):</span>
                        <span className="font-mono">-৳{((unitPrice - effectiveUnitPrice) * quantity).toLocaleString('en-BD')}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-neutral-400">
                      <span>ডেলিভারি চার্জ ({activeZone?.name || 'ডেলিভারি'}):</span>
                      <span className={isFreeDelivery ? 'text-emerald-400 font-bold' : 'text-neutral-200 font-medium'}>
                        {isFreeDelivery ? '৳০ (ফ্রি অফার)' : `৳${deliveryFee}`}
                      </span>
                    </div>
                    {couponDiscount > 0 && (
                      <div className="flex justify-between text-emerald-400 font-medium">
                        <span>কুপন ছাড় ({appliedCoupon?.code}):</span>
                        <span className="font-mono">-৳{couponDiscount.toLocaleString('en-BD')}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-sm text-neutral-100 border-t border-neutral-800 pt-1.5 mt-1">
                      <span>সর্বমোট পরিশোধযোগ্য:</span>
                      <span className="text-amber-400 text-base">৳{totalPrice.toLocaleString('en-BD')}</span>
                    </div>
                  </div>

                  {/* Submit Order Button */}
                  <Button
                    type="submit"
                    disabled={isSubmitting || isOutOfStock}
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.01]"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        অর্ডার প্রসেসিং হচ্ছে...
                      </span>
                    ) : isOutOfStock ? (
                      'দুঃখিত, স্টক শেষ হয়ে গেছে'
                    ) : (
                      'অর্ডার কনফার্ম করুন (ক্যাশ অন ডেলিভারি) ➔'
                    )}
                  </Button>
                </form>

                {/* 1-Click WhatsApp Direct Order Button */}
                <div className="pt-2 border-t border-neutral-800/80">
                  <a
                    href={getWhatsAppOrderUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 font-semibold py-2.5 px-4 text-xs transition-colors"
                  >
                    <MessageCircle className="h-4 w-4 text-emerald-400" />
                    <span>হোয়াটসঅ্যাপে সরাসরি অর্ডার করুন</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Customer Reviews & Social Proof Section */}
        {reviews.length > 0 && (
          <section className="mt-16 pt-12 border-t border-neutral-800/80">
            <div className="text-center mb-8">
              <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-400 text-xs mb-2">
                ⭐ ৫-স্টার কাস্টমার রিভিউ
              </Badge>
              <h3 className="text-2xl font-bold text-neutral-100">
                সম্মানিত ক্রেতাদের বাস্তব রিভিউ ও অভিজ্ঞতা
              </h3>
              <p className="text-xs text-neutral-400 mt-1">
                আমাদের প্রিমিয়াম পণ্য ব্যবহার করে সম্মানিত ক্রেতারা যা বলছেন
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 space-y-3 shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex text-amber-400 text-sm">
                      {Array.from({ length: rev.rating || 5 }).map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    {rev.is_verified_purchase && (
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full font-medium">
                        ✓ ভেরিফাইড ক্রেতা
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-300 italic leading-relaxed">
                    "{rev.review_text}"
                  </p>
                  {rev.image_url && (
                    <div className="rounded-xl overflow-hidden border border-neutral-800 bg-neutral-950 aspect-video max-h-40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={rev.image_url}
                        alt="Customer photo review"
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <div className="border-t border-neutral-800/80 pt-2.5 flex items-center justify-between text-xs text-neutral-400">
                    <span className="font-semibold text-neutral-200">{rev.customer_name}</span>
                    <span className="text-[11px] text-neutral-500">{rev.customer_city || 'বাংলাদেশ'}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Floating Recent Purchase Social Proof Pop-up Ticker */}
      <div
        className={`fixed bottom-20 left-4 z-40 max-w-xs rounded-xl bg-neutral-900/95 border border-amber-500/40 p-3 shadow-2xl backdrop-blur transition-all duration-500 flex items-center gap-3 ${
          showBuyerToast ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0 pointer-events-none'
        }`}
      >
        <div className="h-9 w-9 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
          <ShoppingBag className="h-4 w-4" />
        </div>
        <div className="text-xs min-w-0">
          <p className="font-bold text-neutral-200 truncate">{currentBuyer.name}</p>
          <p className="text-[11px] text-neutral-400 truncate">{currentBuyer.location} থেকে অর্ডার করেছেন</p>
          <span className="text-[10px] text-amber-400/90 font-mono">{currentBuyer.time}</span>
        </div>
      </div>

      {/* Sticky Mobile Bottom Order Bar */}
      {!confirmedOrder && !isOutOfStock && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-neutral-950/95 backdrop-blur border-t border-neutral-800 p-3 flex items-center justify-between gap-3 shadow-2xl">
          <div>
            <span className="text-[10px] text-neutral-400 block">মোট মূল্য</span>
            <span className="text-lg font-black text-amber-400">
              ৳{totalPrice.toLocaleString('en-BD')}
            </span>
          </div>
          <Button
            onClick={scrollToOrderForm}
            className="h-10 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-neutral-950 font-bold text-xs shadow-md"
          >
            অর্ডার করতে চাই 🛍️
          </Button>
        </div>
      )}

      {/* Floating WhatsApp Chat Widget */}
      <FloatingWhatsAppWidget
        storeName={business?.store_name}
        whatsappNumber={business?.whatsapp_number}
        productName={product?.name}
        productPrice={unitPrice}
        logoUrl={business?.logo_url}
      />
    </div>
  );
}
