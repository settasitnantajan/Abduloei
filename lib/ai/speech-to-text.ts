import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * แปลงเสียงเป็นข้อความด้วย Gemini 2.5 Flash (multimodal audio input)
 * ใช้สำหรับ Safari/iOS ที่ไม่รองรับ Web Speech API
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const audioData = audioBuffer.toString('base64');

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType,
        data: audioData,
      },
    },
    {
      text: 'แปลงเสียงนี้เป็นข้อความ ตอบเฉพาะข้อความที่ได้ยินเท่านั้น ห้ามเพิ่มคำอธิบายหรือข้อความอื่นใด ถ้าไม่ได้ยินอะไรให้ตอบว่า ""',
    },
  ]);

  const response = result.response;
  const text = response.text().trim();

  // ถ้า Gemini ตอบว่าว่างเปล่า
  if (!text || text === '""' || text === "''") {
    return '';
  }

  // ลบ quotes ที่ Gemini อาจครอบไว้
  return text.replace(/^["']|["']$/g, '');
}
