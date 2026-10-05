import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/ai/admin-client';
import { BUSINESS_TYPE_PRESETS, type BusinessType } from '@/types/business';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { accountId } = await requireRole('viewer');
    const admin = supabaseAdmin();

    let { data, error } = await admin
      .from('business_settings')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle();

    if (error && error.code !== 'PGRST205') {
      console.error('[business-settings] get error:', error);
    }

    if (!data) {
      // Auto initialize default settings for this account
      const preset = BUSINESS_TYPE_PRESETS.general;
      const defaultSlug = `store-${accountId.substring(0, 8)}`;
      const { data: inserted, error: insertError } = await admin
        .from('business_settings')
        .insert({
          account_id: accountId,
          store_name: preset.defaultStoreName,
          business_type: 'general',
          tagline: preset.defaultTagline,
          store_slug: defaultSlug,
          spec_label_1: preset.defaultSpecs.spec_label_1,
          spec_label_2: preset.defaultSpecs.spec_label_2,
          spec_label_3: preset.defaultSpecs.spec_label_3,
          spec_label_4: preset.defaultSpecs.spec_label_4,
        })
        .select()
        .single();

      if (insertError) {
        if (insertError.code !== 'PGRST205') {
          console.warn('[business-settings] init insert failed, returning in-memory fallback:', insertError);
        }
        return NextResponse.json({
          settings: {
            account_id: accountId,
            store_name: preset.defaultStoreName,
            business_type: 'general',
            tagline: preset.defaultTagline,
            store_slug: defaultSlug,
            spec_label_1: preset.defaultSpecs.spec_label_1,
            spec_label_2: preset.defaultSpecs.spec_label_2,
            spec_label_3: preset.defaultSpecs.spec_label_3,
            spec_label_4: preset.defaultSpecs.spec_label_4,
            feature_1_title: 'ক্যাশ অন ডেলিভারি',
            feature_1_subtitle: 'পার্সেল দেখে মূল্য পরিশোধের সুযোগ',
            feature_2_title: 'সুপারফাস্ট ডেলিভারি',
            feature_2_subtitle: 'সারাদেশে দ্রুত হোম ডেলিভারি',
            feature_3_title: '১০০% অরিজিনাল',
            feature_3_subtitle: 'নিখুঁত কোয়ালিটি গ্যারান্টি',
            announcement_text: '🔥 সীমিত সময়ের স্পেশাল অফার! দ্রুত অর্ডার কনফার্ম করুন!',
            announcement_enabled: true,
            currency_symbol: '৳',
            primary_color: '#f59e0b',
          },
        });
      }
      data = inserted;
    }

    return NextResponse.json({ success: true, settings: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const { accountId } = await requireRole('agent');
    const admin = supabaseAdmin();
    const body = await request.json().catch(() => null);

    if (!body) {
      return NextResponse.json({ error: 'Settings payload required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      account_id: accountId,
      updated_at: new Date().toISOString(),
    };

    if (body.store_name !== undefined) updates.store_name = body.store_name.trim();
    if (body.business_type !== undefined) {
      updates.business_type = body.business_type as BusinessType;
    }
    if (body.tagline !== undefined) updates.tagline = body.tagline?.trim() || null;
    if (body.hero_title !== undefined) updates.hero_title = body.hero_title?.trim() || null;
    if (body.hero_subtitle !== undefined) updates.hero_subtitle = body.hero_subtitle?.trim() || null;
    if (body.logo_url !== undefined) updates.logo_url = body.logo_url?.trim() || null;
    if (body.banner_url !== undefined) updates.banner_url = body.banner_url?.trim() || null;
    if (body.store_slug !== undefined) {
      const cleanSlug = body.store_slug
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '')
        .trim();
      updates.store_slug = cleanSlug || null;
    }
    if (body.support_phone !== undefined) updates.support_phone = body.support_phone?.trim() || null;
    if (body.support_email !== undefined) updates.support_email = body.support_email?.trim() || null;
    if (body.whatsapp_number !== undefined) updates.whatsapp_number = body.whatsapp_number?.trim() || null;
    if (body.address !== undefined) updates.address = body.address?.trim() || null;
    if (body.currency_symbol !== undefined) updates.currency_symbol = body.currency_symbol?.trim() || '৳';
    if (body.primary_color !== undefined) updates.primary_color = body.primary_color?.trim() || '#f59e0b';

    // Specs
    if (body.spec_label_1 !== undefined) updates.spec_label_1 = body.spec_label_1?.trim() || 'স্পেসিফিকেশন ১';
    if (body.spec_label_2 !== undefined) updates.spec_label_2 = body.spec_label_2?.trim() || 'স্পেসিফিকেশন ২';
    if (body.spec_label_3 !== undefined) updates.spec_label_3 = body.spec_label_3?.trim() || 'স্পেসিফিকেশন ৩';
    if (body.spec_label_4 !== undefined) updates.spec_label_4 = body.spec_label_4?.trim() || 'স্পেসিফিকেশন ৪';

    // Features
    if (body.feature_1_title !== undefined) updates.feature_1_title = body.feature_1_title?.trim() || '';
    if (body.feature_1_subtitle !== undefined) updates.feature_1_subtitle = body.feature_1_subtitle?.trim() || '';
    if (body.feature_2_title !== undefined) updates.feature_2_title = body.feature_2_title?.trim() || '';
    if (body.feature_2_subtitle !== undefined) updates.feature_2_subtitle = body.feature_2_subtitle?.trim() || '';
    if (body.feature_3_title !== undefined) updates.feature_3_title = body.feature_3_title?.trim() || '';
    if (body.feature_3_subtitle !== undefined) updates.feature_3_subtitle = body.feature_3_subtitle?.trim() || '';

    // Announcement
    if (body.announcement_text !== undefined) updates.announcement_text = body.announcement_text?.trim() || null;
    if (body.announcement_enabled !== undefined) updates.announcement_enabled = Boolean(body.announcement_enabled);

    // Meta Conversions API (CAPI)
    if (body.meta_pixel_id !== undefined) updates.meta_pixel_id = body.meta_pixel_id?.trim() || null;
    if (body.meta_capi_access_token !== undefined) updates.meta_capi_access_token = body.meta_capi_access_token?.trim() || null;
    if (body.meta_capi_test_code !== undefined) updates.meta_capi_test_code = body.meta_capi_test_code?.trim() || null;

    const { data: updated, error } = await admin
      .from('business_settings')
      .upsert(updates, { onConflict: 'account_id' })
      .select()
      .single();

    if (error) {
      console.error('[business-settings] upsert error:', error);
      if (error.code === '23505' && error.message?.includes('store_slug')) {
        return NextResponse.json(
          { error: 'এই স্টোর লিংক (slug) টি ইতোমধ্যে অন্য কেউ ব্যবহার করছে। অনুগ্রহ করে অন্য নাম দিন।' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: error.message || 'Failed to update store settings' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, settings: updated });
  } catch (err) {
    return toErrorResponse(err);
  }
}
