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
