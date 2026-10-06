import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'
import { loadAiConfig } from '@/lib/ai/config'
import { retrieveKnowledge } from '@/lib/ai/knowledge'
import { generateReply } from '@/lib/ai/generate'
import { buildSystemPrompt } from '@/lib/ai/defaults'
import { latestUserMessage } from '@/lib/ai/query'
import { AiError, type ChatMessage } from '@/lib/ai/types'
import { loadBusinessContext } from '@/lib/ai/business-context'

// Keep the tested transcript bounded, mirroring the live context window.
const MAX_TURNS = 20

/**
 * POST /api/ai/playground  (agent+)
 *
 * Test-chat with the account's agent WITHOUT touching WhatsApp. Runs the
 * exact same path the auto-reply bot uses — knowledge-base retrieval +
 * `auto_reply` system prompt + the configured provider — so what you see
 * here is what a real customer would get. Reads the config even when the
 * master switch is off (requireActive:false) so you can try it before
 * going live. Stateless: the client sends the running transcript each turn.
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('agent')

    const limit = checkRateLimit(`ai-playground:${userId}`, RATE_LIMITS.aiDraft)
    if (!limit.success) return rateLimitResponse(limit)

    const body = await request.json().catch(() => null)
    const rawMessages = Array.isArray(body?.messages) ? body.messages : null
    if (!rawMessages) {
      return NextResponse.json({ error: 'messages is required' }, { status: 400 })
    }

    const messages: ChatMessage[] = rawMessages
      .filter(
        (m: unknown): m is ChatMessage =>
          !!m &&
          typeof m === 'object' &&
          ((m as ChatMessage).role === 'user' ||
            (m as ChatMessage).role === 'assistant') &&
          typeof (m as ChatMessage).content === 'string' &&
          (m as ChatMessage).content.trim().length > 0,
      )
      .slice(-MAX_TURNS)

    if (messages.length === 0) {
      return NextResponse.json(
        { error: 'Send a message to test the agent.' },
        { status: 400 },
      )
    }

    const config = await loadAiConfig(supabase, accountId, {
      requireActive: false,
    }).catch((err) => {
      console.error('[ai/playground] loadAiConfig error:', err)
      throw new AiError('Stored API key could not be decrypted.', {
        code: 'key_decrypt_failed',
        status: 400,
      })
    })
    if (!config) {
      return NextResponse.json(
        {
          error: 'No agent configured yet. Add your provider key in Setup.',
          code: 'ai_not_configured',
        },
        { status: 400 },
      )
    }

    const [knowledge, bizCtx, productsRes] = await Promise.all([
      retrieveKnowledge(
        supabase,
        accountId,
        config,
        latestUserMessage(messages),
      ),
      loadBusinessContext(accountId, supabase),
      supabase
        .from('products')
        .select('id, name, price, regular_price, image_url, images, variants, colors, description')
        .eq('account_id', accountId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    const activeProducts = productsRes.data || []
    const catalogText = activeProducts.length > 0
      ? activeProducts.map((p, i) => `${i + 1}. ${p.name} - ৳${p.price}${p.colors?.length ? ` (কালার: ${Array.isArray(p.colors) ? p.colors.join(', ') : p.colors})` : ''}`).join('\n')
      : 'বর্তমানে কোনো প্রোডাক্ট এভেইলেবল নেই।'

    const businessPrompt = config.systemPrompt?.trim()
      ? config.systemPrompt
      : `You are the friendly WhatsApp sales executive for "${bizCtx.storeName}", a premier online store in Bangladesh.
Store Policies:
- Product Niche: ${bizCtx.businessTypeLabel}
- Delivery: Inside Dhaka ${bizCtx.deliveryInsideDhaka} (৳${bizCtx.insideDhakaCharge}), Outside Dhaka ${bizCtx.deliveryOutsideDhaka} (৳${bizCtx.outsideDhakaCharge}).
- Free Delivery: ${bizCtx.freeDeliveryGlobal ? 'Currently free delivery across all orders' : `${bizCtx.freeDeliveryMinQty} or more items get free delivery`}.
- Warranty & Return: ${bizCtx.warrantyPolicy}.
- Cash on Delivery available nationwide with open-box verification before payment.

Available Store Catalog:
${catalogText}

Always respond in warm, natural, polite Bengali (use "জি ভাইয়া/আপু", "অবশ্যই", "ধন্যবাদ"). Keep answers short and WhatsApp-friendly. If customer asks for pictures, confirm that pictures have been sent.`

    const systemPrompt = buildSystemPrompt({
      userPrompt: businessPrompt,
      mode: 'auto_reply',
      knowledge,
    })

    const { text, handoff } = await generateReply({ config, systemPrompt, messages })

    // Simulate sending media images in playground if customer asks for pictures
    const lastMsg = latestUserMessage(messages) || ''
    const isImageReq = /(ছবি|ফটো|পিক|পিকচার|photo|image|pic|picture|chobi|বাস্তব ছবি|আসল ছবি|কালার|color)/i.test(lastMsg)
    const images: Array<{ url: string; caption?: string }> = []

    if (isImageReq && activeProducts.length > 0) {
      const targetProd = activeProducts.find((p) => lastMsg.toLowerCase().includes(p.name.toLowerCase())) || activeProducts[0]
      if (targetProd) {
        if (targetProd.image_url && typeof targetProd.image_url === 'string' && targetProd.image_url.startsWith('http')) {
          images.push({ url: targetProd.image_url, caption: `📸 ${targetProd.name}` })
        }
        const rawVariants = Array.isArray(targetProd.variants) ? targetProd.variants : []
        for (const v of rawVariants as any[]) {
          if (v?.image_url && typeof v.image_url === 'string' && v.image_url.startsWith('http') && !images.some((m) => m.url === v.image_url)) {
            images.push({ url: v.image_url, caption: `🎨 ${targetProd.name} (${v.name || 'কালার'})` })
            if (images.length >= 3) break
          }
        }
        if (images.length < 3 && Array.isArray(targetProd.images)) {
          for (const img of targetProd.images) {
            if (typeof img === 'string' && img.startsWith('http') && !images.some((m) => m.url === img)) {
              images.push({ url: img, caption: `📸 ${targetProd.name}` })
              if (images.length >= 3) break
            }
          }
        }
      }
    }

    return NextResponse.json({ reply: text, handoff, images: images.length > 0 ? images : undefined })
  } catch (err) {
    if (err instanceof AiError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status },
      )
    }
    return toErrorResponse(err)
  }
}
