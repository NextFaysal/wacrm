-- ============================================================
-- FIX_PAYMENT_GATEWAYS.sql
-- Direct SQL script to fix Payment Gateways and Payment Links
-- Execute this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ============================================================

-- 1. Payment Gateways Table (bKash, Nagad, SSLCommerz, etc.)
CREATE TABLE IF NOT EXISTS public.payment_gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  gateway TEXT NOT NULL CHECK (gateway IN ('bkash', 'nagad', 'sslcommerz', 'aamarpay', 'manual', 'rocket', 'upay')),
  is_enabled BOOLEAN DEFAULT false,
  is_sandbox BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}'::jsonb,
  display_name TEXT,
  instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_account_gateway UNIQUE(account_id, gateway)
);

CREATE INDEX IF NOT EXISTS idx_payment_gateways_account ON public.payment_gateways(account_id);

ALTER TABLE public.payment_gateways ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can manage payment gateways" ON public.payment_gateways;
CREATE POLICY "Account members can manage payment gateways" ON public.payment_gateways
  FOR ALL USING (is_account_member(account_id));

-- 2. Payment Links & Invoices Table (Dynamic 1-Click Payment Links)
CREATE TABLE IF NOT EXISTS public.payment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  payment_token TEXT NOT NULL UNIQUE,
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT DEFAULT 'BDT',
  purpose TEXT DEFAULT 'advance_payment' CHECK (purpose IN ('advance_payment', 'full_payment', 'custom')),
  customer_name TEXT,
  customer_phone TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'expired')),
  payment_method TEXT,
  trx_id TEXT,
  gateway_payment_id TEXT,
  gateway_response JSONB,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '72 hours'),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_links_account ON public.payment_links(account_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_token ON public.payment_links(payment_token);
CREATE INDEX IF NOT EXISTS idx_payment_links_order ON public.payment_links(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_phone ON public.payment_links(customer_phone);

ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can manage payment links" ON public.payment_links;
CREATE POLICY "Account members can manage payment links" ON public.payment_links
  FOR ALL USING (is_account_member(account_id));

DROP POLICY IF EXISTS "Public can view payment link by token" ON public.payment_links;
CREATE POLICY "Public can view payment link by token" ON public.payment_links
  FOR SELECT USING (true);

-- 3. Add advance_trx_id and payment_link_id to orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'advance_trx_id'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN advance_trx_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'payment_link_id'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN payment_link_id UUID REFERENCES public.payment_links(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Reload PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';
