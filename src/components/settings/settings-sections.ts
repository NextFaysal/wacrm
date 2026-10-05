import {
  Coins,
  CreditCard,
  FileText,
  KeyRound,
  LayoutGrid,
  MessageSquare,
  Palette,
  PlugZap,
  Shield,
  Tags,
  User,
  UsersRound,
  Zap,
  Truck,
  Store,
  Ticket,
  Star,
  Sliders,
  Clock,
  Crown,
  Smartphone,
  PackageCheck,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

/**
 * Settings information architecture for the modern settings page.
 *
 * The URL query param stays `?tab=` (deep-linkable, and it
 * keeps the existing links in sidebar.tsx / header.tsx working).
 */
export const SETTINGS_SECTIONS = [
  'overview',
  'profile',
  'security',
  'appearance',
  'whatsapp',
  'templates',
  'quick-replies',
  'fields',
  'deals',
  'members',
  'store',
  'coupons',
  'loyalty',
  'reviews',
  'ai-actions',
  'followups',
  'payments',
  'sms',
  'delivery',
  'courier',
  'api',
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export const DEFAULT_SECTION: SettingsSection = 'overview';

export type SettingsCategory =
  | 'all'
  | 'channels'
  | 'commerce'
  | 'growth'
  | 'workspace'
  | 'account';

export interface CategoryDefinition {
  id: Exclude<SettingsCategory, 'all'>;
  label: string;
  bnLabel: string;
  description: string;
  icon: LucideIcon;
  badgeTone: string;
}

export const SETTINGS_CATEGORIES: CategoryDefinition[] = [
  {
    id: 'channels',
    label: 'Channels & Messaging',
    bnLabel: 'মেসেজিং চ্যানেল',
    description: 'WhatsApp Cloud API, message templates, quick replies & SMS OTP',
    icon: MessageSquare,
    badgeTone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  {
    id: 'commerce',
    label: 'Store & Logistics',
    bnLabel: 'স্টোর ও লজিস্টিকস',
    description: 'Storefront CMS, courier shipping APIs, delivery zones & payments',
    icon: Store,
    badgeTone: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  },
  {
    id: 'growth',
    label: 'Marketing & Loyalty',
    bnLabel: 'মার্কেটিং ও কুপন',
    description: 'Discounts, coupons, loyalty tiers, reviews & automated follow-ups',
    icon: Sparkles,
    badgeTone: 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400',
  },
  {
    id: 'workspace',
    label: 'CRM & Workspace',
    bnLabel: 'টিম ও সিআরএম',
    description: 'Team members, deal pipelines, custom fields, AI actions & API keys',
    icon: Sliders,
    badgeTone: 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400',
  },
  {
    id: 'account',
    label: 'Account & Security',
    bnLabel: 'অ্যাকাউন্ট ও সিকিউরিটি',
    description: 'Personal profile, security credentials, active sessions & appearance',
    icon: User,
    badgeTone: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
];

/** Rail grouping and section details. */
export interface SectionMeta {
  id: SettingsSection;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  group: 'top' | 'account' | 'workspace';
  category: Exclude<SettingsCategory, 'all'> | 'general';
  description: string;
  keywords: string[];
  colorClasses: {
    iconBg: string;
    iconText: string;
    border: string;
    hoverGlow: string;
  };
}

export const SECTION_META: Record<SettingsSection, SectionMeta> = {
  overview: {
    id: 'overview',
    label: 'Overview',
    shortLabel: 'Overview',
    icon: LayoutGrid,
    group: 'top',
    category: 'general',
    description: 'Workspace control center, summary stats & quick shortcuts',
    keywords: ['overview', 'dashboard', 'summary', 'home', 'settings home'],
    colorClasses: {
      iconBg: 'bg-primary/10',
      iconText: 'text-primary',
      border: 'border-primary/20',
      hoverGlow: 'hover:border-primary/40',
    },
  },
  profile: {
    id: 'profile',
    label: 'Your profile',
    shortLabel: 'Profile',
    icon: User,
    group: 'account',
    category: 'account',
    description: 'Manage personal details, avatar, name and account contact email',
    keywords: ['profile', 'name', 'avatar', 'email', 'account', 'photo', 'user'],
    colorClasses: {
      iconBg: 'bg-sky-500/10',
      iconText: 'text-sky-600 dark:text-sky-400',
      border: 'border-sky-500/20',
      hoverGlow: 'hover:border-sky-500/40',
    },
  },
  security: {
    id: 'security',
    label: 'Login & security',
    shortLabel: 'Security',
    icon: Shield,
    group: 'account',
    category: 'account',
    description: 'Update password, review active sessions and manage authentication',
    keywords: ['security', 'password', 'login', 'sessions', 'auth', 'devices', '2fa'],
    colorClasses: {
      iconBg: 'bg-amber-500/10',
      iconText: 'text-amber-600 dark:text-amber-400',
      border: 'border-amber-500/20',
      hoverGlow: 'hover:border-amber-500/40',
    },
  },
  appearance: {
    id: 'appearance',
    label: 'Appearance',
    shortLabel: 'Appearance',
    icon: Palette,
    group: 'account',
    category: 'account',
    description: 'Toggle light / dark mode and select primary workspace accent theme',
    keywords: ['appearance', 'theme', 'dark mode', 'light mode', 'colors', 'accent', 'ui'],
    colorClasses: {
      iconBg: 'bg-purple-500/10',
      iconText: 'text-purple-600 dark:text-purple-400',
      border: 'border-purple-500/20',
      hoverGlow: 'hover:border-purple-500/40',
    },
  },
  whatsapp: {
    id: 'whatsapp',
    label: 'WhatsApp',
    shortLabel: 'WhatsApp',
    icon: PlugZap,
    group: 'workspace',
    category: 'channels',
    description: 'Meta WhatsApp Cloud API credentials, phone number pairing & status',
    keywords: ['whatsapp', 'meta', 'cloud api', 'waba', 'phone', 'qr', 'chat', 'webhook'],
    colorClasses: {
      iconBg: 'bg-emerald-500/10',
      iconText: 'text-emerald-600 dark:text-emerald-400',
      border: 'border-emerald-500/20',
      hoverGlow: 'hover:border-emerald-500/40',
    },
  },
  templates: {
    id: 'templates',
    label: 'Templates',
    shortLabel: 'Templates',
    icon: FileText,
    group: 'workspace',
    category: 'channels',
    description: 'Pre-approved HSM broadcast message templates & Meta sync',
    keywords: ['templates', 'hsm', 'meta', 'broadcast', 'approval', 'messages'],
    colorClasses: {
      iconBg: 'bg-blue-500/10',
      iconText: 'text-blue-600 dark:text-blue-400',
      border: 'border-blue-500/20',
      hoverGlow: 'hover:border-blue-500/40',
    },
  },
  'quick-replies': {
    id: 'quick-replies',
    label: 'Quick replies',
    shortLabel: 'Quick replies',
    icon: Zap,
    group: 'workspace',
    category: 'channels',
    description: 'Fast canned response snippets and shortcuts for customer chats',
    keywords: ['quick replies', 'canned', 'snippets', 'shortcuts', 'chat responses', 'fast reply'],
    colorClasses: {
      iconBg: 'bg-amber-500/10',
      iconText: 'text-amber-600 dark:text-amber-400',
      border: 'border-amber-500/20',
      hoverGlow: 'hover:border-amber-500/40',
    },
  },
  sms: {
    id: 'sms',
    label: 'SMS Gateways & OTP (এসএমএস)',
    shortLabel: 'SMS Gateways',
    icon: MessageSquare,
    group: 'workspace',
    category: 'channels',
    description: 'Configure MiMSMS, BulkSMS BD & SMS OTP verification gateways',
    keywords: ['sms', 'otp', 'mimsms', 'bulksms', 'gateway', 'phone verification', 'এসএমএস'],
    colorClasses: {
      iconBg: 'bg-teal-500/10',
      iconText: 'text-teal-600 dark:text-teal-400',
      border: 'border-teal-500/20',
      hoverGlow: 'hover:border-teal-500/40',
    },
  },
  store: {
    id: 'store',
    label: 'Store & CMS (অনলাইন স্টোর)',
    shortLabel: 'Store & CMS',
    icon: Store,
    group: 'workspace',
    category: 'commerce',
    description: 'Online storefront branding, banners, catalogue layout & custom CMS',
    keywords: ['store', 'shop', 'cms', 'storefront', 'catalog', 'branding', 'banner', 'অনলাইন স্টোর'],
    colorClasses: {
      iconBg: 'bg-indigo-500/10',
      iconText: 'text-indigo-600 dark:text-indigo-400',
      border: 'border-indigo-500/20',
      hoverGlow: 'hover:border-indigo-500/40',
    },
  },
  delivery: {
    id: 'delivery',
    label: 'Delivery & Shipping (ডেলিভারি)',
    shortLabel: 'Delivery & Shipping',
    icon: Truck,
    group: 'workspace',
    category: 'commerce',
    description: 'Inside/outside Dhaka delivery charges, free shipping thresholds & policies',
    keywords: ['delivery', 'shipping', 'rates', 'zones', 'charges', 'free shipping', 'ডেলিভারি'],
    colorClasses: {
      iconBg: 'bg-cyan-500/10',
      iconText: 'text-cyan-600 dark:text-cyan-400',
      border: 'border-cyan-500/20',
      hoverGlow: 'hover:border-cyan-500/40',
    },
  },
  courier: {
    id: 'courier',
    label: 'Courier API (কুরিয়ার)',
    shortLabel: 'Courier API',
    icon: PackageCheck,
    group: 'workspace',
    category: 'commerce',
    description: 'Automate Steadfast, Pathao & RedX order booking with 1-click dispatch',
    keywords: ['courier', 'steadfast', 'pathao', 'redx', 'parcel', 'tracking', 'কুরিয়ার', 'shipping api'],
    colorClasses: {
      iconBg: 'bg-blue-500/10',
      iconText: 'text-blue-600 dark:text-blue-400',
      border: 'border-blue-500/20',
      hoverGlow: 'hover:border-blue-500/40',
    },
  },
  payments: {
    id: 'payments',
    label: 'Payment Gateways (বিকাশ / নগদ)',
    shortLabel: 'Payment Gateways',
    icon: CreditCard,
    group: 'workspace',
    category: 'commerce',
    description: 'Configure bKash PGW, Nagad & dynamic 1-click checkout payment links',
    keywords: ['payments', 'bkash', 'nagad', 'gateway', 'checkout', 'pay links', 'বিকাশ', 'নগদ', 'pgw'],
    colorClasses: {
      iconBg: 'bg-rose-500/10',
      iconText: 'text-rose-600 dark:text-rose-400',
      border: 'border-rose-500/20',
      hoverGlow: 'hover:border-rose-500/40',
    },
  },
  coupons: {
    id: 'coupons',
    label: 'Coupons & Discounts (কুপন)',
    shortLabel: 'Coupons',
    icon: Ticket,
    group: 'workspace',
    category: 'growth',
    description: 'Create promo voucher codes, percentage discounts & expiry limits',
    keywords: ['coupons', 'discounts', 'promo', 'codes', 'voucher', 'offer', 'কুপন'],
    colorClasses: {
      iconBg: 'bg-pink-500/10',
      iconText: 'text-pink-600 dark:text-pink-400',
      border: 'border-pink-500/20',
      hoverGlow: 'hover:border-pink-500/40',
    },
  },
  loyalty: {
    id: 'loyalty',
    label: 'Loyalty & Rewards (কাস্টমার লয়ালটি)',
    shortLabel: 'Loyalty Rewards',
    icon: Crown,
    group: 'workspace',
    category: 'growth',
    description: 'Reward points, VIP customer tiers & retention incentive programs',
    keywords: ['loyalty', 'rewards', 'vip', 'points', 'tiers', 'cashback', 'কাস্টমার লয়ালটি'],
    colorClasses: {
      iconBg: 'bg-amber-500/10',
      iconText: 'text-amber-600 dark:text-amber-400',
      border: 'border-amber-500/20',
      hoverGlow: 'hover:border-amber-500/40',
    },
  },
  reviews: {
    id: 'reviews',
    label: 'Customer Reviews (রিভিউ)',
    shortLabel: 'Reviews',
    icon: Star,
    group: 'workspace',
    category: 'growth',
    description: 'Collect, moderate and showcase verified customer ratings & testimonials',
    keywords: ['reviews', 'ratings', 'feedback', 'stars', 'social proof', 'testimonials', 'রিভিউ'],
    colorClasses: {
      iconBg: 'bg-yellow-500/10',
      iconText: 'text-yellow-600 dark:text-yellow-400',
      border: 'border-yellow-500/20',
      hoverGlow: 'hover:border-yellow-500/40',
    },
  },
  followups: {
    id: 'followups',
    label: 'Follow-ups & Recovery (ফলোআপ)',
    shortLabel: 'Follow-ups',
    icon: Clock,
    group: 'workspace',
    category: 'growth',
    description: 'Automated abandoned checkout recovery & scheduled re-engagement',
    keywords: ['followups', 'recovery', 'abandoned cart', 'automated reminders', 'cart recovery', 'ফলোআপ'],
    colorClasses: {
      iconBg: 'bg-violet-500/10',
      iconText: 'text-violet-600 dark:text-violet-400',
      border: 'border-violet-500/20',
      hoverGlow: 'hover:border-violet-500/40',
    },
  },
  members: {
    id: 'members',
    label: 'Team members',
    shortLabel: 'Team',
    icon: UsersRound,
    group: 'workspace',
    category: 'workspace',
    description: 'Invite collaborators, assign roles (Owner, Admin, Agent) & manage access',
    keywords: ['members', 'team', 'roles', 'invite', 'staff', 'permissions', 'access'],
    colorClasses: {
      iconBg: 'bg-indigo-500/10',
      iconText: 'text-indigo-600 dark:text-indigo-400',
      border: 'border-indigo-500/20',
      hoverGlow: 'hover:border-indigo-500/40',
    },
  },
  deals: {
    id: 'deals',
    label: 'Deals & currency',
    shortLabel: 'Deals & Currency',
    icon: Coins,
    group: 'workspace',
    category: 'workspace',
    description: 'Set workspace primary billing currency (BDT, USD) & deal pipeline values',
    keywords: ['deals', 'currency', 'bdt', 'usd', 'pipeline', 'sales stages', 'money format'],
    colorClasses: {
      iconBg: 'bg-emerald-500/10',
      iconText: 'text-emerald-600 dark:text-emerald-400',
      border: 'border-emerald-500/20',
      hoverGlow: 'hover:border-emerald-500/40',
    },
  },
  fields: {
    id: 'fields',
    label: 'Fields & tags',
    shortLabel: 'Fields & Tags',
    icon: Tags,
    group: 'workspace',
    category: 'workspace',
    description: 'Configure custom contact attributes & audience segmentation tags',
    keywords: ['fields', 'tags', 'custom fields', 'contact attributes', 'segmentation', 'labels'],
    colorClasses: {
      iconBg: 'bg-purple-500/10',
      iconText: 'text-purple-600 dark:text-purple-400',
      border: 'border-purple-500/20',
      hoverGlow: 'hover:border-purple-500/40',
    },
  },
  'ai-actions': {
    id: 'ai-actions',
    label: 'AI Actions (অ্যাকশন কন্ট্রোল)',
    shortLabel: 'AI Actions',
    icon: Sliders,
    group: 'workspace',
    category: 'workspace',
    description: 'Control automated AI bot behavior, trigger limits & tool execution rights',
    keywords: ['ai actions', 'agent', 'automation', 'llm', 'autonomous', 'bot', 'অ্যাকশন'],
    colorClasses: {
      iconBg: 'bg-fuchsia-500/10',
      iconText: 'text-fuchsia-600 dark:text-fuchsia-400',
      border: 'border-fuchsia-500/20',
      hoverGlow: 'hover:border-fuchsia-500/40',
    },
  },
  api: {
    id: 'api',
    label: 'API keys',
    shortLabel: 'API keys',
    icon: KeyRound,
    group: 'workspace',
    category: 'workspace',
    description: 'Generate secure REST API tokens & integrate third-party webhooks',
    keywords: ['api', 'api keys', 'tokens', 'developer', 'webhooks', 'rest api', 'bearer'],
    colorClasses: {
      iconBg: 'bg-slate-500/10',
      iconText: 'text-slate-600 dark:text-slate-300',
      border: 'border-slate-500/20',
      hoverGlow: 'hover:border-slate-500/40',
    },
  },
};

export const RAIL_GROUPS: { label: string | null; group: SectionMeta['group'] }[] = [
  { label: null, group: 'top' },
  { label: 'Account', group: 'account' },
  { label: 'Workspace', group: 'workspace' },
];

function isSection(value: string | null): value is SettingsSection {
  return !!value && (SETTINGS_SECTIONS as readonly string[]).includes(value);
}

/**
 * Resolve a raw `?tab=` value to a section. Legacy tabs from the old
 * flat layout collapse onto their new home. Anything unknown falls back
 * to the Overview landing.
 */
export function resolveSection(raw: string | null): SettingsSection {
  if (raw === 'tags' || raw === 'custom-fields') return 'fields';
  if (isSection(raw)) return raw;
  return DEFAULT_SECTION;
}
