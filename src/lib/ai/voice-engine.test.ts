import { describe, it, expect } from 'vitest';
import { prepareVoiceResponse } from './voice-engine';

describe('prepareVoiceResponse', () => {
  it('detects voice note inbound and cleans emojis/markdown for TTS', () => {
    const res = prepareVoiceResponse('🎙️ [ভয়েস নোট]', 'আপনার *অর্ডারটি* কনফার্ম হয়েছে! 🎁');
    expect(res.shouldReplyAudio).toBe(true);
    expect(res.audioPrompt).toBe('আপনার অর্ডারটি কনফার্ম হয়েছে!');
    expect(res.suggestedVoice).toBe('shimmer');
  });

  it('does not force voice reply on plain text messages', () => {
    const res = prepareVoiceResponse('দাম কত?', 'দাম ১৫০০ টাকা');
    expect(res.shouldReplyAudio).toBe(false);
  });
});
