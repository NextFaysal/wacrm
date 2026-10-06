import type { ConversationMemory } from '@/types/commerce';
import { validateBDPhone } from './risk-engine';

export interface ExtractedInfo {
  name?: string;
  phone?: string;
  fullAddress?: string;
  thana?: string;
  district?: string;
  variant?: string;
  quantity?: number;
  detectedIntent?: string;
  trxId?: string;
  paymentMethod?: 'bKash' | 'Nagad' | 'Rocket' | 'Upay';
  paymentAmount?: number;
  invoiceNo?: string;
}

const DISTRICT_NAMES = [
  'dhaka', 'ঢাকা', 'chittagong', 'চট্টগ্রাম', 'chattogram', 'khulna', 'খুলনা',
  'rajshahi', 'রাজশাহী', 'sylhet', 'সিলেট', 'barisal', 'বরিশাল', 'barishal',
  'rangpur', 'রংপুর', 'mymensingh', 'ময়মনসিংহ', 'comilla', 'কুমিল্লা', 'cumilla',
  'gazipur', 'গাজীপুর', 'narayanganj', 'নারায়ণগঞ্জ', 'bogura', 'বগুড়া', 'bogra',
  'feni', 'ফেনী', 'noakhali', 'নোয়াখালী', 'jessore', 'যশোর', 'jashore', 'tangail', 'টাঙ্গাইল',
  'pabna', 'পাবনা', 'kushtia', 'কুষ্টিয়া', 'faridpur', 'ফরিদপুর', 'dinajpur', 'দিনাজপুর',
  'coxs bazar', 'কক্সবাজার', 'brahmanbaria', 'ব্রাহ্মণবাড়িয়া', 'sirajganj', 'সিরাজগঞ্জ'
];

const COLOR_KEYWORDS: Record<string, string> = {
  'black': 'Black',
  'কালো': 'Black',
  'kalo': 'Black',
  '১': 'Black',
  '1': 'Black',
  'silver': 'Silver',
  'সিলভার': 'Silver',
  '২': 'Silver',
  '2': 'Silver',
  'brown': 'Brown',
  'বাদামী': 'Brown',
  'বাদামি': 'Brown',
  '৩': 'Brown',
  '3': 'Brown',
  'blue': 'Blue',
  'নীল': 'Blue',
  'nil': 'Blue',
  '৪': 'Blue',
  '4': 'Blue',
  'gold': 'Gold',
  'গোল্ড': 'Gold',
  'rose gold': 'Rose Gold',
  'রোজ গোল্ড': 'Rose Gold',
};

