import { aiRequestTimeoutMs } from './defaults';

export interface TranscribeAudioArgs {
  apiKey: string;
  audioBuffer: Buffer;
  provider?: 'gemini' | 'openai' | 'anthropic';
  model?: string;
  mimeType?: string;
  language?: string; // e.g. 'bn' for Bengali
}

/**
 * Transcribe customer voice note using Google Gemini multimodal audio API.
 */
export async function transcribeAudioWithGemini(args: TranscribeAudioArgs): Promise<string | null> {
  const { apiKey, audioBuffer, mimeType = 'audio/ogg', model } = args;

  try {
    const timeoutMs = aiRequestTimeoutMs() * 2;
    // Clean MIME type (remove codecs parameter: e.g. "audio/ogg; codecs=opus" -> "audio/ogg")
    let cleanMime = mimeType.split(';')[0].trim().toLowerCase();
    if (!cleanMime || cleanMime === 'audio/*') cleanMime = 'audio/ogg';

    const base64Data = audioBuffer.toString('base64');
    const selectedModel = model?.includes('flash') ? model : 'gemini-3.5-flash-lite';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: cleanMime,
                  data: base64Data,
                },
              },
              {
                text: 'You are an accurate audio transcription engine for a Bangladeshi online store on WhatsApp. Transcribe this customer voice message accurately word-for-word in the original language (Bengali or Banglish/English). Do NOT add any pleasantries, explanations, translations, or markdown formatting. Output ONLY the raw transcript text. If the audio is silent or unintelligible noise, output empty string.',
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.warn(`[gemini-transcribe] Audio transcription failed (${res.status}): ${err.slice(0, 200)}`);
      return null;
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
    return text;
  } catch (err) {
    console.error('[gemini-transcribe] Error transcribing voice note with Gemini:', err);
    return null;
  }
}

/**
 * Transcribe customer voice note using OpenAI Whisper API.
 */
export async function transcribeAudioWithWhisper(args: TranscribeAudioArgs): Promise<string | null> {
  const { apiKey, audioBuffer, mimeType = 'audio/ogg', language = 'bn' } = args;

  try {
    const timeoutMs = aiRequestTimeoutMs() * 2;
    const formData = new FormData();

    let filename = 'audio.ogg';
    if (mimeType.includes('mp4') || mimeType.includes('m4a')) filename = 'audio.m4a';
    else if (mimeType.includes('mp3') || mimeType.includes('mpeg')) filename = 'audio.mp3';
    else if (mimeType.includes('wav')) filename = 'audio.wav';

    const uint8Array = new Uint8Array(audioBuffer);
    const audioBlob = new Blob([uint8Array], { type: mimeType });
    formData.append('file', audioBlob, filename);
    formData.append('model', 'whisper-1');
    if (language) {
      formData.append('language', language);
    }
    formData.append(
      'prompt',
      'Bangladeshi customer inquiring about product model, price, colors, size, variant, or giving delivery address and phone number in Bengali.'
    );

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.warn(`[whisper] Audio transcription failed (${res.status}): ${err.slice(0, 200)}`);
      return null;
    }

    const data = await res.json();
    return data?.text ? data.text.trim() : null;
  } catch (err) {
    console.error('[whisper] Error transcribing voice note:', err);
    return null;
  }
}

/**
 * Unified provider-aware voice note transcriber.
 * Automatically routes to Gemini multimodal audio API or OpenAI Whisper API.
 */
export async function transcribeAudio(args: TranscribeAudioArgs): Promise<string | null> {
  const isGemini =
    args.provider === 'gemini' ||
    args.apiKey.startsWith('AIza') ||
    args.apiKey.startsWith('AQ');

  if (isGemini) {
    return transcribeAudioWithGemini(args);
  }

  const isOpenAi =
    args.provider === 'openai' ||
    args.apiKey.startsWith('sk-');

  if (isOpenAi) {
    return transcribeAudioWithWhisper(args);
  }

  // Fallback: Try Gemini first, then Whisper
  const geminiResult = await transcribeAudioWithGemini(args);
  if (geminiResult) return geminiResult;

  return transcribeAudioWithWhisper(args);
}
