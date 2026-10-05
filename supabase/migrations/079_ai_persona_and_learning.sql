-- 079_ai_persona_and_learning.sql
-- Supports custom per-business AI personality, tone, language, negotiation rules, and auto-learning toggles

create table if not exists ai_persona_config (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  tone text not null default 'friendly',
  response_language text not null default 'mixed',
  custom_greeting text,
  custom_sign_off text,
  max_discount_percent integer not null default 10,
  negotiation_style text not null default 'flexible',
  require_advance_above numeric,
  min_order_amount numeric,
  blocked_phrases text[] not null default '{}',
  custom_rules text,
  auto_learn_from_products boolean not null default true,
  auto_learn_from_orders boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(account_id)
);

alter table ai_persona_config enable row level security;

drop policy if exists "ai_persona_select" on ai_persona_config;
create policy "ai_persona_select" on ai_persona_config for select using (
  is_account_member(account_id)
);

drop policy if exists "ai_persona_all" on ai_persona_config;
create policy "ai_persona_all" on ai_persona_config for all using (
  is_account_member(account_id, 'admin')
);

-- Contacts persistent memory columns
alter table contacts add column if not exists ai_notes text;
alter table contacts add column if not exists preferred_area text;
alter table contacts add column if not exists last_seen_product text;
alter table contacts add column if not exists customer_tags text[] not null default '{}';
