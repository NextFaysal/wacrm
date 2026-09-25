import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'
import { loadAiConfig } from '@/lib/ai/config'
import { AiError } from '@/lib/ai/types'

/**
 * POST /api/ai/transcribe  (agent+)
 *
 * Body: { message_id }
 * Returns: { text } — the Whisper transcription of the audio message.
 *
 * Uses the account's configured OpenAI API key (BYO). If the account's
 * provider is Anthropic, we still try the `embeddingsApiKey` (which is
 * always an OpenAI key) as a fallback since Whisper is OpenAI-only.
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('agent')

    // Reuse the draft rate limit — transcription is comparable cost-wise.
    const userLimit = checkRateLimit(`ai-transcribe:${userId}`, RATE_LIMITS.aiDraft)
    if (!userLimit.success) return rateLimitResponse(userLimit)
    const accountLimit = checkRateLimit(
      `ai-transcribe-acct:${accountId}`,
      RATE_LIMITS.aiDraftAccount,
    )
    if (!accountLimit.success) return rateLimitResponse(accountLimit)

    const body = await request.json().catch(() => null)
    const messageId =
      body && typeof body.message_id === 'string' ? body.message_id : ''
    if (!messageId) {
      return NextResponse.json(
        { error: 'message_id is required' },
        { status: 400 },
      )
    }

    // Load the message — RLS scopes to the caller's account.
    const { data: message, error: msgErr } = await supabase
      .from('messages')
      .select('id, media_url, content_type')
      .eq('id', messageId)
      .maybeSingle()

    if (msgErr) {
      console.error('[ai/transcribe] message lookup error:', msgErr)
      return NextResponse.json({ error: 'Failed to load message' }, { status: 500 })
    }
    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }
    if (!message.media_url) {
      return NextResponse.json(
        { error: 'Message has no audio attachment' },
        { status: 400 },
      )
    }

    // Get the OpenAI API key — Whisper is OpenAI-only.
    const config = await loadAiConfig(supabase, accountId, { requireActive: false }).catch(
      (err) => {
        console.error('[ai/transcribe] loadAiConfig error:', err)
        throw new AiError('Stored API key could not be decrypted.', {
          code: 'key_decrypt_failed',
          status: 400,
        })
      },
    )

    // Determine the OpenAI key: prefer the chat key if provider is openai,
    // otherwise fall back to the embeddings key (always OpenAI-compatible).
    let openaiKey: string | null = null
    if (config) {
      if (config.provider === 'openai') {
        openaiKey = config.apiKey
      } else if (config.embeddingsApiKey) {
        openaiKey = config.embeddingsApiKey
      }
    }

    if (!openaiKey) {
      return NextResponse.json(
        {
          error:
            'Whisper transcription requires an OpenAI API key. Configure one in Settings → AI Assistant.',
          code: 'openai_key_required',
        },
        { status: 400 },
      )
    }

    // Fetch the audio bytes. The media_url is either:
    //  - An internal proxy path: /api/whatsapp/media/[mediaId]
    //  - A Supabase Storage bucket URL
    // In both cases we fetch server-side so we can pipe to Whisper.
    let mediaUrl = message.media_url as string
    if (mediaUrl.startsWith('/')) {
      // Internal proxy — resolve to absolute so fetch can reach it.
      const origin = request.headers.get('origin') || request.headers.get('host') || ''
      const protocol = origin.startsWith('http') ? '' : 'http://'
      mediaUrl = `${protocol}${origin}${mediaUrl}`
    }

    // Forward cookies for authenticated internal proxy routes.
    const cookieHeader = request.headers.get('cookie') || ''
    const audioRes = await fetch(mediaUrl, {
      headers: {
        Cookie: cookieHeader,
      },
    })

    if (!audioRes.ok) {
      console.error(
        `[ai/transcribe] media fetch failed: ${audioRes.status} ${audioRes.statusText}`,
      )
      return NextResponse.json(
        { error: 'Could not fetch the audio file.' },
        { status: 502 },
      )
    }

    const audioBlob = await audioRes.blob()
    // Whisper accepts common audio formats: ogg, mp3, mp4, m4a, wav, webm
    const contentType = audioRes.headers.get('content-type') || 'audio/ogg'
    const ext = mimeToExt(contentType)

    // Build FormData for OpenAI Whisper
    const formData = new FormData()
    formData.append('file', new Blob([audioBlob], { type: contentType }), `audio.${ext}`)
    formData.append('model', 'whisper-1')

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
      },
      body: formData,
    })

    if (!whisperRes.ok) {
      const errBody = await whisperRes.text().catch(() => '')
      console.error(`[ai/transcribe] Whisper API error ${whisperRes.status}:`, errBody)

      if (whisperRes.status === 401) {
        throw new AiError('OpenAI API key is invalid or expired.', {
          code: 'invalid_key',
          status: 401,
        })
      }
      if (whisperRes.status === 429) {
        throw new AiError('OpenAI rate limit reached. Try again shortly.', {
          code: 'rate_limited',
          status: 429,
        })
      }
      throw new AiError('Whisper transcription failed.', {
        code: 'whisper_error',
        status: whisperRes.status,
      })
    }

    const result = await whisperRes.json()
    return NextResponse.json({ text: result.text || '' })
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

/** Map common audio MIME types to file extensions for Whisper. */
function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/mp4': 'm4a',
    'audio/m4a': 'm4a',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/webm': 'webm',
    'audio/aac': 'aac',
    'audio/flac': 'flac',
  }
  // Strip codec params: "audio/ogg; codecs=opus" → "audio/ogg"
  const base = mime.split(';')[0].trim().toLowerCase()
  return map[base] || 'ogg'
}
