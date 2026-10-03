import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * อ่านใบแจ้งยอดบัตรเครดิต (PDF / รูปถ่าย) แล้วดึงรายการใช้จ่ายออกมา
 *
 * ใช้ Gemini 2.5 Flash แบบ multimodal ตามแพตเทิร์นเดียวกับ lib/ai/speech-to-text.ts
 * — ส่งไฟล์เป็น base64 ผ่าน inlineData ไม่ต้องมี OCR library เพิ่ม
 *
 * ไฟล์ถูกอ่านจาก memory แล้วทิ้ง ไม่มีการบันทึกลงดิสก์หรือ storage
 */

/** ชนิดไฟล์ที่รองรับ — Gemini อ่าน PDF ได้โดยตรง ไม่ต้องแปลงเป็นรูปก่อน */
export const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

/** จำกัดขนาดไฟล์ — ใบแจ้งยอดปกติไม่เกินนี้ และกันส่งไฟล์ใหญ่เกินเข้า Gemini */
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/** รายการที่ดึงได้ 1 รายการ ยังไม่ระบุว่าเป็นของใคร */
export interface ParsedExpense {
  /** วันที่ใช้จ่าย รูปแบบ YYYY-MM-DD (ค.ศ.) */
  date: string;
  /** ชื่อร้าน/รายละเอียดรายการ */
  title: string;
  /** จำนวนเงิน (บาท) */
  amount: number;
  /** ไอคอนที่เดาจากประเภทร้าน */
  icon: string | null;
}

export interface ParseResult {
  expenses: ParsedExpense[];
  /** ข้อความเตือนจากตัวอ่าน เช่น อ่านบางส่วนไม่ออก */
  warning?: string;
}

/**
 * คำสั่งสำหรับ Gemini
 *
 * เน้นย้ำ 3 เรื่องที่พลาดบ่อยกับใบแจ้งยอดไทย:
 * 1. ปี พ.ศ. ต้องแปลงเป็น ค.ศ. (ระบบเก็บ ค.ศ. เสมอ)
 * 2. เอาเฉพาะรายการใช้จ่าย ไม่เอายอดยกมา/ยอดชำระ/ดอกเบี้ย
 * 3. ยอดคืนเงิน (เครดิต) ต้องข้าม ไม่ใช่รายจ่าย
 */
const PROMPT = `คุณคือผู้ช่วยอ่านใบแจ้งยอดบัตรเครดิต

อ่านไฟล์นี้แล้วดึง "รายการใช้จ่าย" ทั้งหมดออกมา ตอบกลับเป็น JSON array เท่านั้น

รูปแบบแต่ละรายการ:
{"date":"YYYY-MM-DD","title":"ชื่อร้าน","amount":ตัวเลข,"icon":"emoji"}

กฎสำคัญ:
1. ปี: ถ้าใบแจ้งยอดใช้ปี พ.ศ. (2567, 2568, 2569) ให้ลบ 543 แปลงเป็น ค.ศ. ก่อนเสมอ
   เช่น 15/09/2569 ต้องตอบ "2026-09-15"
   ถ้าเป็นเลข 2 หลัก เช่น 05/09/26 ให้ดูบริบท: 26 คือ ค.ศ. 2026 (ไม่ใช่ พ.ศ.)
1b. บางใบมีวันที่ 2 ช่องติดกัน (วันที่ทำรายการ และวันที่บันทึก) เช่น "13/08 14/08"
   ให้ใช้ช่องแรก (วันที่ทำรายการ) และเติมปีจากรอบบัญชีของใบแจ้งยอดนั้น
   ระวังรายการปลายเดือนที่ข้ามปี เช่น รอบบัญชี ม.ค. 2027 แต่รายการวันที่ 28/12 คือปี 2026
2. เอาเฉพาะรายการที่ใช้จ่ายจริง ห้ามเอา:
   - ยอดยกมา / ยอดคงเหลือ / ยอดรวม / ยอดที่ต้องชำระ
   - การชำระเงินเข้าบัตร
   - ดอกเบี้ย ค่าธรรมเนียม ค่าปรับ (ยกเว้นระบุชัดว่าเป็นค่าบริการร้านค้า)
3. ข้ามรายการคืนเงิน/เครดิต (ตัวเลขติดลบหรือมีคำว่า CR, REFUND, คืนเงิน)
4. amount เป็นตัวเลขล้วน ไม่มีคอมมาและสัญลักษณ์เงิน เช่น 1234.50
5. title ให้อ่านชื่อร้านตามที่ปรากฏ ถ้ามีรหัสร้านยาว ๆ ให้ตัดเหลือชื่อที่อ่านรู้เรื่อง
6. icon เลือก emoji 1 ตัวที่ตรงประเภทร้าน:
   ⛽ น้ำมัน · 🛒 ซูเปอร์/ของใช้ · 🍜 ร้านอาหาร · ☕ คาเฟ่ · 🚕 เดินทาง
   ✈️ ตั๋วเครื่องบิน/โรงแรม · 👕 เสื้อผ้า · 💊 ยา/โรงพยาบาล · 📦 ช้อปออนไลน์
   🎬 บันเทิง/สตรีมมิ่ง · 📱 มือถือ/เน็ต · 🏠 บ้าน · 💡 สาธารณูปโภค · 💳 อื่น ๆ

ถ้าอ่านไฟล์ไม่ออกหรือไม่ใช่ใบแจ้งยอด ให้ตอบ []
ตอบเฉพาะ JSON array ห้ามมีข้อความอธิบายหรือ markdown code fence`;

