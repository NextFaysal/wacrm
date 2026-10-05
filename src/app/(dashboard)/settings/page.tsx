'use client';

import { Suspense, useMemo, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ChevronRight, Sliders } from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { Button } from '@/components/ui/button';
import { SettingsRail } from '@/components/settings/settings-rail';
import { SettingsOverview } from '@/components/settings/settings-overview';
import { ProfileForm } from '@/components/settings/profile-form';
import { SecurityPanel } from '@/components/settings/security-panel';
import { AppearancePanel } from '@/components/settings/appearance-panel';
import { WhatsAppConfig } from '@/components/settings/whatsapp-config';
import { TemplateManager } from '@/components/settings/template-manager';
import { QuickRepliesManager } from '@/components/settings/quick-replies-manager';
import { FieldsAndTagsPanel } from '@/components/settings/fields-and-tags-panel';
import { DealsSettings } from '@/components/settings/deals-settings';
import { MembersTab } from '@/components/settings/members-tab';
import { ApiKeysSettings } from '@/components/settings/api-keys-settings';
import { CourierSettings } from '@/components/settings/courier-settings';
import { DeliverySettings } from '@/components/settings/delivery-settings';
import { StoreSettings } from '@/components/settings/store-settings';
import { CouponManager } from '@/components/settings/coupon-manager';
import { ReviewManager } from '@/components/settings/review-manager';
import { LoyaltyRewardsManager } from '@/components/settings/loyalty-rewards-manager';
import { AiActionsManager } from '@/components/settings/ai-actions-manager';
import { AutomatedFollowupManager } from '@/components/settings/automated-followup-manager';
import { PaymentGatewaysManager } from '@/components/settings/payment-gateways-manager';
import { SmsGatewaysManager } from '@/components/settings/sms-gateways-manager';
import {
  resolveSection,
  SECTION_META,
  SETTINGS_CATEGORIES,
  type SettingsSection,
} from '@/components/settings/settings-sections';

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsPageInner />
    </Suspense>
  );
}

function SettingsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { defaultCurrency } = useAuth();
  const { mode } = useTheme();
  const t = useTranslations('Settings');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // The URL (`?tab=`) is the single source of truth for the active section
  const section = resolveSection(searchParams.get('tab'));

  const go = (next: SettingsSection) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', next);
    router.replace(`/settings?${params.toString()}`, { scroll: false });
  };

  const hints: Partial<Record<SettingsSection, ReactNode>> = useMemo(
    () => ({
      appearance: mode.charAt(0).toUpperCase() + mode.slice(1),
      deals: defaultCurrency,
    }),
    [mode, defaultCurrency],
  );

  const meta = SECTION_META[section];
  const category =
    meta.category !== 'general'
      ? SETTINGS_CATEGORIES.find((c) => c.id === meta.category)
      : null;

  const panel: Record<SettingsSection, ReactNode> = {
    overview: <SettingsOverview onSelect={go} />,
    profile: <ProfileForm />,
    security: <SecurityPanel />,
    appearance: <AppearancePanel />,
    whatsapp: <WhatsAppConfig />,
    templates: <TemplateManager />,
    'quick-replies': <QuickRepliesManager />,
    fields: <FieldsAndTagsPanel />,
    deals: <DealsSettings />,
    members: <MembersTab />,
    store: <StoreSettings />,
    coupons: <CouponManager />,
    loyalty: <LoyaltyRewardsManager />,
    reviews: <ReviewManager />,
    'ai-actions': <AiActionsManager />,
    followups: <AutomatedFollowupManager />,
    payments: <PaymentGatewaysManager />,
    sms: <SmsGatewaysManager />,
    delivery: <DeliverySettings />,
    courier: <CourierSettings />,
    api: <ApiKeysSettings />,
  };

  return (
    <div className="mx-auto max-w-7xl pb-10">
      {/* ============================================================== */}
      {/* OVERVIEW ROOT HEADER                                           */}
      {/* ============================================================== */}
      {section === 'overview' && (
        <header className="border-b border-border/70 pb-4 mb-5 sm:mb-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  {t('pageTitle')}
                </h1>
                <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  21 Modules
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                {t('pageDesc')}
              </p>
            </div>
          </div>
        </header>
      )}

      {/* ============================================================== */}
      {/* SUB-SECTION HEADER & BREADCRUMBS                               */}
      {/* ============================================================== */}
      {section !== 'overview' && (
        <div className="mb-4 sm:mb-6">
          {/* Desktop Breadcrumbs (≥1024px) */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground pb-3 border-b border-border/60">
            <button
              type="button"
              onClick={() => go('overview')}
              className="hover:text-primary transition-colors font-medium hover:underline"
            >
              Settings Hub
            </button>
            <ChevronRight className="size-3 text-muted-foreground/50" />
            {category ? (
              <>
                <span className="font-medium text-muted-foreground/80">
                  {category.label}
                </span>
                <ChevronRight className="size-3 text-muted-foreground/50" />
              </>
            ) : null}
            <span className="font-semibold text-foreground truncate">
              {meta.label}
            </span>
          </div>

          {/* Mobile Master-Detail Navigation Bar (<1024px) */}
          <div className="flex lg:hidden items-center justify-between gap-2 rounded-xl border border-border bg-card p-2 sm:p-2.5 shadow-xs">
            {/* Back to Overview */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => go('overview')}
              className="h-8 gap-1.5 px-2.5 text-xs font-semibold text-foreground hover:bg-muted"
            >
              <ArrowLeft className="size-3.5" />
              <span>Overview</span>
            </Button>

            {/* Quick Switcher Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMobileDrawerOpen(true)}
              className="h-8 gap-1.5 px-2.5 text-xs font-semibold border-border/80 hover:bg-muted"
            >
              <meta.icon className="size-3.5 text-primary" />
              <span className="truncate max-w-[120px] sm:max-w-[180px]">
                {meta.shortLabel || meta.label}
              </span>
              <Sliders className="size-3 text-muted-foreground ml-0.5" />
            </Button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MAIN TWO-COLUMN RESPONSIVE LAYOUT                              */}
      {/* ============================================================== */}
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[276px_minmax(0,1fr)] lg:gap-8 lg:items-start">
        {/* SettingsRail handles Desktop sticky sidebar & Mobile slide-over drawer */}
        <SettingsRail
          active={section}
          onSelect={go}
          hints={hints}
          mobileDrawerOpen={mobileDrawerOpen}
          onMobileDrawerClose={() => setMobileDrawerOpen(false)}
        />
        <main className="min-w-0 flex-1">{panel[section]}</main>
      </div>
    </div>
  );
}
