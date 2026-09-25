import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/ai/admin-client';

export const dynamic = 'force-dynamic';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(request: Request) {
  try {
    const { accountId } = await requireRole('agent');
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Only image files (JPG, PNG, WebP, GIF) are allowed' },
        { status: 400 }
      );
    }

    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: 'Image size exceeds 10MB limit' },
        { status: 400 }
      );
    }

    const admin = supabaseAdmin();
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const safeName = file.name
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .slice(0, 30);
    const fileName = `${Date.now()}-${safeName}.${ext}`;
    const filePath = `account-${accountId}/products/${fileName}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    // Try 'product-media' bucket, fallback to 'chat-media'
    let uploadRes = await admin.storage
      .from('product-media')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    let bucketName = 'product-media';

    if (uploadRes.error) {
      console.warn('[product-upload] product-media failed, falling back to chat-media:', uploadRes.error);
      uploadRes = await admin.storage
        .from('chat-media')
        .upload(filePath, buffer, {
          contentType: file.type,
          upsert: false,
        });
      bucketName = 'chat-media';
    }

    if (uploadRes.error) {
      console.error('[product-upload] storage error:', uploadRes.error);
      return NextResponse.json(
        { error: `Upload failed: ${uploadRes.error.message}` },
        { status: 500 }
      );
    }

    const { data: urlData } = admin.storage.from(bucketName).getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      path: filePath,
    });
  } catch (err: unknown) {
    console.error('[product-upload] unhandled error:', err);
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