/** ดึง JSON array ออกจากคำตอบ เผื่อ Gemini ครอบ code fence มาให้ */
function extractJsonArray(raw: string): string {
  const text = raw.trim();
  // ตัด ```json ... ``` ถ้ามี
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  // หาวงเล็บเหลี่ยมคู่นอกสุด
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start !== -1 && end > start) return text.slice(start, end + 1);
  return text;
}

/** วันที่ต้องเป็น YYYY-MM-DD ที่มีอยู่จริง */
function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  // ตรวจว่าวันที่นั้นมีจริง (กัน 31 ก.พ.)
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

/**
 * ตรวจและทำความสะอาดผลที่ Gemini ตอบมา
 *
 * ทิ้งรายการที่ข้อมูลไม่ครบหรือผิดรูป แทนที่จะปล่อยให้หลุดไปถึง UI
 * เพราะผู้ใช้จะต้องมาตรวจอีกชั้นอยู่แล้ว ของที่ชัดว่าเสียควรกรองตั้งแต่ตรงนี้
 */
function sanitize(items: unknown): ParsedExpense[] {
  if (!Array.isArray(items)) return [];

  const result: ParsedExpense[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;

    const title = typeof item.title === 'string' ? item.title.trim() : '';
    const amount = typeof item.amount === 'number' ? item.amount : Number(item.amount);

    if (!title) continue;
    if (!Number.isFinite(amount) || amount <= 0) continue;
    if (!isValidDate(item.date)) continue;

    result.push({
      date: item.date,
      title: title.slice(0, 120),
      // ปัดทศนิยม 2 ตำแหน่ง กันเลขยาวผิดปกติ
      amount: Math.round(amount * 100) / 100,
      icon: typeof item.icon === 'string' && item.icon.trim() ? item.icon.trim().slice(0, 4) : null,
    });
  }
  return result;
}

/** แปลงคำตอบดิบจาก Gemini เป็นผลลัพธ์ที่ตรวจแล้ว */
function toResult(text: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonArray(text));
  } catch {
    console.error('[StatementParser] ตอบกลับไม่ใช่ JSON:', text.slice(0, 200));
    return { expenses: [], warning: 'อ่านไฟล์ไม่สำเร็จ กรุณาลองไฟล์อื่นหรือกรอกเอง' };
  }

  const expenses = sanitize(parsed);
  const rawCount = Array.isArray(parsed) ? parsed.length : 0;

  if (expenses.length === 0) {
    return {
      expenses: [],
      warning: 'ไม่พบรายการใช้จ่ายในไฟล์นี้ กรุณาตรวจว่าเป็นใบแจ้งยอดบัตรเครดิต',
    };
  }

  const dropped = rawCount - expenses.length;
  return {
    expenses,
    warning: dropped > 0 ? `มี ${dropped} รายการที่อ่านไม่ครบและถูกข้ามไป` : undefined,
  };
}

/**
 * อ่านรายการจาก "ข้อความ" ที่ดึงออกมาจาก PDF แล้ว
 *
 * ใช้กับ PDF ที่ถอดรหัสแล้ว — ส่งข้อความแทนไฟล์ ประหยัดกว่าและแม่นกว่า
 * เพราะไม่ต้องให้ Gemini อ่านภาพ
 */
export async function parseStatementFromText(statementText: string): Promise<ParseResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const result = await model.generateContent([
    { text: `${PROMPT}\n\nข้อความจากใบแจ้งยอด:\n"""\n${statementText}\n"""` },
  ]);

  return toResult(result.response.text());
}

/**
 * อ่านใบแจ้งยอดแล้วคืนรายการใช้จ่าย
 *
 * @param fileBuffer ไฟล์ที่อ่านเข้า memory แล้ว
 * @param mimeType ชนิดไฟล์ ต้องอยู่ใน SUPPORTED_MIME_TYPES
 */
export async function parseStatement(
  fileBuffer: Buffer,
  mimeType: string
): Promise<ParseResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType,
        data: fileBuffer.toString('base64'),
      },
    },
    { text: PROMPT },
  ]);

  return toResult(result.response.text());
}
