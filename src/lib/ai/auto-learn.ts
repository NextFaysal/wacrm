import type { SupabaseClient } from '@supabase/supabase-js';
import type { AiConfig } from '@/lib/ai/types';
import type { AiPersonaSettings } from './persona-config';
import { ingestDocument } from './knowledge';

/**
 * Sync active products to AI Knowledge Base documents so the AI understands
 * detailed specs, prices, and stock for RAG retrieval.
 */
export async function syncProductsToKnowledge(
  db: SupabaseClient,
  accountId: string,
  config: Pick<AiConfig, 'embeddingsApiKey'>
): Promise<{ count: number }> {
  const { data: products, error } = await db
    .from('products')
    .select('*')
    .eq('account_id', accountId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error || !products || products.length === 0) {
    return { count: 0 };
  }

  let indexedCount = 0;

  for (const p of products) {
    const title = `[প্রোডাক্ট] ${p.name || 'পণ্য'}`;
    const specsList: string[] = [];
    if (p.spec_1_value) specsList.push(p.spec_1_value);
    if (p.spec_2_value) specsList.push(p.spec_2_value);
    if (p.spec_3_value) specsList.push(p.spec_3_value);
    if (p.spec_4_value) specsList.push(p.spec_4_value);

    const content = [
      `পণ্যের নাম: ${p.name}`,
      p.category ? `ক্যাটাগরি: ${p.category}` : null,
      `মূল্য: ৳${p.price}${p.regular_price ? ` (পূর্বের দাম: ৳${p.regular_price})` : ''}`,
      `স্টক: ${p.stock_quantity > 0 ? `${p.stock_quantity} পিস স্টকে আছে` : 'স্টক শেষ'}`,
      p.colors && p.colors.length > 0 ? `কালার/ভেরিয়েন্ট: ${p.colors.join(', ')}` : null,
      p.description ? `বিবরণ: ${p.description}` : null,
      specsList.length > 0 ? `প্রধান বৈশিষ্ট্য: ${specsList.join(', ')}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const documentId = `auto-prod-${p.id}`;

    // Upsert knowledge document row
    const { data: existingDoc } = await db
      .from('ai_knowledge_documents')
      .select('id')
      .eq('account_id', accountId)
      .eq('title', title)
      .maybeSingle();

    let docId = existingDoc?.id;
    if (!docId) {
      const { data: insertedDoc } = await db
        .from('ai_knowledge_documents')
        .insert({
          account_id: accountId,
          title,
          content,
        })
        .select('id')
        .single();
      docId = insertedDoc?.id;
    } else {
      await db
        .from('ai_knowledge_documents')
        .update({ content, updated_at: new Date().toISOString() })
        .eq('id', docId);
    }

    if (docId) {
      try {
        await ingestDocument(db, accountId, config, docId, content);
        indexedCount++;
      } catch (ingestErr) {
        console.warn(`[syncProductsToKnowledge] Failed to ingest chunk for doc ${docId}:`, ingestErr);
      }
    }
  }

  return { count: indexedCount };
}

/**
 * Sync popular customer queries and confirmed sales insights into FAQ documents.
 */
export async function syncOrderInsightsToKnowledge(
  db: SupabaseClient,
  accountId: string,
  config: Pick<AiConfig, 'embeddingsApiKey'>
): Promise<{ success: boolean }> {
  try {
    const { data: confirmedOrders } = await db
      .from('orders')
      .select('product_name, total_amount, city, status')
      .eq('account_id', accountId)
      .eq('status', 'confirmed')
      .order('created_at', { ascending: false })
      .limit(30);

    if (!confirmedOrders || confirmedOrders.length === 0) {
      return { success: false };
    }

    const popularProducts = confirmedOrders.map((o) => o.product_name).filter(Boolean);
    const content = [
      'সবচেয়ে বেশি বিক্রিত এবং সফল অর্ডারকৃত পণ্যসমূহ:',
      ...popularProducts.slice(0, 10).map((name, i) => `${i + 1}. ${name}`),
      'গ্রাহক ডেলিভারি রিসিভ করার সময় ক্যাশ অন ডেলিভারি (COD) পদ্ধতিতে যাচাই করে নেওয়ার সুযোগ পান।',
    ].join('\n');

    const title = '[অটো-লার্নিং] সফল বিক্রয় ও ডেলিভারি সারাংশ';

    const { data: existingDoc } = await db
      .from('ai_knowledge_documents')
      .select('id')
      .eq('account_id', accountId)
      .eq('title', title)
      .maybeSingle();

    let docId = existingDoc?.id;
    if (!docId) {
      const { data: insertedDoc } = await db
        .from('ai_knowledge_documents')
        .insert({
          account_id: accountId,
          title,
          content,
        })
        .select('id')
        .single();
      docId = insertedDoc?.id;
    } else {
      await db
        .from('ai_knowledge_documents')
        .update({ content, updated_at: new Date().toISOString() })
        .eq('id', docId);
    }

    if (docId) {
      await ingestDocument(db, accountId, config, docId, content);
    }
    return { success: true };
  } catch (err) {
    console.warn('[syncOrderInsightsToKnowledge] Error indexing order insights:', err);
    return { success: false };
  }
}

/**
 * Triggers full automated learning for the business.
 */
export async function triggerAutoLearn(
  db: SupabaseClient,
  accountId: string,
  config: Pick<AiConfig, 'embeddingsApiKey'>,
  persona: AiPersonaSettings
): Promise<{ productCount: number; ordersLearned: boolean }> {
  let productCount = 0;
  let ordersLearned = false;

  if (persona.auto_learn_from_products) {
    const prodRes = await syncProductsToKnowledge(db, accountId, config);
    productCount = prodRes.count;
  }

  if (persona.auto_learn_from_orders) {
    const orderRes = await syncOrderInsightsToKnowledge(db, accountId, config);
    ordersLearned = orderRes.success;
  }

  return { productCount, ordersLearned };
}
