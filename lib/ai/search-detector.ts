export interface SearchIntent {
  needsSearch: boolean;
  query: string;
  reason?: string;
}

/**
 * ตรวจจับว่าข้อความของ user ต้องการค้นหาข้อมูลจากอินเทอร์เน็ตหรือไม่
 */
export function detectSearchNeed(text: string): SearchIntent {
  const normalized = text.toLowerCase();

  // Pattern 1: Price queries
  if (/(ราคา|เท่าไหร่|กี่บาท|ค่า)/.test(normalized)) {
    return {
      needsSearch: true,
      query: text,
      reason: 'price_query',
    };
  }

  // Pattern 2: News/current events
  if (/(ข่าว|เกิดอะไรขึ้น|เหตุการณ์|สถานการณ์|ตอนนี้.*(?:เป็นยังไง|เป็นอย่างไร))/.test(normalized)) {
    return {
      needsSearch: true,
      query: text,
      reason: 'news_query',
    };
  }

  // Pattern 3: Weather
  if (/(อากาศ|ฝน|แดด|หนาว|ร้อน|อุณหภูมิ)(?!.*(?:เมื่อวาน|เมื่อกี้))/.test(normalized)) {
    return {
      needsSearch: true,
      query: text,
      reason: 'weather_query',
    };
  }

  // Pattern 4: Latest information
  if (/(ล่าสุด|ปัจจุบัน|ข้อมูลใหม่|อัพเดท|ตอนนี้|วันนี้.*(?:มี|เกิด))/.test(normalized)) {
    return {
      needsSearch: true,
      query: text,
      reason: 'latest_info',
    };
  }

  // Pattern 5: Sports/Match results
  if (/(ผลบอล|ผลการแข่งขึ้น|คะแนน.*(?:ล่าสุด|วันนี้))/.test(normalized)) {
    return {
      needsSearch: true,
      query: text,
      reason: 'sports_query',
    };
  }

  // Pattern 6: Stock/Crypto prices
  if (/(หุ้น|ทอง|น้ำมัน|bitcoin|crypto|ดอลลาร์)/.test(normalized)) {
    return {
      needsSearch: true,
      query: text,
      reason: 'financial_query',
    };
  }

  // Pattern 7: Specific questions about current events
  if (/(ใคร|อะไร|ที่ไหน|เมื่อไหร่|ทำไม|อย่างไร).*(?:ล่าสุด|ตอนนี้|วันนี้)/.test(normalized)) {
    return {
      needsSearch: true,
      query: text,
      reason: 'current_question',
    };
  }

  return {
    needsSearch: false,
    query: '',
  };
}
