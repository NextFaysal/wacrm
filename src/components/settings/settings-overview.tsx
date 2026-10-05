'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ChevronRight,
  Loader2,
  Search,
  X,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { THEMES } from '@/lib/themes';
import { CURRENCIES } from '@/lib/currency';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import {
  SECTION_META,
  SETTINGS_CATEGORIES,
  SETTINGS_SECTIONS,
  type SettingsCategory,
  type SettingsSection,
} from './settings-sections';
import { SettingsChip, StatusDot } from './settings-chip';
import { ROLE_META } from './role-meta';

interface OverviewCounts {
  members: number | null;
  pendingInvites: number | null;
  templates: number | null;
  templatesPending: number | null;
  tags: number | null;
  customFields: number | null;
}

interface WhatsAppStatus {
  configured: boolean;
  connected: boolean;
}

export function SettingsOverview({
  onSelect,
}: {
  onSelect: (section: SettingsSection) => void;
}) {
  const { user, profile, accountId, accountRole, defaultCurrency, canManageMembers } =
    useAuth();
  const { mode, theme } = useTheme();
  const t = useTranslations('Settings.overview');
  const tRoles = useTranslations('Settings.roles');
  const tSections = useTranslations('Settings.sections');

  const [counts, setCounts] = useState<OverviewCounts | null>(null);
  const [countsLoading, setCountsLoading] = useState(true);
  const [whatsapp, setWhatsapp] = useState<WhatsAppStatus | null>(null);
  const [whatsappLoading, setWhatsappLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SettingsCategory>('all');
  const [copiedAcctId, setCopiedAcctId] = useState(false);

  useEffect(() => {
    if (!user || !accountId) return;
    let cancelled = false;
    const supabase = createClient();
    const userId = user.id;
    const acctId = accountId;

    // Cheap counts — resolve fast, render immediately.
    (async () => {
      setCountsLoading(true);
      const [membersRes, invitesRes, templatesTotal, templatesPending, tagsRes, fieldsRes] =
        await Promise.allSettled([
          fetch('/api/account/members', { cache: 'no-store' }).then((r) => r.json()),
          canManageMembers
            ? fetch('/api/account/invitations', { cache: 'no-store' }).then((r) =>
                r.json(),
              )
            : Promise.resolve(null),
          supabase
            .from('message_templates')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId),
          supabase
            .from('message_templates')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', 'PENDING'),
          supabase
            .from('tags')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId),
          supabase.from('custom_fields').select('id', { count: 'exact', head: true }),
        ]);

      if (cancelled) return;

      const members =
        membersRes.status === 'fulfilled' && Array.isArray(membersRes.value?.members)
          ? membersRes.value.members.length
          : null;
      const pendingInvites =
        invitesRes.status === 'fulfilled' &&
        invitesRes.value &&
        Array.isArray(invitesRes.value.invitations)
          ? invitesRes.value.invitations.length
          : null;

      setCounts({
        members,
        pendingInvites,
        templates:
          templatesTotal.status === 'fulfilled'
            ? templatesTotal.value.count ?? null
            : null,
        templatesPending:
          templatesPending.status === 'fulfilled'
            ? templatesPending.value.count ?? null
            : null,
        tags: tagsRes.status === 'fulfilled' ? tagsRes.value.count ?? null : null,
        customFields:
          fieldsRes.status === 'fulfilled' ? fieldsRes.value.count ?? null : null,
      });
      setCountsLoading(false);
    })();

    // WhatsApp connection status — independent.
    (async () => {
      setWhatsappLoading(true);
      const [row, health] = await Promise.allSettled([
        supabase
          .from('whatsapp_config')
          .select('phone_number_id')
          .eq('account_id', acctId)
          .maybeSingle(),
        fetch('/api/whatsapp/config', { cache: 'no-store' }).then((r) => r.json()),
      ]);
      if (cancelled) return;
      setWhatsapp({
        configured: row.status === 'fulfilled' && !!row.value.data?.phone_number_id,
        connected: health.status === 'fulfilled' && !!health.value?.connected,
      });
      setWhatsappLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, accountId, canManageMembers]);

  const displayName = profile?.full_name || profile?.email || t('yourAccount');
  const initial = (profile?.full_name || profile?.email || 'U').charAt(0).toUpperCase();
  const roleMeta = accountRole ? ROLE_META[accountRole] : null;
  const RoleIcon = roleMeta?.icon;

  const currencyLabel =
    CURRENCIES.find((c) => c.code === defaultCurrency)?.label ?? defaultCurrency;
  const themeName = THEMES.find((t) => t.id === theme)?.name ?? theme;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  // System Setup Readiness calculation
  const readiness = useMemo(() => {
    let score = 30; // base score for account setup
    if (whatsapp?.connected) score += 30;
    else if (whatsapp?.configured) score += 15;
    if (counts?.templates && counts.templates > 0) score += 15;
    if (counts?.members && counts.members > 1) score += 10;
    if (profile?.avatar_url) score += 5;
    if (defaultCurrency) score += 10;
    return Math.min(100, score);
  }, [whatsapp, counts, profile, defaultCurrency]);

  const copyAccountId = () => {
    if (!accountId) return;
    navigator.clipboard.writeText(accountId);
    setCopiedAcctId(true);
    toast.success('Workspace ID copied to clipboard');
    setTimeout(() => setCopiedAcctId(false), 2000);
  };

  // Subtitle / status badge per section
  const getSectionStatusBadge = (section: SettingsSection): ReactNode => {
    switch (section) {
      case 'whatsapp':
        if (whatsappLoading) {
          return <span className="text-[11px] text-muted-foreground">Checking...</span>;
        }
        if (!whatsapp?.configured) {
          return (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-500">
              <AlertCircle className="size-2.5" /> Setup Needed
            </span>
          );
        }
        if (whatsapp.connected) {
          return (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-500">
              <CheckCircle2 className="size-2.5" /> Connected
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-500">
            <StatusDot tone="muted" /> Reconnect
          </span>
        );

      case 'members':
        if (countsLoading) return null;
        return (
          <span className="rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-500">
            {counts?.members ?? 1} Members
          </span>
        );

      case 'templates':
        if (countsLoading) return null;
        return (
          <span className="rounded-md bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-purple-500">
            {counts?.templates ?? 0} HSMs
          </span>
        );

      case 'deals':
        return (
          <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-500">
            {defaultCurrency} (৳)
          </span>
        );

      case 'fields':
        if (countsLoading) return null;
        return (
          <span className="rounded-md bg-slate-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
            {counts?.tags ?? 0} Tags
          </span>
        );

      case 'appearance':
        return (
          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
            {cap(mode)}
          </span>
        );

      default:
        return null;
    }
  };

  const query = searchQuery.trim().toLowerCase();

  // Search filter across all sections
  const searchResults = useMemo(() => {
    if (!query) return null;
    return SETTINGS_SECTIONS.filter((s) => {
      if (s === 'overview') return false;
      const meta = SECTION_META[s];
      return (
        meta.label.toLowerCase().includes(query) ||
        (meta.shortLabel && meta.shortLabel.toLowerCase().includes(query)) ||
        meta.description.toLowerCase().includes(query) ||
        meta.keywords.some((k) => k.toLowerCase().includes(query))
      );
    });
  }, [query]);

  // Categories to display
  const displayedCategories = useMemo(() => {
    if (selectedCategory === 'all') return SETTINGS_CATEGORIES;
    return SETTINGS_CATEGORIES.filter((c) => c.id === selectedCategory);
  }, [selectedCategory]);

  return (
    <section className="space-y-6 sm:space-y-8 animate-in fade-in-50 duration-200">
      {/* ============================================================== */}
      {/* 1. EXECUTIVE WORKSPACE HERO CONTROL BANNER                     */}
      {/* ============================================================== */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-linear-to-br from-card via-card to-primary/5 p-4 sm:p-6 shadow-sm">
        {/* Glow ambient decoration */}
        <div className="absolute right-0 top-0 -mr-16 -mt-16 size-56 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

        <div className="flex flex-col gap-5 sm:gap-6">
          {/* Top row: Identity & Readiness Score */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Identity */}
            <div className="flex items-center gap-3.5 sm:gap-4.5 min-w-0">
              <div className="relative shrink-0">
                <Avatar size="lg" className="size-14 sm:size-16 ring-2 ring-primary/25 ring-offset-2 ring-offset-background shadow-xs">
                  {profile?.avatar_url ? (
                    <AvatarImage src={profile.avatar_url} alt={displayName} />
                  ) : null}
                  <AvatarFallback className="bg-primary/10 text-lg sm:text-xl font-bold text-primary">
                    {initial}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute bottom-0 right-0 size-3.5 rounded-full border-2 border-background bg-emerald-500 shadow-xs" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-base sm:text-xl font-bold tracking-tight text-foreground">
                    {displayName}
                  </h2>
                  {roleMeta && RoleIcon ? (
                    <SettingsChip variant={roleMeta.variant} className="text-[10px] sm:text-xs">
                      <RoleIcon className="size-2.5 sm:size-3" />
                      <span>{tRoles(accountRole!)}</span>
                    </SettingsChip>
                  ) : null}
                </div>

                {profile?.email ? (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {profile.email}
                  </p>
                ) : null}

                {accountId ? (
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="rounded border border-border/70 bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground truncate max-w-[150px] sm:max-w-none">
                      ID: {accountId.slice(0, 8)}...
                    </span>
                    <button
                      type="button"
                      onClick={copyAccountId}
                      title="Copy Workspace ID"
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      {copiedAcctId ? (
                        <Check className="size-3 text-emerald-500" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            {/* System Readiness Gauge */}
            <div className="flex flex-col gap-1.5 rounded-xl border border-border/70 bg-background/60 p-3 sm:w-60 shrink-0">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-primary" /> Setup Readiness
                </span>
                <span className="font-mono font-bold text-primary">{readiness}%</span>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-linear-to-r from-primary to-emerald-500 transition-all duration-500"
                  style={{ width: `${readiness}%` }}
                />
              </div>
              <div className="text-[10px] text-muted-foreground">
                {readiness >= 90
                  ? 'All core systems active & ready'
                  : 'Complete WhatsApp & Courier setup'}
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5 border-t border-border/60 pt-3.5 sm:pt-4">
            <div className="rounded-xl border border-border/60 bg-background/40 p-2 sm:p-2.5 min-w-0">
              <div className="text-[10px] sm:text-[11px] font-medium text-muted-foreground truncate">
                WhatsApp API
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold truncate">
                {whatsappLoading ? (
                  <Loader2 className="size-3 animate-spin text-muted-foreground" />
                ) : whatsapp?.connected ? (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 truncate">
                    <span className="size-2 shrink-0 rounded-full bg-emerald-500 animate-pulse" /> Connected
                  </span>
                ) : whatsapp?.configured ? (
                  <span className="text-amber-500 flex items-center gap-1.5 truncate">
                    <span className="size-2 shrink-0 rounded-full bg-amber-500" /> Reconnect
                  </span>
                ) : (
                  <span className="text-muted-foreground truncate">Not Configured</span>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-background/40 p-2 sm:p-2.5 min-w-0">
              <div className="text-[10px] sm:text-[11px] font-medium text-muted-foreground truncate">
                Workspace Team
              </div>
              <div className="mt-0.5 text-xs font-semibold text-foreground truncate">
                {countsLoading ? (
                  <Loader2 className="size-3 animate-spin text-muted-foreground" />
                ) : (
                  `${counts?.members ?? 1} Members Active`
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-background/40 p-2 sm:p-2.5 min-w-0">
              <div className="text-[10px] sm:text-[11px] font-medium text-muted-foreground truncate">
                Default Currency
              </div>
              <div className="mt-0.5 text-xs font-semibold text-foreground truncate">
                {defaultCurrency} ({currencyLabel.split(' ')[0]})
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-background/40 p-2 sm:p-2.5 min-w-0">
              <div className="text-[10px] sm:text-[11px] font-medium text-muted-foreground truncate">
                Appearance
              </div>
              <div className="mt-0.5 text-xs font-semibold text-foreground truncate">
                {cap(mode)} · {themeName}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. OMNI-SEARCH INPUT                                           */}
      {/* ============================================================== */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search all 21 settings (e.g. bKash, Steadfast, Courier, SMS, AI, Coupons, Roles)..."
          className={cn(
            'h-11 w-full rounded-xl border border-border bg-card pl-10 pr-10 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/75 shadow-xs',
            'transition-all duration-150 focus:border-primary/60 focus:ring-2 focus:ring-primary/15 focus:outline-none',
          )}
        />
        {searchQuery ? (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      {/* ============================================================== */}
      {/* 3. CATEGORY PILL SELECTOR (THE SWITCHER)                       */}
      {/* ============================================================== */}
      {!query && (
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={cn(
              'shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all flex items-center gap-1.5',
              selectedCategory === 'all'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'border border-border/80 bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Sparkles className="size-3.5" />
            <span>All Hubs (21)</span>
          </button>

          {SETTINGS_CATEGORIES.map((cat) => {
            const count = SETTINGS_SECTIONS.filter(
              (s) => s !== 'overview' && SECTION_META[s].category === cat.id,
            ).length;
            const isSelected = selectedCategory === cat.id;
            const CategoryIcon = cat.icon;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  'shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all flex items-center gap-2',
                  isSelected
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'border border-border/80 bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <CategoryIcon className="size-3.5 shrink-0" />
                <span>{cat.label}</span>
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                    isSelected
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. SEARCH RESULTS VIEW (INSTANT FILTER)                        */}
      {/* ============================================================== */}
      {searchResults !== null ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs sm:text-sm font-semibold text-foreground">
              Search Results ({searchResults.length})
            </h3>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-xs text-primary hover:underline"
            >
              Clear search
            </button>
          </div>

          {searchResults.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center bg-card">
              <Search className="mx-auto size-7 text-muted-foreground/60" />
              <h4 className="mt-2 text-sm font-semibold text-foreground">No matching settings</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Try searching keywords like WhatsApp, Courier, bKash, SMS, Team, or Theme
              </p>
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {searchResults.map((section) => {
                const meta = SECTION_META[section];
                const Icon = meta.icon;
                return (
                  <button
                    key={section}
                    type="button"
                    onClick={() => onSelect(section)}
                    className={cn(
                      'group flex items-start gap-3.5 rounded-2xl border border-border bg-card p-4 text-left transition-all duration-150',
                      'hover:border-primary/40 hover:bg-card-2 hover:shadow-xs active:scale-[0.99]',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-10 shrink-0 items-center justify-center rounded-xl border transition-colors',
                        meta.colorClasses.iconBg,
                        meta.colorClasses.iconText,
                        meta.colorClasses.border,
                      )}
                    >
                      <Icon className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
                        {meta.label}
                      </span>
                      <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground leading-relaxed">
                        {meta.description}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary mt-1" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ============================================================== */
        /* 5. BENTO PILLAR SHOWCASE HUBS                                  */
        /* ============================================================== */
        <div className="space-y-6 sm:space-y-8">
          {displayedCategories.map((cat) => {
            const catSections = SETTINGS_SECTIONS.filter(
              (s) => s !== 'overview' && SECTION_META[s].category === cat.id,
            );
            if (catSections.length === 0) return null;

            const CategoryIcon = cat.icon;

            return (
              <div
                key={cat.id}
                className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs"
              >
                {/* Pillar Header Card */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 bg-muted/20 px-4 py-3.5 sm:px-6">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'flex size-8 items-center justify-center rounded-lg border text-sm',
                        cat.badgeTone,
                      )}
                    >
                      <CategoryIcon className="size-4" />
                    </span>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold tracking-tight text-foreground">
                        {cat.label}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {cat.description}
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] font-semibold text-muted-foreground self-start sm:self-auto bg-muted px-2 py-0.5 rounded-full">
                    {catSections.length} modules
                  </span>
                </div>

                {/* Pillar Sub-modules Grid */}
                <div className="grid gap-3 p-4 sm:p-5 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
                  {catSections.map((section) => {
                    const meta = SECTION_META[section];
                    const Icon = meta.icon;
                    const statusBadge = getSectionStatusBadge(section);

                    return (
                      <button
                        key={section}
                        type="button"
                        onClick={() => onSelect(section)}
                        className={cn(
                          'group flex flex-col justify-between rounded-xl border border-border/70 bg-background/60 p-3.5 text-left transition-all duration-150',
                          'hover:border-primary/40 hover:bg-card-2 hover:shadow-xs active:scale-[0.99]',
                        )}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2.5">
                            <span
                              className={cn(
                                'flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors',
                                meta.colorClasses.iconBg,
                                meta.colorClasses.iconText,
                                meta.colorClasses.border,
                              )}
                            >
                              <Icon className="size-4" />
                            </span>

                            {statusBadge}
                          </div>

                          <span className="block text-xs sm:text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                            {meta.label}
                          </span>

                          <span className="mt-1 line-clamp-2 block text-[11px] text-muted-foreground leading-relaxed">
                            {meta.description}
                          </span>
                        </div>

                        <div className="mt-3 flex items-center justify-between text-[11px] font-medium text-muted-foreground/75 group-hover:text-primary pt-2 border-t border-border/40">
                          <span>Configure</span>
                          <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
