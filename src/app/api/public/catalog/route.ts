import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/ai/admin-client';

export const dynamic = 'force-dynamic';

function escapeXml(unsafe: string | null | undefined): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * GET /api/public/catalog
 * Meta Commerce / WhatsApp / Facebook Catalog Feed.
 * Supports ?format=xml (default) or ?format=csv or ?format=json
 * and optional ?account_id=<uuid>
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'xml';
    const requestedAccountId = searchParams.get('account_id');
    const admin = supabaseAdmin();

    let query = admin
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (requestedAccountId) {
      query = query.eq('account_id', requestedAccountId);
    }

    const { data: products, error } = await query;
    if (error) {
      return NextResponse.json({ error: 'Failed to fetch catalog' }, { status: 500 });
    }

    // Fetch store business name
    let storeName = 'Online Store';
    if (requestedAccountId) {
      const { data: biz } = await admin
        .from('business_settings')
        .select('store_name')
        .eq('account_id', requestedAccountId)
        .maybeSingle();
      if (biz?.store_name) storeName = biz.store_name;
    }

    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    // 1. CSV Format
    if (format === 'csv') {
      const headers = ['id', 'title', 'description', 'availability', 'condition', 'price', 'link', 'image_link', 'brand', 'inventory', 'fb_product_category'];
      const rows = (products || []).map((p) => {
        const id = p.id;
        const title = `"${(p.name || '').replace(/"/g, '""')}"`;
        const description = `"${(p.description || p.name || '').replace(/"/g, '""')}"`;
        const availability = (p.stock_quantity ?? 0) > 0 ? 'in stock' : 'out of stock';
        const condition = 'new';
        const price = `${p.price || 0} BDT`;
        const link = `"${baseUrl}/p/${p.slug || p.id}"`;
        const imageLink = `"${p.image_url || ''}"`;
        const brand = `"${storeName.replace(/"/g, '""')}"`;
        const inventory = p.stock_quantity ?? 0;
        const category = `"${(p.category || 'General').replace(/"/g, '""')}"`;

        return [id, title, description, availability, condition, price, link, imageLink, brand, inventory, category].join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\n');
      return new Response(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'inline; filename="catalog-feed.csv"',
        },
      });
    }

    // 2. JSON Format
    if (format === 'json') {
      return NextResponse.json({
        store_name: storeName,
        total_items: (products || []).length,
        items: (products || []).map((p) => ({
          id: p.id,
          title: p.name,
          description: p.description || p.name,
          price: p.price,
          regular_price: p.regular_price,
          availability: (p.stock_quantity ?? 0) > 0 ? 'in_stock' : 'out_of_stock',
          stock: p.stock_quantity ?? 0,
          url: `${baseUrl}/p/${p.slug || p.id}`,
          image_url: p.image_url,
          category: p.category || 'General',
          brand: storeName,
        })),
      });
    }

    // 3. XML / RSS Feed (Standard Meta Commerce & Google Shopping Catalog)
    const itemsXml = (products || []).map((p) => {
      const pUrl = `${baseUrl}/p/${p.slug || p.id}`;
      const inStock = (p.stock_quantity ?? 0) > 0;
      return `    <item>
      <g:id>${escapeXml(p.id)}</g:id>
      <g:title>${escapeXml(p.name)}</g:title>
      <g:description>${escapeXml(p.description || p.name)}</g:description>
      <g:link>${escapeXml(pUrl)}</g:link>
      <g:image_link>${escapeXml(p.image_url || '')}</g:image_link>
      <g:brand>${escapeXml(storeName)}</g:brand>
      <g:condition>new</g:condition>
      <g:availability>${inStock ? 'in stock' : 'out of stock'}</g:availability>
      <g:price>${p.price || 0} BDT</g:price>
      ${p.regular_price && p.regular_price > p.price ? `<g:sale_price>${p.price} BDT</g:sale_price>` : ''}
      <g:inventory>${p.stock_quantity ?? 0}</g:inventory>
      <g:product_type>${escapeXml(p.category || 'General')}</g:product_type>
      ${p.sku ? `<g:mpn>${escapeXml(p.sku)}</g:mpn>` : ''}
      ${p.barcode ? `<g:gtin>${escapeXml(p.barcode)}</g:gtin>` : ''}
    </item>`;
    }).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>${escapeXml(storeName)} Catalog Feed</title>
    <link>${escapeXml(baseUrl)}</link>
    <description>Live Product Catalog Data Feed for WhatsApp and Meta Commerce</description>
${itemsXml}
  </channel>
</rss>`;

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 's-maxage=3600, stale-while-revalidate',
      },
    });
  } catch (err) {
    console.error('[catalog-feed] error:', err);
    return new Response('<error>Failed to generate feed</error>', {
      status: 500,
      headers: { 'Content-Type': 'application/xml' },
    });
  }
}
