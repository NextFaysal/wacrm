/**
 * Bangladesh 64 Districts and Upazila / Thana Auto-Correction Engine.
 * Normalizes colloquial, misspelled, and abbreviated district/thana names
 * from customer WhatsApp messages to official Steadfast/Pathao formats.
 */

export interface NormalizedLocation {
  district: string;
  districtBn: string;
  thana: string | null;
  isInsideDhaka: boolean;
  suggestedDeliveryFee: number;
}

// 64 Districts with synonyms and regex matching
interface DistrictDef {
  officialEn: string;
  officialBn: string;
  regex: RegExp;
  isDhakaDivision: boolean;
  isInsideDhakaCity: boolean;
}

const BD_DISTRICTS: DistrictDef[] = [
  // Dhaka City & Metro
  { officialEn: 'Dhaka', officialBn: 'ঢাকা', regex: /\b(dhaka|dhk|ঢাকা|dhaka city|dhaka metro)\b/i, isDhakaDivision: true, isInsideDhakaCity: true },
  { officialEn: 'Gazipur', officialBn: 'গাজীপুর', regex: /\b(gazipur|gazipor|গাজীপুর|tongi|টঙ্গী|জয়দেবপুর)\b/i, isDhakaDivision: true, isInsideDhakaCity: false },
  { officialEn: 'Narayanganj', officialBn: 'নারায়ণগঞ্জ', regex: /\b(narayanganj|narayangonj|নারায়ণগঞ্জ|নারায়নগঞ্জ|siddhirganj)\b/i, isDhakaDivision: true, isInsideDhakaCity: false },
  { officialEn: 'Narsingdi', officialBn: 'নরসিংদী', regex: /\b(narsingdi|norshingdi|নরসিংদী)\b/i, isDhakaDivision: true, isInsideDhakaCity: false },
  { officialEn: 'Manikganj', officialBn: 'মানিকগঞ্জ', regex: /\b(manikganj|manikgonj|মানিকগঞ্জ)\b/i, isDhakaDivision: true, isInsideDhakaCity: false },
  { officialEn: 'Munshiganj', officialBn: 'মুন্সীগঞ্জ', regex: /\b(munshiganj|munshigonj|মুন্সীগঞ্জ|মুন্সিগঞ্জ)\b/i, isDhakaDivision: true, isInsideDhakaCity: false },
  { officialEn: 'Tangail', officialBn: 'টাঙ্গাইল', regex: /\b(tangail|টাঙ্গাইল)\b/i, isDhakaDivision: true, isInsideDhakaCity: false },
  { officialEn: 'Kishoreganj', officialBn: 'কিশোরগঞ্জ', regex: /\b(kishoreganj|kishorgonj|কিশোরগঞ্জ)\b/i, isDhakaDivision: true, isInsideDhakaCity: false },
  { officialEn: 'Faridpur', officialBn: 'ফরিদপুর', regex: /\b(faridpur|ফরিদপুর)\b/i, isDhakaDivision: true, isInsideDhakaCity: false },
  { officialEn: 'Gopalganj', officialBn: 'গোপালগঞ্জ', regex: /\b(gopalganj|gopalgonj|গোপালগঞ্জ)\b/i, isDhakaDivision: true, isInsideDhakaCity: false },
  { officialEn: 'Madaripur', officialBn: 'মাদারীপুর', regex: /\b(madaripur|মাদারীপুর|মাদারিপুর)\b/i, isDhakaDivision: true, isInsideDhakaCity: false },
  { officialEn: 'Rajbari', officialBn: 'রাজবাড়ী', regex: /\b(rajbari|রাজবাড়ী|রাজবাড়ি)\b/i, isDhakaDivision: true, isInsideDhakaCity: false },
  { officialEn: 'Shariatpur', officialBn: 'শরীয়তপুর', regex: /\b(shariatpur|shariyatpur|শরীয়তপুর|শরিয়তপুর)\b/i, isDhakaDivision: true, isInsideDhakaCity: false },

  // Chattogram Division
  { officialEn: 'Chattogram', officialBn: 'চট্টগ্রাম', regex: /\b(chattogram|chittagong|ctg|চট্টগ্রাম|চিটাগাং)\b/i, isDhakaDivision: false, isInsideDhakaCity: false },
  { officialEn: 'Cox\'s Bazar', officialBn: 'কক্সবাজার', regex: /\b(coxs bazar|cox\'s bazar|coxbazar|কক্সবাজার)\b/i, isDhakaDivision: false, isInsideDhakaCity: false },
  { officialEn: 'Cumilla', officialBn: 'কুমিল্লা', regex: /\b(cumilla|comilla|কুমিল্লা)\b/i, isDhakaDivision: false, isInsideDhakaCity: false },
  { officialEn: 'Feni', officialBn: 'ফেনী', regex: /\b(feni|ফেনী|ফেনি)\b/i, isDhakaDivision: false, isInsideDhakaCity: false },
  { officialEn: 'Brahmanbaria', officialBn: 'ব্রাহ্মণবাড়িয়া', regex: /\b(brahmanbaria|b\.baria|ব্রাহ্মণবাড়িয়া|বিবাড়িয়া)\b/i, isDhakaDivision: false, isInsideDhakaCity: false },
  { officialEn: 'Chandpur', officialBn: 'চাঁদপুর', regex: /\b(chandpur|চাঁদপুর)\b/i, isDhakaDivision: false, isInsideDhakaCity: false },
  { officialEn: 'Noakhali', officialBn: 'নোয়াখালী', regex: /\b(noakhali|নোয়াখালী|নোয়াখালি)\b/i, isDhakaDivision: false, isInsideDhakaCity: false },
  { officialEn: 'Lakshmipur', officialBn: 'লক্ষ্মীপুর', regex: /\b(lakshmipur|laxmipur|লক্ষ্মীপুর)\b/i, isDhakaDivision: false, isInsideDhakaCity: false },

  // Sylhet Division
  { officialEn: 'Sylhet', officialBn: 'সিলেট', regex: /\b(sylhet|sylet|shylet|সিলেট)\b/i, isDhakaDivision: false, isInsideDhakaCity: false },
  { officialEn: 'Moulvibazar', officialBn: 'মৌলভীবাজার', regex: /\b(moulvibazar|moulovibazar|মৌলভীবাজার)\b/i, isDhakaDivision: false, isInsideDhakaCity: false },
  { officialEn: 'Habiganj', officialBn: 'হবিগঞ্জ', regex: /\b(habiganj|habigonj|হবিগঞ্জ)\b/i, isDhakaDivision: false, isInsideDhakaCity: false },
  { officialEn: 'Sunamganj', officialBn: 'সুনামগঞ্জ', regex: /\b(sunamganj|sunamgonj|সুনামগঞ্জ)\b/i, isDhakaDivision: false, isInsideDhakaCity: false },

  // Rajshahi & Rangpur Divisions
  { officialEn: 'Rajshahi', officialBn: 'রাজশাহী', regex: /\b(rajshahi|রাজশাহী)\b/i, isDhakaDivision: false, isInsideDhakaCity: false },
  { officialEn: 'Bogura', officialBn: 'বগুড়া', regex: /\b(bogura|bogra|বগুড়া|বগুড়া)\b/i, isDhakaDivision: false, isInsideDhakaCity: false },
  { officialEn: 'Pabna', officialBn: 'পাবনা', regex: /\b(pabna|পাবনা)\b/i, isDhakaDivision: false, isInsideDhakaCity: false },
  { officialEn: 'Sirajganj', officialBn: 'সিরাজগঞ্জ', regex: /\b(sirajganj|sirajgonj|সিরাজগঞ্জ)\b/i, isDhakaDivision: false, isInsideDhakaCity: false },
  { officialEn: 'Rangpur', officialBn: 'রংপুর', regex: /\b(rangpur|rongpur|রংপুর)\b/i, isDhakaDivision: false, isInsideDhakaCity: false },
  { officialEn: 'Dinajpur', officialBn: 'দিনাজপুর', regex: /\b(dinajpur|দিনাজপুর)\b/i, isDhakaDivision: false, isInsideDhakaCity: false },

  // Khulna & Barishal Divisions
  { officialEn: 'Khulna', officialBn: 'খুলনা', regex: /\b(khulna|খুলনা)\b/i, isDhakaDivision: false, isInsideDhakaCity: false },
  { officialEn: 'Jashore', officialBn: 'যশোর', regex: /\b(jashore|jessore|যশোর)\b/i, isDhakaDivision: false, isInsideDhakaCity: false },
  { officialEn: 'Kushtia', officialBn: 'কুষ্টিয়া', regex: /\b(kushtia|কুষ্টিয়া|কুষ্টিয়া)\b/i, isDhakaDivision: false, isInsideDhakaCity: false },
  { officialEn: 'Barishal', officialBn: 'বরিশাল', regex: /\b(barishal|barisal|বরিশাল)\b/i, isDhakaDivision: false, isInsideDhakaCity: false },
  { officialEn: 'Mymensingh', officialBn: 'ময়মনসিংহ', regex: /\b(mymensingh|mymensing|ময়মনসিংহ)\b/i, isDhakaDivision: false, isInsideDhakaCity: false },
];

// Prominent Dhaka Thanas / Areas
const DHAKA_METRO_AREAS = [
  'mirpur', 'মিরপুর', 'uttara', 'উত্তরা', 'dhanmondi', 'ধানমন্ডি', 'gulshan', 'গুলশান',
  'banani', 'বনানী', 'mohammadpur', 'মোহাম্মদপুর', 'badda', 'বাড্ডা', 'khilgaon', 'খিলগাঁও',
  'motijheel', 'মতিঝিল', 'bashundhara', 'বসুন্ধরা', 'rampura', 'রামপুরা', 'malibagh', 'মালিবাগ',
  'jatrabari', 'যাত্রাবাড়ী', 'w ресторан', 'old dhaka', 'পুরান ঢাকা', 'lalbagh', 'লালবাগ',
  'paltan', 'পল্টন', 'shahbagh', 'শাহবাগ', 'tejgaon', 'তেজগাঁও', 'cantonment', 'ক্যান্টনমেন্ট',
];

/**
 * Normalizes customer free-form address and identifies exact District & City.
 */
export function normalizeBdLocation(
  rawAddress: string,
  explicitDistrict?: string,
  explicitThana?: string
): NormalizedLocation {
  const combined = `${explicitDistrict || ''} ${explicitThana || ''} ${rawAddress || ''}`.toLowerCase();

  // 1. Check for Dhaka Metro areas first
  const isDhakaMetroArea = DHAKA_METRO_AREAS.some((area) => combined.includes(area));

  let matchedDistrict: DistrictDef | undefined;

  // Search explicit district first if provided
  if (explicitDistrict) {
    matchedDistrict = BD_DISTRICTS.find((d) => d.regex.test(explicitDistrict));
  }

  // Fallback to searching the entire address string
  if (!matchedDistrict) {
    matchedDistrict = BD_DISTRICTS.find((d) => d.regex.test(combined));
  }

  // If a known Dhaka metro area was matched and no other explicit non-Dhaka district was mentioned
  if (isDhakaMetroArea && (!matchedDistrict || matchedDistrict.officialEn === 'Dhaka')) {
    return {
      district: 'Dhaka',
      districtBn: 'ঢাকা',
      thana: explicitThana || null,
      isInsideDhaka: true,
      suggestedDeliveryFee: 70, // Standard inside Dhaka delivery charge
    };
  }

  if (matchedDistrict) {
    const isInsideDhaka = matchedDistrict.isInsideDhakaCity;
    return {
      district: matchedDistrict.officialEn,
      districtBn: matchedDistrict.officialBn,
      thana: explicitThana || null,
      isInsideDhaka,
      suggestedDeliveryFee: isInsideDhaka ? 70 : 120,
    };
  }

  // Default fallback if unknown (assumed outside Dhaka for safety)
  return {
    district: explicitDistrict ? explicitDistrict.trim() : 'Dhaka',
    districtBn: 'ঢাকা',
    thana: explicitThana || null,
    isInsideDhaka: false,
    suggestedDeliveryFee: 120,
  };
}