export function extractCustomerEntities(text: string, existingMemory: ConversationMemory = {}): ExtractedInfo {
  const result: ExtractedInfo = {};
  const trimmed = text.trim();

  // 1. Phone Extraction
  const phoneMatch = trimmed.match(/(?:\+?88)?01[3-9]\d{8}/);
  if (phoneMatch) {
    const val = validateBDPhone(phoneMatch[0]);
    if (val.valid && val.normalized) {
      result.phone = val.normalized;
    }
  }

  // 2. Quantity Extraction
  if (/(১টি|১টা|1টি|1টা|1 pc|1pc|one|একটা)/i.test(trimmed)) {
    result.quantity = 1;
  } else if (/(২টি|২টা|2টি|2টা|2 pcs|2pcs|two|দুইটা)/i.test(trimmed)) {
    result.quantity = 2;
  } else if (/(৩টি|৩টা|3টি|3টা|3 pcs|3pcs|three|তিনটা)/i.test(trimmed)) {
    result.quantity = 3;
  }

  // 3. Variant / Color Extraction
  for (const [keyword, normalizedColor] of Object.entries(COLOR_KEYWORDS)) {
    const regex = new RegExp(`\\b${keyword}\\b|${keyword}\\s*(কালার|color|টা|ta)`, 'i');
    if (regex.test(trimmed)) {
      result.variant = normalizedColor;
      break;
    }
  }

  // 4. District Extraction
  for (const dist of DISTRICT_NAMES) {
    if (new RegExp(`\\b${dist}\\b`, 'i').test(trimmed)) {
      result.district = dist.charAt(0).toUpperCase() + dist.slice(1);
      break;
    }
  }

  // 5. Thana Extraction
  const thanaMatch = trimmed.match(/(?:thana|থানা|upazila|উপজেলা)[:\s]+([\u0980-\u09FF\w\s]+?)(?:,|\.|\n|$)/i);
  if (thanaMatch && thanaMatch[1]) {
    result.thana = thanaMatch[1].trim();
  }

  // 6. Name Extraction (Explicit indicators or comma formats)
  const nameMatch = trimmed.match(/(?:আমার নাম|নাম|Name)[:\s]+([\u0980-\u09FFa-zA-Z\s]{2,30})(?:,|\.|\n|$)/i);
  if (nameMatch && nameMatch[1]) {
    result.name = nameMatch[1].trim();
  } else if (trimmed.includes(',')) {
    // Check comma pattern: "Faysal, 017..., Khulna"
    const parts = trimmed.split(',').map((p) => p.trim());
    if (parts.length >= 2 && !/^\d+$/.test(parts[0]) && parts[0].length >= 2 && parts[0].length <= 30) {
      if (!/(thana|জেলা|থানা|ঢাকা|dhaka|order)/i.test(parts[0])) {
        result.name = parts[0];
      }
    }
  }

  // 7. Full Address Extraction (if message contains street, road, house, thana, district, or multiple tokens)
  if (
    /(বাড়ি|বাসা|রোড|গ্রাম|পোস্ট|থানা|জেলা|house|road|block|sector|village|thana|district)/i.test(trimmed) ||
    (result.district && trimmed.length > 20)
  ) {
    // If the message is long and has address markers, clean out phone/name if possible or use full snippet
    let cleanedAddress = trimmed;
    if (result.phone) cleanedAddress = cleanedAddress.replace(result.phone, '');
    if (result.name) cleanedAddress = cleanedAddress.replace(result.name, '');
    cleanedAddress = cleanedAddress.replace(/^[,\s:-]+|[,\s:-]+$/g, '');
    if (cleanedAddress.length > 8) {
      result.fullAddress = cleanedAddress;
    }
  }

  // 8. Invoice Number Extraction (e.g. "WG-1002" or "INV-1005")
  const invoiceMatch = trimmed.match(/\b([A-Z]{2,4}-\d+|INV-\d+)\b/i);
  if (invoiceMatch) {
    result.invoiceNo = invoiceMatch[1].toUpperCase();
  }

  // 9. Intent Detection
  if (
    /(আমার অর্ডার|অর্ডার কোথায়|অর্ডারের খবর|অর্ডার পাই নাই|order status|parcel kothay|পার্সেল কোথায়|পার্সেল কি পাঠাইছেন|কুরিয়ার কোড|ট্র্যাকিং|tracking code|কবে পাবো আমার পার্সেল|আমার পার্সেল কই|আমার প্রোডাক্ট কই|INV-\d+)/i.test(trimmed)
  ) {
    result.detectedIntent = 'ORDER_STATUS_INQUIRY';
  } else if (
    /(নষ্ট|ভাঙা|ভেঙ্গে গেছে|কাজ করে না|চলছে না|সমস্যা|ব্যাটারি শেষ|রিটার্ন|ফেরত|চেঞ্জ করতে চাই|বদল করতে চাই|অন্য কালার নিব|খারাপ প্রোডাক্ট|খারাপ কোয়ালিটি)/i.test(trimmed)
  ) {
    result.detectedIntent = 'RETURN_OR_COMPLAINT';
  } else if (
    /(অন্য মডেল|অন্যান্য প্রোডাক্ট|অন্যান্য পণ্য|আর কি আছে|ক্যাটালগ|অন্য ডিজাইন|catalogue|ar ki model|অন্য কোনো প্রোডাক্ট)/i.test(trimmed)
  ) {
    result.detectedIntent = 'RECOMMENDATION_INQUIRY';
  } else if (
    /(অর্ডার বাতিল|অর্ডার ক্যান্সেল|অর্ডারটি বাতিল|cancel order|cancel my order|পার্সেল বাতিল|অর্ডার cancel|orderটি বাতিল|অর্ডার বাতিল করুন|অর্ডার ক্যান্সেল করুন)/i.test(trimmed)
  ) {
    result.detectedIntent = 'ORDER_CANCEL_REQUEST';
  } else if (
    /(ঠিকানা পরিবর্তন|নাম্বার পরিবর্তন|ফোন পরিবর্তন|কালার পরিবর্তন|ভেরিয়েন্ট পরিবর্তন|অর্ডারের ঠিকানা|ঠিকানা চেঞ্জ|এড্রেস চেঞ্জ|address change|number change|update order|অর্ডার পরিবর্তন)/i.test(trimmed)
  ) {
    result.detectedIntent = 'ORDER_UPDATE_REQUEST';
  } else if (/(নিতে চাই|অর্ডার করবো|order korbo|order korte chai|order করতে চাই|একটি দেন|১টি দেন|একটা পাঠান|send me one|বুক করতে চাই|কনফার্ম|confirm|অর্ডার কনফার্ম|হ্যাঁ কনফার্ম|ঠিক আছে পাঠিয়ে দেন|ঠিক আছে দেন|পাঠাই দেন)/i.test(trimmed)) {
    result.detectedIntent = 'PURCHASE_INTENT';
  } else if (/(এখন নেব না|এখন নিব না|পরে নেব|পরে নিবো|এখন না|লাগবে না|টাকা নাই|পরে জানাব|কালকে নেব|কালকে জানাব|অন্য সময় নিব|ক্যান্সেল|বাতিল|pore nebo|ekhon na|lagbe na|ekhon nebo na|ar lagbe na|cancel|লাগবেনা)/i.test(trimmed)) {
    result.detectedIntent = 'FUTURE_PURCHASE';
  } else if (/(দাম কত|price koto|koto dam|rate koto|অফার কি)/i.test(trimmed)) {
    result.detectedIntent = 'PRICE_INQUIRY';
  } else if (
    /(ছবি|ফটো|পিক|পিকচার|photo|image|pic|picture|chobi|বাস্তব ছবি|আসল ছবি|রিয়েল ছবি|কালার দেখতে চাই|কালারের ছবি|রং দেখতে চাই|কালারগুলো দেখান|কালার দেখান|color dekhaw|pic den|photo den|chobi den|chobi pathan|image pathan|pic pathan)/i.test(trimmed)
  ) {
    result.detectedIntent = 'IMAGE_REQUEST';
  } else if (/(কথা বলতে চাই|মানুষের সাথে কথা|agent|representative|ফোন ধরুন)/i.test(trimmed)) {
    result.detectedIntent = 'HUMAN_AGENT_REQUEST';
  }

  // 10. TrxID & Payment Extraction (e.g. "TrxID: 9K37XZL2", "bKash পাঠাইছি BL92K8XZ", "Txn ID: 71F8ABCD")
  const trxMatch = trimmed.match(/(?:trxid|trx|txn\s*id|txid|transid|transaction|ট্রানজেকশন|আইডি|টিএক্সআইডি)[:\s-]*([A-Za-z0-9]{8,12})/i);
  if (trxMatch && trxMatch[1]) {
    result.trxId = trxMatch[1].toUpperCase();
  } else {
    // Check standalone 8-10 alphanumeric token with both letters & digits
    const standaloneTrx = trimmed.match(/\b(?=[A-Z0-9]*[A-Z])(?=[A-Z0-9]*[0-9])[A-Z0-9]{8,10}\b/i);
    if (standaloneTrx) {
      result.trxId = standaloneTrx[0].toUpperCase();
    }
  }

function parseBdDigits(str: string): string {
  const bdDigits: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
  };
  return str.replace(/[০-৯]/g, (d) => bdDigits[d] || d);
}

  // Payment Amount Extraction (supports English 200 and Bengali ২০০, e.g. "২০০ টাকা পাঠাইছি", "৳150", "150 taka", "200tk")
  const textWithAsciiDigits = parseBdDigits(trimmed);
  const amountMatch = textWithAsciiDigits.match(/(?:(?:৳|tk|taka|টাকা|পাঠাইছি|পাঠিয়েছি|দিসি|দিলাম)\s*(\d{2,6})|(\d{2,6})\s*(?:৳|tk|taka|টাকা))/i);
  if (amountMatch) {
    const val = parseInt(amountMatch[1] || amountMatch[2], 10);
    if (!isNaN(val) && val >= 50 && val <= 50000) {
      result.paymentAmount = val;
    }
  }

  if (/(bkash|বিকাশ)/i.test(trimmed)) {
    result.paymentMethod = 'bKash';
  } else if (/(nagad|নগদ)/i.test(trimmed)) {
    result.paymentMethod = 'Nagad';
  } else if (/(rocket|রকেট)/i.test(trimmed)) {
    result.paymentMethod = 'Rocket';
  } else if (/(upay|উপায়|উপায়)/i.test(trimmed)) {
    result.paymentMethod = 'Upay';
  }

  return result;
}

