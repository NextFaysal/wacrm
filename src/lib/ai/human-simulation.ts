import { sendTypingIndicator } from '@/lib/whatsapp/meta-api';
import { engineSendText } from '@/lib/flows/meta-send';

interface SendHumanLikeMessagesArgs {
  accountId: string;
  userId: string;
  conversationId: string;
  contactId: string;
  text: string;
  phoneNumberId?: string;
  accessToken?: string;
  inboundMessageId?: string;
}

/**
 * Split text into natural human WhatsApp message bubbles.
 * Real humans on WhatsApp don't send 500-word walls of text.
 * They send 2 or 3 short, punchy bubbles.
 */
export function splitIntoHumanBubbles(rawText: string): string[] {
  const text = rawText.trim();
  if (!text) return [];

  // If text already has clear paragraph breaks (\n\n), use them
  const rawParts = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (rawParts.length <= 1) {
    // If it's a single block but long (>250 chars) and contains sentence endings
    if (text.length > 250 && (text.includes('।') || text.includes('?') || text.includes('!'))) {
      const sentences = text.split(/(?<=[।?!])\s+/);
      if (sentences.length >= 2) {
        const mid = Math.ceil(sentences.length / 2);
        return [
          sentences.slice(0, mid).join(' ').trim(),
          sentences.slice(mid).join(' ').trim(),
        ].filter(Boolean);
      }
    }
    return [text];
  }

  // Cap at 3 bubbles max so we don't spam the customer's phone with notifications
  if (rawParts.length > 3) {
    return [
      rawParts[0],
      rawParts.slice(1, rawParts.length - 1).join('\n\n'),
      rawParts[rawParts.length - 1],
    ];
  }

  return rawParts;
}

/**
 * Send messages with realistic human typing delays and WhatsApp typing indicator.
 */
export async function sendHumanLikeMessages(args: SendHumanLikeMessagesArgs): Promise<void> {
  const {
    accountId,
    userId,
    conversationId,
    contactId,
    text,
    phoneNumberId,
    accessToken,
    inboundMessageId,
  } = args;

  const bubbles = splitIntoHumanBubbles(text);
  if (bubbles.length === 0) return;

  for (let i = 0; i < bubbles.length; i++) {
    const bubble = bubbles[i];

    // Show typing indicator before sending
    if (phoneNumberId && accessToken && inboundMessageId) {
      try {
        await sendTypingIndicator({
          phoneNumberId,
          accessToken,
          messageId: inboundMessageId,
        });
      } catch (err) {
        // Typing indicator is best-effort
      }
    }

    // Realistic typing delay: 20-30ms per character, clamped between 800ms and 2500ms
    const delay = Math.min(2500, Math.max(800, bubble.length * 20));
    await new Promise((resolve) => setTimeout(resolve, delay));

    // Send the bubble
    await engineSendText({
      accountId,
      userId,
      conversationId,
      contactId,
      text: bubble,
      aiGenerated: true,
    });
  }
}
