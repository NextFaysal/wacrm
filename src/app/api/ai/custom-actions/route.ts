import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { supabase, accountId } = await requireRole('agent');

    const { data, error } = await supabase
      .from('ai_custom_actions')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[ai-custom-actions] get error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ customActions: data || [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, accountId } = await requireRole('admin');
    const body = await req.json();

    const {
      name,
      description,
      action_type = 'fixed_reply',
      config = {},
      is_active = true,
    } = body;

    if (!name || !description) {
      return NextResponse.json(
        { error: 'Action name and description are required' },
        { status: 400 }
      );
    }

    // Clean name: snake_case alphanumeric
    const cleanName = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_');

    const { data, error } = await supabase
      .from('ai_custom_actions')
      .insert({
        account_id: accountId,
        name: cleanName,
        description: description.trim(),
        action_type,
        config: config || {},
        is_active: Boolean(is_active),
      })
      .select()
      .single();

    if (error) {
      console.error('[ai-custom-actions] insert error:', error);
      if (error.code === '23505') {
        return NextResponse.json(
          { error: `An action named '${cleanName}' already exists.` },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ customAction: data }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, accountId } = await requireRole('admin');
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Action ID is required' }, { status: 400 });
    }

    if (updates.name) {
      updates.name = updates.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_+/g, '_');
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('ai_custom_actions')
      .update(updates)
      .eq('id', id)
      .eq('account_id', accountId)
      .select()
      .single();

    if (error) {
      console.error('[ai-custom-actions] update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ customAction: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const { supabase, accountId } = await requireRole('admin');
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Action ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('ai_custom_actions')
      .delete()
      .eq('id', id)
      .eq('account_id', accountId);

    if (error) {
      console.error('[ai-custom-actions] delete error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
