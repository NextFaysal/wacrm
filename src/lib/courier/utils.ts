/**
 * Normalizes phone numbers to 11 digits starting with 01 for Bangladeshi couriers.
 */
export function formatBDPhone(rawPhone: string): string {
  let cleaned = (rawPhone || '').replace(/\D/g, '');
  if (cleaned.startsWith('8801')) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.startsWith('880')) {
    cleaned = '0' + cleaned.slice(3);
  }
  return cleaned;
}

/**
 * Strips disallowed characters { } ; < > $ and truncates string.
 */
export function sanitizeSteadfastText(text: string, maxLength: number): string {
  return (text || '')
    .replace(/[{}\;<>\\$]/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/**
 * Returns customer tracking URL for each courier provider.
 */
export function getTrackingUrl(provider: string, trackingCode: string): string {
  switch (provider) {
    case 'steadfast':
      return `https://steadfast.com.bd/t/${trackingCode}`;
    case 'pathao':
      return `https://pathao.com/courier-tracking/?consignment_id=${trackingCode}`;
    case 'redx':
      return `https://redx.com.bd/track-order?trackingId=${trackingCode}`;
    case 'paperfly':
      return `https://paperfly.com.bd/tracking.php?orderId=${trackingCode}`;
    default:
      return '';
  }
}
