import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/flows/admin-client';

/**
 * POST /api/account/switch
 * Instantly switches the user's active workspace/store.
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('viewer');
    const body = await request.json().catch(() => null);

    const targetAccountId = body?.targetAccountId;
    if (!targetAccountId) {
      return NextResponse.json({ error: 'targetAccountId is required' }, { status: 400 });
    }

    if (targetAccountId === accountId) {
      return NextResponse.json({ success: true, message: 'Already active' });
    }

    const admin = supabaseAdmin();

    // 1. Verify caller owns or belongs to this account
    const { data: targetAccount, error: accErr } = await admin
      .from('accounts')
      .select('id, name, owner_user_id')
      .eq('id', targetAccountId)
      .maybeSingle();

    if (accErr || !targetAccount) {
      return NextResponse.json({ error: 'Target store not found' }, { status: 404 });
    }

    let role = 'member';
    if (targetAccount.owner_user_id === userId) {
      role = 'owner';
    } else {
      // Check account_members
      const { data: membership } = await admin
        .from('account_members')
        .select('role')
        .eq('account_id', targetAccountId)
        .eq('user_id', userId)
        .maybeSingle();

      if (!membership) {
        return NextResponse.json({ error: 'You do not have access to this store' }, { status: 403 });
      }
      role = membership.role || 'member';
    }

    // 2. Update user profile's active account
    const { error: updateErr } = await admin
      .from('profiles')
      .update({
        account_id: targetAccountId,
        account_role: role,
      })
      .eq('user_id', userId);

    if (updateErr) {
      console.error('[account/switch] update error:', updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      switchedTo: {
        id: targetAccount.id,
        name: targetAccount.name,
        role,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
