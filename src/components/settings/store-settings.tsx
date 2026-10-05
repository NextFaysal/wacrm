'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  BUSINESS_TYPE_PRESETS,
  type BusinessType,
  type BusinessSettings,
} from '@/types/business';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Store,
  Sparkles,
  ExternalLink,
  Copy,
  Upload,
  RefreshCw,
  Phone,
  MessageCircle,
  ShieldCheck,
  Package,
  Truck,
  CheckCircle2,
  Tag,
  Palette,
  Globe,
  Key,
} from 'lucide-react';

export function StoreSettings() {
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Form local state
  const [storeName, setStoreName] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType>('general');
  const [tagline, setTagline] = useState('');
  const [heroTitle, setHeroTitle] = useState('');
  const [heroSubtitle, setHeroSubtitle] = useState('');
  const [storeSlug, setStoreSlug] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [address, setAddress] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#f59e0b');

  // Specs
  const [spec1, setSpec1] = useState('');
  const [spec2, setSpec2] = useState('');
  const [spec3, setSpec3] = useState('');
  const [spec4, setSpec4] = useState('');

  // Features
  const [f1Title, setF1Title] = useState('');
  const [f1Subtitle, setF1Subtitle] = useState('');
  const [f2Title, setF2Title] = useState('');
  const [f2Subtitle, setF2Subtitle] = useState('');
  const [f3Title, setF3Title] = useState('');
  const [f3Subtitle, setF3Subtitle] = useState('');

  // Announcement
  const [announcementText, setAnnouncementText] = useState('');
  const [announcementEnabled, setAnnouncementEnabled] = useState(true);

  // Meta Conversions API (CAPI)
  const [metaPixelId, setMetaPixelId] = useState('');
  const [metaCapiAccessToken, setMetaCapiAccessToken] = useState('');
  const [metaCapiTestCode, setMetaCapiTestCode] = useState('');

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/settings/business');
      const data = await res.json();
      if (res.ok && data.settings) {
        const s: BusinessSettings = data.settings;
        setSettings(s);
        setStoreName(s.store_name || '');
        setBusinessType(s.business_type || 'general');
        setTagline(s.tagline || '');
        setHeroTitle(s.hero_title || '');
        setHeroSubtitle(s.hero_subtitle || '');
        setStoreSlug(s.store_slug || '');
        setLogoUrl(s.logo_url || '');
        setBannerUrl(s.banner_url || '');
        setSupportPhone(s.support_phone || '');
        setWhatsappNumber(s.whatsapp_number || '');
        setSupportEmail(s.support_email || '');
        setAddress(s.address || '');
        setPrimaryColor(s.primary_color || '#f59e0b');

        setSpec1(s.spec_label_1 || 'স্পেসিফিকেশন ১');
        setSpec2(s.spec_label_2 || 'স্পেসিফিকেশন ২');
        setSpec3(s.spec_label_3 || 'স্পেসিফিকেশন ৩');
        setSpec4(s.spec_label_4 || 'স্পেসিফিকেশন ৪');

        setF1Title(s.feature_1_title || 'ক্যাশ অন ডেলিভারি');
        setF1Subtitle(s.feature_1_subtitle || 'পার্সেল দেখে মূল্য পরিশোধের সুযোগ');
        setF2Title(s.feature_2_title || 'সুপারফাস্ট ডেলিভারি');
        setF2Subtitle(s.feature_2_subtitle || 'সারাদেশে দ্রুত হোম ডেলিভারি');
        setF3Title(s.feature_3_title || '১০০% অরিজিনাল');
        setF3Subtitle(s.feature_3_subtitle || 'নিখুঁত কোয়ালিটি গ্যারান্টি');

        setAnnouncementText(s.announcement_text || '🔥 সীমিত সময়ের স্পেশাল অফার! দ্রুত অর্ডার কনফার্ম করুন!');
        setAnnouncementEnabled(s.announcement_enabled ?? true);

        setMetaPixelId(s.meta_pixel_id || '');
        setMetaCapiAccessToken(s.meta_capi_access_token || '');
        setMetaCapiTestCode(s.meta_capi_test_code || '');
      } else {
        toast.error(data.error || 'Failed to load business settings');
      }
    } catch {
      toast.error('Network error loading store settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Apply a Business Type preset template
  const handleApplyPreset = (type: BusinessType) => {
    const preset = BUSINESS_TYPE_PRESETS[type];
    if (!preset) return;
    setBusinessType(type);
    if (!storeName || storeName === 'My Store' || storeName === 'My Online Store') {
      setStoreName(preset.defaultStoreName);
    }
    if (!tagline || tagline.includes('নিশ্চয়তা')) {
      setTagline(preset.defaultTagline);
    }
    setSpec1(preset.defaultSpecs.spec_label_1);
    setSpec2(preset.defaultSpecs.spec_label_2);
    setSpec3(preset.defaultSpecs.spec_label_3);
    setSpec4(preset.defaultSpecs.spec_label_4);
    toast.success(`"${preset.label}" প্রিসেট টেমপ্লেট লোড হয়েছে!`);
  };

  // Image Upload helper
  const handleUploadImage = async (
    file: File,
    type: 'logo' | 'banner'
  ) => {
    try {
      if (type === 'logo') setUploadingLogo(true);
      else setUploadingBanner(true);

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/products/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.url) {
        if (type === 'logo') {
          setLogoUrl(data.url);
          toast.success('লোগো সফলভাবে আপলোড হয়েছে!');
        } else {
          setBannerUrl(data.url);
          toast.success('ব্যানার সফলভাবে আপলোড হয়েছে!');
        }
      } else {
        toast.error(data.error || 'ইমেজ আপলোড করতে সমস্যা হয়েছে');
      }
    } catch {
      toast.error('নেটওয়ার্ক সমস্যার কারণে আপলোড ব্যর্থ হয়েছে');
    } finally {
      if (type === 'logo') setUploadingLogo(false);
      else setUploadingBanner(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) {
      toast.error('স্টোরের নাম আবশ্যক');
      return;
    }

    try {
      setSaving(true);
      const res = await fetch('/api/settings/business', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_name: storeName.trim(),
          business_type: businessType,
          tagline: tagline.trim(),
          hero_title: heroTitle.trim(),
          hero_subtitle: heroSubtitle.trim(),
          store_slug: storeSlug.trim() || undefined,
          logo_url: logoUrl.trim(),
          banner_url: bannerUrl.trim(),
          support_phone: supportPhone.trim(),
          whatsapp_number: whatsappNumber.trim(),
          support_email: supportEmail.trim(),
          address: address.trim(),
          primary_color: primaryColor,
          spec_label_1: spec1.trim(),
          spec_label_2: spec2.trim(),
          spec_label_3: spec3.trim(),
          spec_label_4: spec4.trim(),
          feature_1_title: f1Title.trim(),
          feature_1_subtitle: f1Subtitle.trim(),
          feature_2_title: f2Title.trim(),
          feature_2_subtitle: f2Subtitle.trim(),
          feature_3_title: f3Title.trim(),
          feature_3_subtitle: f3Subtitle.trim(),
          announcement_text: announcementText.trim(),
          announcement_enabled: announcementEnabled,
          meta_pixel_id: metaPixelId.trim() || null,
          meta_capi_access_token: metaCapiAccessToken.trim() || null,
          meta_capi_test_code: metaCapiTestCode.trim() || null,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSettings(data.settings);
        toast.success('🎉 স্টোর ও সিএমএস সেটিংস সফলভাবে সংরক্ষিত হয়েছে!');
      } else {
        toast.error(data.error || 'সেটিংস সংরক্ষণ ব্যর্থ হয়েছে');
      }
    } catch {
      toast.error('নেটওয়ার্ক ত্রুটি, অনুগ্রহ করে পুনরায় চেষ্টা করুন');
    } finally {
      setSaving(false);
    }
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const publicStoreUrl = storeSlug ? `${origin}/store/${storeSlug}` : `${origin}/store`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicStoreUrl);
    setCopiedLink(true);
    toast.success('পাবলিক স্টোর লিংক কপি করা হয়েছে!');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">স্টোর কনফিগারেশন লোড হচ্ছে...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-background to-primary/5 p-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Store className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Online Store & CMS Settings
            </h2>
            <Badge variant="outline" className="border-primary/40 bg-primary/20 text-primary font-semibold text-xs">
              Dynamic Multi-Business
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            আপনার ব্যবসা যেকোনো ধরনের হোক (ঘড়ি, পোশাক, গ্যাজেট, খাবার বা কসমেটিক্স), এখান থেকে ব্র্যান্ডিং, হোমপেজ ক্যাটালগ ও স্পেসিফিকেশন ফিল্ড পরিবর্তন করুন।
          </p>
        </div>

        {/* Store Link preview */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="gap-1.5 text-xs bg-background shadow-xs"
          >
            {copiedLink ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copiedLink ? 'কপি হয়েছে' : 'লিংক কপি'}</span>
          </Button>

          <Link href={publicStoreUrl} target="_blank">
            <Button size="sm" className="gap-1.5 text-xs shadow-xs">
              <ExternalLink className="h-3.5 w-3.5" />
              <span>স্টোর দেখুন</span>
            </Button>
          </Link>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Business Type & Template */}
        <Card className="border border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              ১. ব্যবসার ধরন ও দ্রুত টেমপ্লেট প্রিসেট (Business Type)
            </CardTitle>
            <CardDescription className="text-xs">
              যেকোনো ব্যবসা নির্বাচন করুন — স্বয়ংক্রিয়ভাবে পণ্যের বিবরণ ও ফিল্ড সাজিয়ে দেওয়া হবে:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {(Object.keys(BUSINESS_TYPE_PRESETS) as BusinessType[]).map((type) => {
                const preset = BUSINESS_TYPE_PRESETS[type];
                const isSelected = businessType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleApplyPreset(type)}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary'
                        : 'border-border/60 bg-card/40 hover:bg-muted/40 hover:border-border'
                    }`}
                  >
                    <div>
                      <p className={`text-xs font-bold ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                        {preset.label.split('(')[0]}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {preset.label.match(/\((.*?)\)/)?.[1] || ''}
                      </p>
                    </div>
                    {isSelected && (
                      <Badge className="w-fit mt-2 text-[9px] bg-primary text-primary-foreground py-0 px-1.5">
                        সক্রিয়
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Store Branding & Identity */}
        <Card className="border border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Store className="h-4 w-4 text-primary" />
              ২. স্টোরের নাম, ট্যাগলাইন ও ব্র্যান্ডিং (Branding & Identity)
            </CardTitle>
            <CardDescription className="text-xs">
              কাস্টমার যখন আপনার হোমপেজ বা প্রডাক্ট পেইজে আসবে, তখন এই নাম ও লোগো দেখতে পাবে।
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  স্টোরের নাম (Store Name) <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="যেমন: ফ্যাশন হাউজ বিডি"
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  স্টোর ইউনিক লিংক স্লাগ (Store URL Slug)
                </Label>
                <div className="flex items-center rounded-lg border border-input bg-muted/40 px-2.5 h-9">
                  <span className="text-xs text-muted-foreground select-none">/store/</span>
                  <input
                    type="text"
                    value={storeSlug}
                    onChange={(e) => setStoreSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    placeholder="my-shop"
                    className="w-full bg-transparent text-xs font-mono outline-hidden pl-1"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">ইংরেজি ছোট হাতের অক্ষর, সংখ্যা ও হাইফেন ব্যবহার করুন।</p>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs font-medium">স্টোর ট্যাগলাইন (Store Tagline / স্লোগান)</Label>
                <Input
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="যেমন: সেরা মানের ট্রেন্ডি কালেকশন, ক্যাশ অন ডেলিভারিতে সারাদেশে"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">হোমপেজ মেইন টাইটেল (Hero Section Title)</Label>
                <Input
                  value={heroTitle}
                  onChange={(e) => setHeroTitle(e.target.value)}
                  placeholder="যেমন: আমাদের এক্সক্লুসিভ কালেকশন"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">হোমপেজ সাব-টাইটেল (Hero Subtitle)</Label>
                <Input
                  value={heroSubtitle}
                  onChange={(e) => setHeroSubtitle(e.target.value)}
                  placeholder="যেমন: পছন্দের পণ্যটি বেছে নিন ও ঘরে বসে ক্যাশ অন ডেলিভারিতে রিসিভ করুন"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Logo and Banner Upload */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Logo */}
              <div className="space-y-2 border border-border/60 rounded-xl p-3 bg-card/30">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">স্টোর লোগো (Logo)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] gap-1"
                    disabled={uploadingLogo}
                    onClick={() => logoInputRef.current?.click()}
                  >
                    <Upload className="h-3 w-3" />
                    <span>{uploadingLogo ? 'আপলোড হচ্ছে...' : 'লোগো আপলোড'}</span>
                  </Button>
                </div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleUploadImage(f, 'logo');
                  }}
                />
                <Input
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://... বা সরাসরি আপলোড করুন"
                  className="h-8 text-xs font-mono"
                />
                {logoUrl && (
                  <div className="h-12 w-12 rounded-lg border border-border/80 overflow-hidden bg-background flex items-center justify-center p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoUrl} alt="Store Logo Preview" className="h-full w-full object-contain" />
                  </div>
                )}
              </div>

              {/* Banner */}
              <div className="space-y-2 border border-border/60 rounded-xl p-3 bg-card/30">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">হোমপেজ ব্যানার ইমেজ (Cover Banner)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] gap-1"
                    disabled={uploadingBanner}
                    onClick={() => bannerInputRef.current?.click()}
                  >
                    <Upload className="h-3 w-3" />
                    <span>{uploadingBanner ? 'আপলোড হচ্ছে...' : 'ব্যানার আপলোড'}</span>
                  </Button>
                </div>
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleUploadImage(f, 'banner');
                  }}
                />
                <Input
                  value={bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                  placeholder="https://... বা সরাসরি আপলোড করুন"
                  className="h-8 text-xs font-mono"
                />
                {bannerUrl && (
                  <div className="h-12 w-full rounded-lg border border-border/80 overflow-hidden bg-background">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={bannerUrl} alt="Store Banner Preview" className="h-full w-full object-cover" />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Dynamic Specification Field Labels */}
        <Card className="border border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              ৩. পণ্যের স্পেসিফিকেশন ফিল্ডের নাম (Dynamic Product Spec Labels)
            </CardTitle>
            <CardDescription className="text-xs">
              আগে ঘড়ির জন্য &quot;ডায়াল সাইজ, মুভমেন্ট, ওয়াটার রেজিস্ট্যান্স&quot; ফিক্সড ছিল। এখন আপনি যেকোনো ৪টি স্পেসিফিকেশন লেবেল আপনার ব্যবসার পণ্যের জন্য সেট করতে পারবেন:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">স্পেসিফিকেশন ১ লেবেল</Label>
                <Input
                  value={spec1}
                  onChange={(e) => setSpec1(e.target.value)}
                  placeholder="যেমন: ফেব্রিক / মডেল"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">স্পেসিফিকেশন ২ লেবেল</Label>
                <Input
                  value={spec2}
                  onChange={(e) => setSpec2(e.target.value)}
                  placeholder="যেমন: ওজন / ব্যাটারি"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">স্পেসিফিকেশন ৩ লেবেল</Label>
                <Input
                  value={spec3}
                  onChange={(e) => setSpec3(e.target.value)}
                  placeholder="যেমন: সাইজ / উপাদান"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">স্পেসিফিকেশন ৪ লেবেল</Label>
                <Input
                  value={spec4}
                  onChange={(e) => setSpec4(e.target.value)}
                  placeholder="যেমন: ওয়ারেন্টি / স্থায়িত্ব"
                  className="h-9 text-xs"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">
              💡 উদাহরণ: পোশাকের জন্য (ফেব্রিক, ফিটিং, সাইজ, ওয়াশ কেয়ার) অথবা খাবারের জন্য (উপাদান, নেট ওজন, সংরক্ষণ, মেয়াদ)।
            </p>
          </CardContent>
        </Card>

        {/* Section 4: Contact & WhatsApp Order */}
        <Card className="border border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              ৪. যোগাযোগ ও হোয়াটসঅ্যাপ কন্টাক্ট (Contact & Support)
            </CardTitle>
            <CardDescription className="text-xs">
              হোমপেজ ও প্রডাক্ট পেজে কাস্টমাররা যাতে সরাসরি যোগাযোগ করতে পারে:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />
                  <span>অর্ডার হোয়াটসঅ্যাপ নম্বর (WhatsApp)</span>
                </Label>
                <Input
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="যেমন: 017XXXXXXXX বা 88017XXXXXXXX"
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-blue-500" />
                  <span>হেল্পলাইন ফোন নম্বর</span>
                </Label>
                <Input
                  value={supportPhone}
                  onChange={(e) => setSupportPhone(e.target.value)}
                  placeholder="যেমন: 019XXXXXXXX"
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">সাপোর্ট ইমেইল (ঐচ্ছিক)</Label>
                <Input
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  placeholder="support@myshop.com"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5 md:col-span-3">
                <Label className="text-xs font-medium">স্টোরের ঠিকানা / লোকেশন</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="যেমন: ঢাকা, বাংলাদেশ"
                  className="h-9 text-xs"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 5: Trust Pillars & Highlights */}
        <Card className="border border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              ৫. গ্যারান্টি ও ট্রাস্ট ব্যাজ (Trust & Value Highlights)
            </CardTitle>
            <CardDescription className="text-xs">
              ল্যান্ডিং পেইজ ও স্টোর হোমপেজে এই ৩টি ফিচার হাইলাইট কাস্টমারের বিশ্বাসযোগ্যতা বাড়াতে প্রদর্শিত হয়।
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Feature 1 */}
              <div className="p-3 rounded-xl border border-border/60 space-y-2 bg-card/30">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Package className="h-3.5 w-3.5 text-emerald-500" />
                  <span>ফিচার ১ (ডেলিভারি / পেমেন্ট)</span>
                </div>
                <Input
                  value={f1Title}
                  onChange={(e) => setF1Title(e.target.value)}
                  placeholder="ক্যাশ অন ডেলিভারি"
                  className="h-8 text-xs font-medium"
                />
                <Input
                  value={f1Subtitle}
                  onChange={(e) => setF1Subtitle(e.target.value)}
                  placeholder="পার্সেল দেখে মূল্য পরিশোধের সুযোগ"
                  className="h-8 text-[11px] text-muted-foreground"
                />
              </div>

              {/* Feature 2 */}
              <div className="p-3 rounded-xl border border-border/60 space-y-2 bg-card/30">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Truck className="h-3.5 w-3.5 text-blue-500" />
                  <span>ফিচার ২ (শিপিং স্পিড)</span>
                </div>
                <Input
                  value={f2Title}
                  onChange={(e) => setF2Title(e.target.value)}
                  placeholder="সুপারফাস্ট ডেলিভারি"
                  className="h-8 text-xs font-medium"
                />
                <Input
                  value={f2Subtitle}
                  onChange={(e) => setF2Subtitle(e.target.value)}
                  placeholder="সারাদেশে দ্রুত হোম ডেলিভারি"
                  className="h-8 text-[11px] text-muted-foreground"
                />
              </div>

              {/* Feature 3 */}
              <div className="p-3 rounded-xl border border-border/60 space-y-2 bg-card/30">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-500" />
                  <span>ফিচার ৩ (কোয়ালিটি গ্যারান্টি)</span>
                </div>
                <Input
                  value={f3Title}
                  onChange={(e) => setF3Title(e.target.value)}
                  placeholder="১০০% অরিজিনাল"
                  className="h-8 text-xs font-medium"
                />
                <Input
                  value={f3Subtitle}
                  onChange={(e) => setF3Subtitle(e.target.value)}
                  placeholder="নিখুঁত কোয়ালিটি গ্যারান্টি"
                  className="h-8 text-[11px] text-muted-foreground"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 6: Top Bar Announcement */}
        <Card className="border border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                ৬. টপ নোটিশ বা অফার ব্যানার (Announcement Bar)
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">ব্যানার দেখান</span>
                <Switch
                  checked={announcementEnabled}
                  onCheckedChange={setAnnouncementEnabled}
                />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              value={announcementText}
              onChange={(e) => setAnnouncementText(e.target.value)}
              placeholder="যেমন: 🔥 স্পেশাল অফার! পার্সেল হাতে পেয়ে খুলে দেখে মূল্য পরিশোধের ১০০% সুযোগ!"
              className="h-9 text-xs"
              disabled={!announcementEnabled}
            />
          </CardContent>
        </Card>

        {/* Section 7: Meta Conversions API (CAPI) & Ad Tracking */}
        <Card className="border border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-blue-500" />
                ৭. মেটা সার্ভার-সাইড ট্র্যাকিং (Meta Conversions API - CAPI)
              </span>
              <Badge variant="outline" className="text-[11px] font-normal border-blue-500/30 text-blue-600 dark:text-blue-400">
                100% Server-Side iOS 14+ Proof
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              অর্ডার ও চ্যাট কনভার্সন সরাসরি মেটা সার্ভারে পাঠাতে আপনার ফেসবুক পিক্সেল আইডি এবং CAPI অ্যাক্সেস টোকেন যুক্ত করুন। এতে ফেসবুক অ্যাডের পারফরম্যান্স এবং ROAS বৃদ্ধি পাবে।
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">মেটা পিক্সেল আইডি (Meta Pixel ID)</Label>
                <Input
                  value={metaPixelId}
                  onChange={(e) => setMetaPixelId(e.target.value)}
                  placeholder="যেমন: 123456789012345"
                  className="h-9 text-xs font-mono"
                />
                <p className="text-[10px] text-muted-foreground">Meta Events Manager থেকে প্রাপ্ত পিক্সেল আইডি দিন</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">টেস্ট ইভেন্ট কোড (ঐচ্ছিক / Test Event Code)</Label>
                <Input
                  value={metaCapiTestCode}
                  onChange={(e) => setMetaCapiTestCode(e.target.value)}
                  placeholder="যেমন: TEST12345"
                  className="h-9 text-xs font-mono"
                />
                <p className="text-[10px] text-muted-foreground">ইভেন্ট ম্যানেজার Test Events ট্যাবে লাইভ টেস্ট করার কোড</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5 text-muted-foreground" />
                <span>CAPI সিস্টেম ইউজার অ্যাক্সেস টোকেন (Access Token)</span>
              </Label>
              <Input
                type="password"
                value={metaCapiAccessToken}
                onChange={(e) => setMetaCapiAccessToken(e.target.value)}
                placeholder="EAAG..."
                className="h-9 text-xs font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                Meta Events Manager → Settings → Conversions API → &quot;Generate access token&quot; থেকে কপি করুন।
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Action Button */}
        <div className="flex justify-end gap-3 sticky bottom-4 bg-background/90 backdrop-blur p-4 rounded-xl border border-border shadow-lg z-10">
          <Button
            type="button"
            variant="outline"
            onClick={fetchSettings}
            disabled={saving}
          >
            রিসেট
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="px-6 font-semibold shadow-md"
          >
            {saving ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                সংরক্ষণ হচ্ছে...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                সব সেটিংস সেভ করুন
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
