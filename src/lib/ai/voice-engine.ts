export interface VoiceNoteResponseResult {
  shouldReplyAudio: boolean;
  audioPrompt?: string;
  suggestedVoice: string;
}

/**
 * AI Voice Engine Helper: Determines whether a voice reply is optimal
 * based on customer input and synthesizes speech cues.
 */
export function prepareVoiceResponse(
  inboundText: string,
  replyText: string
): VoiceNoteResponseResult {
  const isCustomerVoice = inboundText.includes('🎙️') || /ভয়েস|voice|অডিও/i.test(inboundText);

  // Clean markdown bold stars & emojis for clean TTS pronunciation
  const cleanSpeechText = replyText
    .replace(/[*_~`]/g, '')
    .replace(/[🎁🔥✨🚚❤️🥰🙏👍]/g, '')
    .trim();

  return {
    shouldReplyAudio: isCustomerVoice,
    audioPrompt: cleanSpeechText,
    suggestedVoice: 'shimmer', // Warm Bengali friendly voice profile
  };
}

export interface SynthesizeSpeechArgs {
  text: string;
  provider?: string;
  apiKey?: string;
  language?: string;
}

/**
 * Synthesize Bengali speech audio buffer from text using OpenAI TTS or Google Translate TTS fallback.
 */
export async function synthesizeSpeech(
  args: SynthesizeSpeechArgs
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const { text, provider, apiKey, language = 'bn' } = args;
  const cleanText = text
    .replace(/[*_~`#]/g, '')
    .replace(/[🎁🔥✨🚚❤️🥰🙏👍📦🏃‍♂️🎉📸]/g, '')
    .replace(/INV-[A-Z0-9-]+/gi, 'ইনভয়েস')
    .trim();

  if (!cleanText) return null;

  // 1. If OpenAI API Key is configured and provider is openai
  if (provider === 'openai' && apiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: cleanText.slice(0, 450),
          voice: 'shimmer',
          response_format: 'opus',
        }),
      });
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        return { buffer: Buffer.from(arrayBuf), mimeType: 'audio/ogg; codecs=opus' };
      }
    } catch (e) {
      console.warn('[voice-engine] OpenAI TTS failed, trying fallback:', e);
    }
  }

  // 2. High-quality free Bengali TTS fallback (Google Translate TTS)
  try {
    const encoded = encodeURIComponent(cleanText.slice(0, 200));
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${language}&client=tw-ob`;
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (res.ok) {
      const arrayBuf = await res.arrayBuffer();
      return { buffer: Buffer.from(arrayBuf), mimeType: 'audio/mpeg' };
    }
  } catch (e) {
    console.warn('[voice-engine] Google Translate TTS failed:', e);
  }

  return null;
}

