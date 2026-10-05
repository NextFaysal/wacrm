import { sendTypingIndicator } from '@/lib/whatsapp/meta-api';
import { engineSendText } from '@/lib/flows/meta-send';
import { humanizeMessageText } from './human-personality';

interface SendHumanLikeMessagesArgs {
  accountId: string;
  userId: string;
  conversationId: string;
  contactId: string;
  text: string;
  phoneNumberId?: string;
  accessToken?: string;
  inboundMessageId?: string;
  simulateReadingDelay?: boolean;
}

/**
 * Split text into natural human WhatsApp message bubbles.
 * Real humans on WhatsApp don't send 500-word walls of text.
 * They send 2 or 3 short, punchy bubbles.
 */
export function splitIntoHumanBubbles(rawText: string): string[] {
  const cleaned = humanizeMessageText(rawText);
  if (!cleaned) return [];

  // If text already has clear paragraph breaks (\n\n), use them
  const rawParts = cleaned
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (rawParts.length <= 1) {
    // If it's a single block but long (>220 chars) and contains sentence endings
    if (cleaned.length > 220 && (cleaned.includes('।') || cleaned.includes('?') || cleaned.includes('!'))) {
      const sentences = cleaned.split(/(?<=[।?!])\s+/);
      if (sentences.length >= 2) {
        const mid = Math.ceil(sentences.length / 2);
        return [
          sentences.slice(0, mid).join(' ').trim(),
          sentences.slice(mid).join(' ').trim(),
        ].filter(Boolean);
      }
    }
    return [cleaned];
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
 * Send messages with realistic human typing delays, jitter, reading pause,
 * and WhatsApp typing indicator.
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
    simulateReadingDelay = true,
  } = args;

  const bubbles = splitIntoHumanBubbles(text);
  if (bubbles.length === 0) return;

  // 1. Initial Human Reading Delay (simulating reading the customer's message)
  if (simulateReadingDelay) {
    const readingDelay = Math.floor(1000 + Math.random() * 800); // 1.0s to 1.8s
    await new Promise((resolve) => setTimeout(resolve, readingDelay));
  }

  for (let i = 0; i < bubbles.length; i++) {
    const bubble = bubbles[i];

    // Show typing indicator before sending this bubble
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

    // Realistic typing delay: 25-35ms per character with +/- 20% random human jitter
    const baseSpeed = 28 + (Math.random() * 8 - 4); // 24ms to 32ms per character
    const charDelay = bubble.length * baseSpeed;
    // Clamped between 900ms and 2800ms per bubble
    const delay = Math.min(2800, Math.max(900, Math.floor(charDelay)));
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

    // Natural inter-bubble pause if there is another bubble coming
    if (i < bubbles.length - 1) {
      const interBubblePause = Math.floor(800 + Math.random() * 600); // 0.8s to 1.4s
      await new Promise((resolve) => setTimeout(resolve, interBubblePause));
    }
  }
}