export function computeMissingOrderFields(memory: ConversationMemory): {
  collected: string[];
  missing: string[];
  promptForMissing: string | null;
} {
  const collected: string[] = [];
  const missing: string[] = [];

  if (memory.customer_name && memory.customer_name.trim().length > 1) {
    collected.push('name');
  } else {
    missing.push('name');
  }

  if (memory.customer_phone && validateBDPhone(memory.customer_phone).valid) {
    collected.push('phone');
  } else {
    missing.push('phone');
  }

  if (memory.full_address && memory.full_address.trim().length > 5) {
    collected.push('address');
  } else {
    missing.push('address');
  }

  if (memory.district && memory.district.trim().length > 1) {
    collected.push('district');
  } else {
    missing.push('district');
  }

  if (memory.selected_variant) {
    collected.push('variant');
  } else {
    missing.push('variant');
  }

  // Craft polite, concise Bangla prompt for only what is missing
  let prompt: string | null = null;
  const name = memory.customer_name ? `${memory.customer_name}` : '';

  if (missing.length === 0) {
    return { collected, missing, promptForMissing: null };
  }

  // Case 1: Missing only address (or thana/district)
  if (missing.includes('address') || missing.includes('district')) {
    if (!missing.includes('name') && !missing.includes('phone') && !missing.includes('variant')) {
      prompt = `ধন্যবাদ ${name}। আপনার সম্পূর্ণ ঠিকানাটি দিন (থানা এবং জেলার নামটা নিলে ভালো হয়) 😊`;
    } else if (!missing.includes('phone') && missing.includes('name')) {
      prompt = `ধন্যবাদ। এবার আপনার নাম এবং সম্পূর্ণ ঠিকানাটি দিন (থানা এবং জেলার নামটা নিলে ভালো হয়) 😊`;
    } else if (missing.includes('variant') && !missing.includes('phone')) {
      prompt = `আপনি কোন ভ্যারিয়েন্ট/কালারটি নিতে চান এবং আপনার ঠিকানাটি দিন (থানা এবং জেলার নাম সহ)? 😊`;
    }
  }

  // Case 2: Missing phone and address
  if (missing.includes('phone') || missing.includes('address')) {
    prompt = `আপনার নাম ঠিকানা মোবাইল নাম্বারটি দিন (থানা এবং জেলার নামটা নিলে ভালো হয়) 😊`;
  } else if (missing.includes('variant') && missing.length === 1) {
    prompt = `কোন ভ্যারিয়েন্ট, সাইজ বা কালারটি দিতে হবে জানালেই অর্ডার কনফার্ম করে দিচ্ছি। 😊`;
  }

  if (!prompt) {
    prompt = `আপনার নাম ঠিকানা মোবাইল নাম্বারটি দিন (থানা এবং জেলার নামটা নিলে ভালো হয়) 😊`;
  }

  return { collected, missing, promptForMissing: prompt };
}
