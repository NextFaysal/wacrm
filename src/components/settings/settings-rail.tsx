'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Search, X, ChevronRight, Filter, ArrowLeft, Layers } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import {
  SECTION_META,
  SETTINGS_CATEGORIES,
  SETTINGS_SECTIONS,
  type SettingsCategory,
  type SettingsSection,
} from './settings-sections';

/**
 * Modern Pillar-based Navigation Rail & Mobile Slide-over Drawer.
 *
 * When on a sub-section:
 * - Highlights the current Pillar with focused modules
 * - Shows an easy "← Overview Hub" return link
 * - Allows 1-click switching to other Pillars
 *
 * Search filter works globally across all 21 settings.
 */
export function SettingsRail({
  active,
  onSelect,
  hints,
  mobileDrawerOpen = false,
  onMobileDrawerClose,
}: {
  active: SettingsSection;
  onSelect: (section: SettingsSection) => void;
  hints?: Partial<Record<SettingsSection, ReactNode>>;
  mobileDrawerOpen?: boolean;
  onMobileDrawerClose?: () => void;
}) {
  const t = useTranslations('Settings');
  const [filterQuery, setFilterQuery] = useState('');
  const [expandedPillars, setExpandedPillars] = useState<Record<string, boolean>>({});

  const query = filterQuery.trim().toLowerCase();

  // Active section metadata & pillar
  const activeMeta = SECTION_META[active];
  const activeCategory =
    activeMeta && activeMeta.category !== 'general' ? activeMeta.category : null;

  // Filter sections by search query
  const filteredSections = useMemo(() => {
    if (!query) return SETTINGS_SECTIONS;
    return SETTINGS_SECTIONS.filter((s) => {
      const meta = SECTION_META[s];
      return (
        meta.label.toLowerCase().includes(query) ||
        (meta.shortLabel && meta.shortLabel.toLowerCase().includes(query)) ||
        meta.description.toLowerCase().includes(query) ||
        meta.keywords.some((k) => k.toLowerCase().includes(query))
      );
    });
  }, [query]);

  const handleItemClick = (s: SettingsSection) => {
    onSelect(s);
    if (onMobileDrawerClose) {
      onMobileDrawerClose();
    }
  };

  const togglePillar = (catId: string) => {
    setExpandedPillars((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  // Reusable Nav Content
  const renderNavList = () => {
    // If user is searching, show flat matching results
    if (query) {
      return (
        <div className="space-y-1">
          <div className="px-2 pb-1 text-[11px] font-semibold text-muted-foreground uppercase">
            Search Matches ({filteredSections.length})
          </div>
          {filteredSections.map((s) => {
            const meta = SECTION_META[s];
            const Icon = meta.icon;
            const isActive = s === active;
            return (
              <button
                key={s}
                type="button"
                onClick={() => handleItemClick(s)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium transition-all duration-150',
                  isActive
                    ? 'bg-primary/10 text-primary font-semibold ring-1 ring-primary/25 shadow-xs'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
              >
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-lg transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : meta.colorClasses.iconBg + ' ' + meta.colorClasses.iconText,
                  )}
                >
                  <Icon className="size-3.5" />
                </span>
                <span className="flex-1 truncate">{meta.label}</span>
              </button>
            );
          })}
          {filteredSections.length === 0 && (
            <div className="p-4 text-center text-xs text-muted-foreground">
              No matching settings found
            </div>
          )}
        </div>
      );
    }

    // Default focused Pillar layout
    return (
      <div className="space-y-4">
        {/* Back to Overview Hub button */}
        <button
          type="button"
          onClick={() => handleItemClick('overview')}
          className={cn(
            'group flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold transition-all duration-150',
            active === 'overview'
              ? 'bg-primary/10 text-primary ring-1 ring-primary/25 shadow-xs'
              : 'border border-border/70 bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <span
            className={cn(
              'flex size-6 items-center justify-center rounded-lg transition-colors',
              active === 'overview'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-muted text-muted-foreground group-hover:bg-primary-soft group-hover:text-primary',
            )}
          >
            <SECTION_META.overview.icon className="size-3.5" />
          </span>
          <span className="flex-1 truncate">Overview Hub</span>
          <ChevronRight className="size-3.5 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
        </button>

        {/* Categories / Pillars */}
        <div className="space-y-3">
          {SETTINGS_CATEGORIES.map((cat) => {
            const catSections = SETTINGS_SECTIONS.filter(
              (s) => s !== 'overview' && SECTION_META[s].category === cat.id,
            );
            const isCurrentPillar = activeCategory === cat.id;
            const isExpanded = expandedPillars[cat.id] ?? (isCurrentPillar || active === 'overview');
            const CategoryIcon = cat.icon;

            return (
              <div
                key={cat.id}
                className={cn(
                  'rounded-xl border transition-all duration-150 overflow-hidden',
                  isCurrentPillar
                    ? 'border-primary/30 bg-primary/2 shadow-xs'
                    : 'border-border/60 bg-card/40',
                )}
              >
                {/* Pillar Header */}
                <button
                  type="button"
                  onClick={() => togglePillar(cat.id)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-muted/40"
                >
                  <span className="flex items-center gap-2 text-xs font-bold text-foreground truncate">
                    <CategoryIcon className={cn('size-3.5 shrink-0', isCurrentPillar ? 'text-primary' : 'text-muted-foreground')} />
                    <span className="truncate">{cat.label}</span>
                  </span>
                  <ChevronRight
                    className={cn(
                      'size-3.5 text-muted-foreground transition-transform duration-150',
                      isExpanded && 'rotate-90',
                    )}
                  />
                </button>

                {/* Pillar Items */}
                {isExpanded && (
                  <div className="space-y-0.5 p-1.5 pt-0 border-t border-border/40">
                    {catSections.map((s) => {
                      const meta = SECTION_META[s];
                      const Icon = meta.icon;
                      const isActive = s === active;
                      const hint = hints?.[s];

                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => handleItemClick(s)}
                          aria-current={isActive ? 'page' : undefined}
                          className={cn(
                            'group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium transition-all duration-150',
                            isActive
                              ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                          )}
                        >
                          <span
                            className={cn(
                              'flex size-5 shrink-0 items-center justify-center rounded-md transition-colors',
                              isActive
                                ? 'bg-primary-foreground/20 text-primary-foreground'
                                : meta.colorClasses.iconBg + ' ' + meta.colorClasses.iconText,
                            )}
                          >
                            <Icon className="size-3" />
                          </span>

                          <span className="flex-1 truncate">{meta.shortLabel || meta.label}</span>

                          {hint != null ? (
                            <span
                              className={cn(
                                'rounded px-1 text-[10px] font-semibold',
                                isActive
                                  ? 'bg-primary-foreground/20 text-primary-foreground'
                                  : 'bg-muted text-muted-foreground',
                              )}
                            >
                              {hint}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* ============================================================== */}
      {/* DESKTOP VERTICAL RAIL (≥1024px)                               */}
      {/* ============================================================== */}
      <nav
        aria-label={t('sectionsNav')}
        className="hidden w-full flex-col lg:sticky lg:top-4 lg:flex lg:w-[260px] xl:w-[276px]"
      >
        {/* Desktop Search Filter */}
        <div className="mb-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Search 21 settings..."
              className={cn(
                'h-9 w-full rounded-xl border border-border bg-card/80 pl-8 pr-8 text-xs text-foreground placeholder:text-muted-foreground/80',
                'transition-all duration-150 focus:border-primary/50 focus:bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none shadow-xs',
              )}
            />
            {filterQuery ? (
              <button
                type="button"
                onClick={() => setFilterQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            ) : null}
          </div>
        </div>

        {renderNavList()}
      </nav>

      {/* ============================================================== */}
      {/* MOBILE DRAWER OVERLAY (<1024px)                               */}
      {/* ============================================================== */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-xs transition-opacity animate-in fade-in-50"
            onClick={onMobileDrawerClose}
            aria-hidden="true"
          />

          {/* Drawer Sheet */}
          <aside
            className={cn(
              'relative z-50 flex h-full w-[85vw] max-w-xs flex-col border-r border-border bg-card shadow-2xl',
              'animate-in slide-in-from-left duration-200',
            )}
          >
            {/* Header */}
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
              <span className="text-sm font-bold text-foreground">
                Settings Navigator
              </span>
              <button
                type="button"
                onClick={onMobileDrawerClose}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
                <span className="sr-only">Close drawer</span>
              </button>
            </div>

            {/* Filter Search */}
            <div className="border-b border-border/60 p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="Filter 21 settings..."
                  className={cn(
                    'h-8.5 w-full rounded-lg border border-border bg-background pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground/80',
                    'focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none',
                  )}
                />
                {filterQuery ? (
                  <button
                    type="button"
                    onClick={() => setFilterQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                ) : null}
              </div>
            </div>

            {/* Scrollable Nav List */}
            <div className="flex-1 overflow-y-auto p-3">
              {renderNavList()}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
