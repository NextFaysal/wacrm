import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/flows/admin-client';

/**
 * GET /api/account/stores
 * Returns all stores / workspaces owned or accessible by the authenticated user.
 */
export async function GET() {
  try {
    const { supabase, accountId, userId } = await requireRole('viewer');
    const admin = supabaseAdmin();

    // 1. Fetch all accounts owned by the user (with fallback if 078 migration is pending)
    let ownedAccounts: any[] = [];
    const { data: accountsWithLogo, error: ownedErr } = await admin
      .from('accounts')
      .select('id, name, default_currency, store_logo_url, brand_color, created_at')
      .eq('owner_user_id', userId)
      .order('created_at', { ascending: true });

    if (ownedErr) {
      const { data: fallbackAccounts } = await admin
        .from('accounts')
        .select('id, name, default_currency, created_at')
        .eq('owner_user_id', userId)
        .order('created_at', { ascending: true });
      ownedAccounts = fallbackAccounts || [];
    } else {
      ownedAccounts = accountsWithLogo || [];
    }

    const storeList = (ownedAccounts || []).map((acc) => ({
      id: acc.id,
      name: acc.name,
      currency: acc.default_currency || 'BDT',
      logoUrl: acc.store_logo_url || null,
      isCurrent: acc.id === accountId,
      role: 'owner',
    }));

    // If current account is not in owned list (e.g. invited member), fetch and add it
    if (!storeList.some((s) => s.id === accountId)) {
      const { data: currentAcc, error: currErr } = await admin
        .from('accounts')
        .select('id, name, default_currency, store_logo_url')
        .eq('id', accountId)
        .maybeSingle();

      const accData = currentAcc || (currErr ? (await admin.from('accounts').select('id, name, default_currency').eq('id', accountId).maybeSingle()).data : null);

      if (accData) {
        storeList.unshift({
          id: accData.id,
          name: accData.name,
          currency: accData.default_currency || 'BDT',
          logoUrl: (accData as any).store_logo_url || null,
          isCurrent: true,
          role: 'member',
        });
      }
    }

    return NextResponse.json({
      success: true,
      currentAccountId: accountId,
      stores: storeList,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * POST /api/account/stores
 * Creates a brand new store/brand workspace and switches the caller to it.
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('viewer');
    const body = await request.json().catch(() => null);

    const storeName = body?.storeName?.trim();
    if (!storeName || storeName.length < 2) {
      return NextResponse.json({ error: 'স্টোরের নাম আবশ্যক (Store name is required)' }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // 1. Create new account
    const { data: newAccount, error: accErr } = await admin
      .from('accounts')
      .insert({
        name: storeName,
        owner_user_id: userId,
        default_currency: 'BDT',
      })
      .select('*')
      .single();

    if (accErr || !newAccount) {
      console.error('[account/stores] create error:', accErr);
      return NextResponse.json({ error: accErr?.message || 'Failed to create new store' }, { status: 500 });
    }

    // 2. Initialize default business settings for the new store
    await admin.from('business_settings').insert({
      account_id: newAccount.id,
      store_name: storeName,
      currency_symbol: '৳',
      currency: 'BDT',
    });

    // 3. Initialize default delivery settings
    await admin.from('delivery_settings').insert({
      account_id: newAccount.id,
      free_delivery_global: false,
      free_delivery_min_qty: 2,
      cod_enabled: true,
    });

    // 4. Switch caller's active profile to this new store
    await admin
      .from('profiles')
      .update({
        account_id: newAccount.id,
        account_role: 'owner',
      })
      .eq('user_id', userId);

    return NextResponse.json({
      success: true,
      store: {
        id: newAccount.id,
        name: newAccount.name,
        currency: 'BDT',
        isCurrent: true,
        role: 'owner',
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
