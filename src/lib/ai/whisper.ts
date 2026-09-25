import { aiRequestTimeoutMs } from './defaults';

interface TranscribeAudioArgs {
  apiKey: string;
  audioBuffer: Buffer;
  mimeType?: string;
  language?: string; // e.g. 'bn' for Bengali
}

export async function transcribeAudioWithWhisper(args: TranscribeAudioArgs): Promise<string | null> {
  const { apiKey, audioBuffer, mimeType = 'audio/ogg', language = 'bn' } = args;

  try {
    const timeoutMs = aiRequestTimeoutMs() * 2; // Audio transcription might take a bit longer
    const formData = new FormData();

    // Map MIME type to appropriate filename extension
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
    formData.append('prompt', 'Bangladeshi customer inquiring about watch model, price, colors, or giving delivery address and phone number in Bengali.');

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
